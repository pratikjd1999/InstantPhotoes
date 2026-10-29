import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { AwsClient } from "aws4fetch";

// Object storage for photos and branding (PRD §9). The browser always talks to storage through short-lived signed URLs,
// so files never pass through the app server (UPL-3).
//
// Two drivers with the same interface:
// - "r2": Cloudflare R2 (S3 API). Used whenever R2_* variables are set. Required in production.
// - "local": files under .local/storage, served by /api/storage/* with HMAC-signed URLs that behave like R2's.
//   For development only, so the app works before a bucket exists.

export interface Storage {
  driver: "r2" | "local";
  /** URL the browser can PUT the file to. */
  presignPut(key: string, ttlSeconds: number): Promise<string>;
  /** URL to view or download the file. `downloadName` makes the browser save it under that name. */
  presignGet(key: string, ttlSeconds: number, downloadName?: string): Promise<string>;
  /** Size of the stored object, or null if it does not exist. */
  head(key: string): Promise<{ size: number } | null>;
}

export const MAX_PHOTO_BYTES = 15 * 1024 * 1024;
export const MAX_BRANDING_BYTES = 5 * 1024 * 1024;

/** Base URL of the site, used for QR links. */
export function appUrl(): string {
  return (process.env.APP_URL || process.env.BETTER_AUTH_URL || "http://localhost:3000").replace(/\/+$/, "");
}

const SAFE_KEY = /^[A-Za-z0-9][A-Za-z0-9._\-/]*$/;
export function assertSafeKey(key: string) {
  if (!SAFE_KEY.test(key) || key.includes("..") || key.includes("//")) throw new Error(`Unsafe storage key: ${key}`);
}

// ---------- R2 ----------
function r2Storage(): Storage {
  const account = process.env.R2_ACCOUNT_ID!;
  const bucket = process.env.R2_BUCKET!;
  const client = new AwsClient({
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    service: "s3",
    region: "auto",
  });
  const objectUrl = (key: string) => {
    assertSafeKey(key);
    return `https://${account}.r2.cloudflarestorage.com/${bucket}/${key}`;
  };
  const presign = async (method: "GET" | "PUT", key: string, ttl: number, extra?: Record<string, string>) => {
    const url = new URL(objectUrl(key));
    url.searchParams.set("X-Amz-Expires", String(ttl));
    for (const [k, v] of Object.entries(extra ?? {})) url.searchParams.set(k, v);
    const signed = await client.sign(new Request(url, { method }), { aws: { signQuery: true } });
    return signed.url;
  };
  return {
    driver: "r2",
    presignPut: (key, ttl) => presign("PUT", key, ttl),
    presignGet: (key, ttl, downloadName) =>
      presign("GET", key, ttl, downloadName ? { "response-content-disposition": contentDisposition(downloadName) } : undefined),
    async head(key) {
      const res = await client.fetch(objectUrl(key), { method: "HEAD" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`R2 HEAD ${key} failed: ${res.status}`);
      return { size: Number(res.headers.get("content-length") ?? 0) };
    },
  };
}

// ---------- local (development) ----------
function localRoot(): string {
  if (process.env.LOCAL_STORAGE_DIR) return path.resolve(process.env.LOCAL_STORAGE_DIR);
  // `npm run dev` runs inside apps/web; scripts run inside packages/*. Both resolve to the repo root.
  const cwd = process.cwd();
  const repo = /[\\/](apps|packages)[\\/][^\\/]+$/.test(cwd) ? path.resolve(cwd, "../..") : cwd;
  return path.join(repo, ".local", "storage");
}

function signingSecret(): string {
  const secret = process.env.STORAGE_SIGNING_SECRET || process.env.BETTER_AUTH_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") throw new Error("STORAGE_SIGNING_SECRET or BETTER_AUTH_SECRET must be set.");
  return "dev-only-storage-secret";
}

const signature = (method: string, key: string, exp: number, name: string) =>
  createHmac("sha256", signingSecret()).update(`${method}\n${key}\n${exp}\n${name}`).digest("base64url");

function localStorage(): Storage {
  const presign = async (method: "GET" | "PUT", key: string, ttl: number, name = "") => {
    assertSafeKey(key);
    const exp = Math.floor(Date.now() / 1000) + ttl;
    const q = new URLSearchParams({ m: method, exp: String(exp), sig: signature(method, key, exp, name) });
    if (name) q.set("name", name);
    // Same-origin relative URL: the browser resolves it against the current site.
    return `/api/storage/${key}?${q}`;
  };
  return {
    driver: "local",
    presignPut: (key, ttl) => presign("PUT", key, ttl),
    presignGet: (key, ttl, name) => presign("GET", key, ttl, name),
    async head(key) {
      assertSafeKey(key);
      try {
        return { size: (await stat(path.join(localRoot(), key))).size };
      } catch {
        return null;
      }
    },
  };
}

/** Checks a local signed URL. Used by the /api/storage route. */
export function verifyLocalSignature(method: string, key: string, params: URLSearchParams): boolean {
  const exp = Number(params.get("exp"));
  const sig = params.get("sig") ?? "";
  if (params.get("m") !== method || !Number.isFinite(exp) || exp < Date.now() / 1000) return false;
  try {
    assertSafeKey(key);
  } catch {
    return false;
  }
  const expected = Buffer.from(signature(method, key, exp, params.get("name") ?? ""));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export async function localWrite(key: string, data: Uint8Array): Promise<void> {
  assertSafeKey(key);
  const file = path.join(localRoot(), key);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, data);
}

export async function localRead(key: string): Promise<Uint8Array | null> {
  assertSafeKey(key);
  try {
    return await readFile(path.join(localRoot(), key));
  } catch {
    return null;
  }
}

export function contentDisposition(name: string): string {
  const ascii = name.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

let cached: Storage | undefined;
export function getStorage(): Storage {
  if (cached) return cached;
  const r2 = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"].every((k) => process.env[k]);
  if (r2) cached = r2Storage();
  else if (process.env.NODE_ENV === "production") throw new Error("R2 is not configured: set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET.");
  else cached = localStorage();
  return cached;
}
