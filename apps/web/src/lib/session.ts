// Stateless signed session cookie. Uses Web Crypto only, so it also runs in proxy.ts.
import { authConfig } from "@/config/auth.config";

export const SESSION_COOKIE = "ip_session";

export type Role = "super_admin" | "photographer";

export interface Session {
  sub: string;
  role: Role;
  name: string;
  /** Bumped on password change so older sessions stop working. */
  v: number;
  exp: number;
}

const enc = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function hmacKey(usage: "sign" | "verify") {
  return crypto.subtle.importKey("raw", enc.encode(authConfig.session.secret), { name: "HMAC", hash: "SHA-256" }, false, [usage]);
}

export async function signSession(data: Omit<Session, "exp">): Promise<string> {
  const payload: Session = { ...data, exp: Math.floor(Date.now() / 1000) + authConfig.session.maxAgeSeconds };
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign("HMAC", await hmacKey("sign"), enc.encode(body));
  return `${body}.${b64url(new Uint8Array(sig))}`;
}

export async function verifySession(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  try {
    const ok = await crypto.subtle.verify("HMAC", await hmacKey("verify"), fromB64url(sig) as BufferSource, enc.encode(body));
    if (!ok) return null;
    const payload = JSON.parse(new TextDecoder().decode(fromB64url(body))) as Session;
    if (typeof payload.exp !== "number" || payload.exp < Date.now() / 1000) return null;
    return payload;
  } catch {
    return null;
  }
}

export const homeForRole = (role: Role) => (role === "super_admin" ? "/admin" : "/dashboard");
