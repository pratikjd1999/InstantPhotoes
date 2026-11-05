import { sql } from "drizzle-orm";
import { getDb } from "@instantphotos/db";
import { DomainError } from "./types";

// The app's side of the face worker (apps/worker, PRD §7.4). Photos reach the worker through the `jobs` table;
// the app only calls it directly to wake it after uploads and to embed a guest's selfie (GST-4).
// WORKER_URL and WORKER_SECRET are optional in development: without them, uploads still queue jobs.

/** Must match the worker's MATCH_THRESHOLD (PRD §10.3: OpenCV's SFace cosine threshold, tuned before launch). */
export const MATCH_THRESHOLD = Number(process.env.MATCH_THRESHOLD || 0.363);

function workerConfig() {
  const url = process.env.WORKER_URL?.replace(/\/+$/, "");
  const secret = process.env.WORKER_SECRET;
  return url && secret ? { url, secret } : null;
}

/** Best effort: tells the worker new jobs are waiting. If it is down, it still finds them on its next poll. */
export async function wakeWorker(): Promise<void> {
  const w = workerConfig();
  if (!w) return;
  try {
    await fetch(`${w.url}/wake`, { method: "POST", headers: { "x-worker-secret": w.secret }, signal: AbortSignal.timeout(1500) });
  } catch {
    // ignored on purpose
  }
}

export type SelfieProblem = "no_face" | "multiple_faces" | "face_too_small" | "bad_image" | "not_found";
export type SelfieResult = { ok: true; embedding: number[] } | { ok: false; code: SelfieProblem; message: string };

/**
 * GST-4: the selfie is already in storage under `events/{eventId}/selfies/`. The worker checks it shows exactly one
 * clear face and returns its 128-d embedding, or a guest-friendly message saying what to fix.
 */
export async function embedSelfie(key: string): Promise<SelfieResult> {
  const w = workerConfig();
  if (!w) throw new DomainError("Photo matching is not available right now. Please try again in a few minutes.", 503);
  let res: Response;
  try {
    res = await fetch(`${w.url}/embed-selfie`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-worker-secret": w.secret },
      body: JSON.stringify({ key }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new DomainError("Photo matching is not available right now. Please try again in a few minutes.", 503);
  }
  const body = (await res.json().catch(() => null)) as SelfieResult | null;
  if (res.ok && body?.ok && body.embedding?.length === 128) return body;
  if (res.status === 422 && body && !body.ok) return body;
  throw new DomainError("Photo matching is not available right now. Please try again in a few minutes.", 503);
}

/**
 * GST-6: matches a guest's selfie against every face already found in the event and stores the matches.
 * Run after the guest row (with its embedding) is committed; the worker does the other direction for new photos.
 * Matches the guest hid ("Not me", GAL-8) stay hidden. Returns the number of matched photos.
 */
export async function matchGuest(guestId: string): Promise<number> {
  const db = getDb();
  await db.execute(sql`
    insert into guest_photos (guest_id, photo_id, similarity)
    select g.id, f.photo_id, max(1 - (f.embedding <=> g.selfie_embedding))
    from guests g
    join faces f on f.event_id = g.event_id and f.deleted_at is null
    join photos p on p.id = f.photo_id and p.deleted_at is null
    where g.id = ${guestId} and g.deleted_at is null and g.selfie_embedding is not null
    group by g.id, f.photo_id
    having max(1 - (f.embedding <=> g.selfie_embedding)) >= ${MATCH_THRESHOLD}
    on conflict (guest_id, photo_id) do update set similarity = excluded.similarity`);
  const count = await db.execute(sql`
    select count(*)::int as n from guest_photos where guest_id = ${guestId} and deleted_at is null and not hidden_by_guest`);
  return Number((count.rows[0] as { n: number }).n);
}
