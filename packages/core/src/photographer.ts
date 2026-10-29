import { randomInt, randomUUID } from "node:crypto";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { events, getDb, guestPhotos, jobs, photographerProfiles, photos, user } from "@instantphotos/db";
import { formatIndianPhone } from "./admin";
import { MAX_BRANDING_BYTES, MAX_PHOTO_BYTES, appUrl, getStorage } from "./storage";
import {
  DomainError,
  type DashboardSummary,
  type EventGuest,
  type EventStats,
  type EventStatus,
  type PhotoItem,
  type PhotoPage,
  type PhotoStatus,
  type PhotographerEvent,
  type PhotographerProfile,
  type UploadBatchResult,
} from "./types";

// Everything a photographer can do with their own data (PRD §5.3–5.5, §5.9).
// Every function takes the signed-in photographer's id and only ever touches rows they own (PRD §12).

const URL_TTL = 60 * 60; // signed view URLs: 1 hour
const UPLOAD_TTL = 15 * 60; // presigned PUT URLs: 15 minutes (UPL-7)
const ORIGINALS_BATCH_BYTES = 500 * 1024 * 1024; // PHG-3
const MAX_BATCH_FILES = 500;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

type Raw = Record<string, unknown>;

const isDate = (s: string) => ISO_DATE.test(s) && !Number.isNaN(new Date(`${s}T00:00:00Z`).getTime());
const plusDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

// Public event code (EVT-2): random and unguessable, easy to read off a printed card (no 0/o, 1/l/i).
const CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
export const newPublicCode = () => Array.from({ length: 10 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
export const eventPublicUrl = (code: string) => `${appUrl()}/e/${code}`;

// ---------- profile and branding (PRO-1..3) ----------

async function signed(key: string | null, name?: string): Promise<string | null> {
  return key ? getStorage().presignGet(key, URL_TTL, name) : null;
}

export async function getProfile(userId: string): Promise<PhotographerProfile> {
  const [row] = await getDb()
    .select({
      name: user.name,
      email: user.email,
      code: photographerProfiles.code,
      studioName: photographerProfiles.studioName,
      displayName: photographerProfiles.displayName,
      phone: photographerProfiles.phone,
      website: photographerProfiles.website,
      instagram: photographerProfiles.instagram,
      logoKey: photographerProfiles.logoKey,
      brandImageKey: photographerProfiles.brandImageKey,
    })
    .from(photographerProfiles)
    .innerJoin(user, eq(user.id, photographerProfiles.userId))
    .where(eq(photographerProfiles.userId, userId));
  if (!row) throw new DomainError("Profile not found.", 404);
  return {
    userId,
    name: row.name,
    email: row.email,
    code: row.code,
    studioName: row.studioName,
    displayName: row.displayName ?? "",
    phone: row.phone,
    website: row.website ?? "",
    instagram: row.instagram ?? "",
    logoUrl: await signed(row.logoKey),
    brandImageUrl: await signed(row.brandImageKey),
  };
}

export interface ProfileInput {
  studioName: string;
  displayName: string;
  phone: string;
  website: string;
  instagram: string;
}

function normaliseWebsite(input: string): string | null {
  const v = input.trim();
  if (!v) return null;
  const withScheme = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  try {
    const url = new URL(withScheme);
    if (!url.hostname.includes(".")) throw new Error();
    return url.toString().replace(/\/$/, "");
  } catch {
    throw new DomainError("Enter a valid website, e.g. yourstudio.in");
  }
}

function normaliseInstagram(input: string): string | null {
  let v = input.trim();
  if (!v) return null;
  v = v.replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/^@/, "").replace(/\/.*$/, "");
  if (!/^[A-Za-z0-9._]{1,30}$/.test(v)) throw new DomainError("Enter a valid Instagram handle, e.g. @yourstudio");
  return v;
}

export async function updateProfile(userId: string, input: Partial<ProfileInput>): Promise<PhotographerProfile> {
  const studioName = input.studioName?.trim() ?? "";
  if (!studioName) throw new DomainError("Studio name is required.");
  if (studioName.length > 120) throw new DomainError("Studio name is too long.");
  const phone = formatIndianPhone(input.phone ?? "");
  if (!phone) throw new DomainError("Enter a 10-digit Indian phone number.");
  await getDb()
    .update(photographerProfiles)
    .set({
      studioName,
      displayName: input.displayName?.trim() || null,
      phone,
      website: normaliseWebsite(input.website ?? ""),
      instagram: normaliseInstagram(input.instagram ?? ""),
      updatedAt: new Date(),
    })
    .where(eq(photographerProfiles.userId, userId));
  return getProfile(userId);
}

export type BrandingKind = "logo" | "brand";
const BRANDING_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png" };

/** Step 1 of a branding upload: a presigned PUT URL for a new key (PRO-2). */
export async function brandingUploadUrl(userId: string, kind: BrandingKind, contentType: string, size: number) {
  if (kind !== "logo" && kind !== "brand") throw new DomainError("Unknown branding image.");
  const ext = BRANDING_TYPES[contentType];
  if (!ext) throw new DomainError("Use a JPEG or PNG image.");
  if (!(size > 0) || size > MAX_BRANDING_BYTES) throw new DomainError("The image must be 5 MB or smaller.");
  // A fresh key per upload, so browsers and caches never show the old image.
  const key = `photographers/${userId}/branding/${kind}-${Date.now().toString(36)}.${ext}`;
  return { key, url: await getStorage().presignPut(key, UPLOAD_TTL) };
}

/** Step 2: after the browser uploaded the file, attach it to the profile. `null` removes the image. */
export async function setBranding(userId: string, kind: BrandingKind, key: string | null): Promise<PhotographerProfile> {
  if (kind !== "logo" && kind !== "brand") throw new DomainError("Unknown branding image.");
  if (key !== null) {
    if (!key.startsWith(`photographers/${userId}/branding/${kind}-`)) throw new DomainError("Invalid image.");
    const head = await getStorage().head(key);
    if (!head) throw new DomainError("The upload did not finish. Please try again.");
    if (head.size > MAX_BRANDING_BYTES) throw new DomainError("The image must be 5 MB or smaller.");
  }
  await getDb()
    .update(photographerProfiles)
    .set(kind === "logo" ? { logoKey: key, updatedAt: new Date() } : { brandImageKey: key, updatedAt: new Date() })
    .where(eq(photographerProfiles.userId, userId));
  return getProfile(userId);
}

// ---------- events (EVT-1..7) ----------

const COUNTED = sql`('uploaded', 'processing', 'ready', 'failed')`;

/** Events of one photographer with their numbers. Soft-deleted events and rows never appear (EVT-6). */
async function eventRows(userId: string, eventId?: string): Promise<PhotographerEvent[]> {
  const res = await getDb().execute(sql`
    select e.id, e.name, e.event_date::text as event_date, e.venue, e.public_code, e.status,
           e.gallery_expires_at::text as gallery_expires_at, e.created_at,
           coalesce(p.photos, 0)::int as photos, coalesce(p.ready, 0)::int as ready,
           coalesce(p.processing, 0)::int as processing, coalesce(p.failed, 0)::int as failed,
           coalesce(p.bytes, 0)::float8 as bytes,
           coalesce(g.guests, 0)::int as guests, coalesce(g.matched, 0)::int as matched, c.cover_key
    from events e
    left join (
      select event_id,
             count(*) filter (where status in ${COUNTED}) as photos,
             count(*) filter (where status = 'ready') as ready,
             count(*) filter (where status in ('uploaded', 'processing')) as processing,
             count(*) filter (where status in ('failed', 'upload_failed')) as failed,
             sum(size_bytes) filter (where status in ${COUNTED}) as bytes
      from photos
      where deleted_at is null and event_id in (select id from events where photographer_id = ${userId})
      group by event_id
    ) p on p.event_id = e.id
    left join (
      select g.event_id, count(*) as guests,
             count(*) filter (where exists (
               select 1 from guest_photos gp where gp.guest_id = g.id and gp.deleted_at is null)) as matched
      from guests g
      where g.deleted_at is null and g.event_id in (select id from events where photographer_id = ${userId})
      group by g.event_id
    ) g on g.event_id = e.id
    left join lateral (
      -- Cover image: the first photo in capture order (its thumbnail once processed).
      select coalesce(c.thumb_key, c.original_key) as cover_key from photos c
      where c.event_id = e.id and c.deleted_at is null and c.status in ${COUNTED}
      order by coalesce(c.taken_at, c.uploaded_at, c.created_at) limit 1
    ) c on true
    where e.photographer_id = ${userId} and e.deleted_at is null ${eventId ? sql`and e.id = ${eventId}` : sql``}
    order by e.event_date desc, e.created_at desc`);
  const storage = getStorage();
  return Promise.all(res.rows.map(async (r: Raw) => {
    const stats: EventStats = {
      photos: Number(r.photos),
      ready: Number(r.ready),
      processing: Number(r.processing),
      failed: Number(r.failed),
      guests: Number(r.guests),
      matchedGuests: Number(r.matched),
      storageBytes: Number(r.bytes),
    };
    return {
      id: String(r.id),
      name: String(r.name),
      eventDate: String(r.event_date),
      venue: String(r.venue),
      publicCode: String(r.public_code),
      publicUrl: eventPublicUrl(String(r.public_code)),
      status: r.status as EventStatus,
      galleryExpiresAt: String(r.gallery_expires_at),
      createdAt: new Date(r.created_at as string).toISOString(),
      coverUrl: r.cover_key ? await storage.presignGet(String(r.cover_key), URL_TTL) : null,
      stats,
    };
  }));
}

export const listMyEvents = (userId: string) => eventRows(userId);

export async function getMyEvent(userId: string, eventId: string): Promise<PhotographerEvent> {
  if (!/^[0-9a-f-]{36}$/i.test(eventId)) throw new DomainError("Event not found.", 404);
  const [row] = await eventRows(userId, eventId);
  if (!row) throw new DomainError("Event not found.", 404);
  return row;
}

/** Cheap ownership check for actions that don't need the event's numbers. */
async function assertOwnEvent(userId: string, eventId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(eventId)) throw new DomainError("Event not found.", 404);
  const [row] = await getDb()
    .select({ id: events.id, status: events.status })
    .from(events)
    .where(and(eq(events.id, eventId), eq(events.photographerId, userId), isNull(events.deletedAt)));
  if (!row) throw new DomainError("Event not found.", 404);
  return row;
}

export async function getDashboard(userId: string): Promise<DashboardSummary> {
  const all = await eventRows(userId);
  return {
    totals: {
      events: all.length,
      activeEvents: all.filter((e) => e.status === "active").length,
      photos: all.reduce((n, e) => n + e.stats.photos, 0),
      processing: all.reduce((n, e) => n + e.stats.processing, 0),
      guests: all.reduce((n, e) => n + e.stats.guests, 0),
      storageBytes: all.reduce((n, e) => n + e.stats.storageBytes, 0),
    },
    events: all,
  };
}

export interface EventInput {
  name: string;
  eventDate: string;
  venue: string;
  galleryExpiresAt: string;
  status: EventStatus;
}

function validateEvent(input: Partial<EventInput>, requireAll: boolean) {
  const out: Partial<{ name: string; eventDate: string; venue: string; galleryExpiresAt: string; status: EventStatus }> = {};
  if (requireAll || input.name !== undefined) {
    const name = input.name?.trim() ?? "";
    if (!name) throw new DomainError("Event name is required.");
    if (name.length > 120) throw new DomainError("Event name must be 120 characters or fewer.");
    out.name = name;
  }
  if (requireAll || input.eventDate !== undefined) {
    if (!isDate(input.eventDate ?? "")) throw new DomainError("Enter a valid event date.");
    out.eventDate = input.eventDate;
  }
  if (input.venue !== undefined) {
    const venue = input.venue.trim();
    if (venue.length > 200) throw new DomainError("Venue must be 200 characters or fewer.");
    out.venue = venue;
  }
  if (input.galleryExpiresAt !== undefined && input.galleryExpiresAt !== "") {
    if (!isDate(input.galleryExpiresAt)) throw new DomainError("Enter a valid gallery expiry date.");
    out.galleryExpiresAt = input.galleryExpiresAt;
  }
  if (input.status !== undefined) {
    if (input.status !== "active" && input.status !== "archived") throw new DomainError("Invalid status.");
    out.status = input.status;
  }
  return out;
}

export async function createEvent(userId: string, input: Partial<EventInput>): Promise<PhotographerEvent> {
  const v = validateEvent(input, true);
  const galleryExpiresAt = v.galleryExpiresAt ?? plusDays(v.eventDate!, 7); // EVT-4
  if (galleryExpiresAt < v.eventDate!) throw new DomainError("Gallery expiry can't be before the event date.");
  const id = randomUUID();
  for (let attempt = 0; ; attempt++) {
    try {
      await getDb()
        .insert(events)
        .values({ id, photographerId: userId, name: v.name!, eventDate: v.eventDate!, venue: v.venue ?? "", publicCode: newPublicCode(), galleryExpiresAt });
      break;
    } catch (err) {
      // A public-code collision is astronomically unlikely; try a new code a couple of times.
      if ((err as { code?: string }).code === "23505" && attempt < 3) continue;
      throw err;
    }
  }
  return getMyEvent(userId, id);
}

export async function updateEvent(userId: string, eventId: string, input: Partial<EventInput>): Promise<PhotographerEvent> {
  const current = await getMyEvent(userId, eventId);
  const v = validateEvent(input, false);
  const eventDate = v.eventDate ?? current.eventDate;
  const galleryExpiresAt = v.galleryExpiresAt ?? current.galleryExpiresAt;
  if (galleryExpiresAt < eventDate) throw new DomainError("Gallery expiry can't be before the event date.");
  await getDb()
    .update(events)
    .set({ ...v, updatedAt: new Date() })
    .where(and(eq(events.id, eventId), eq(events.photographerId, userId), isNull(events.deletedAt)));
  return getMyEvent(userId, eventId);
}

/** Soft delete (EVT-6): marks the event and everything under it. No rows and no files are removed. */
export async function deleteEvent(userId: string, eventId: string): Promise<void> {
  await assertOwnEvent(userId, eventId);
  await getDb().transaction(async (tx) => {
    await tx.execute(sql`update guest_photos set deleted_at = now()
      where deleted_at is null and photo_id in (select id from photos where event_id = ${eventId})`);
    await tx.execute(sql`update faces set deleted_at = now() where event_id = ${eventId} and deleted_at is null`);
    await tx.execute(sql`update photos set deleted_at = now() where event_id = ${eventId} and deleted_at is null`);
    await tx.execute(sql`update guests set deleted_at = now() where event_id = ${eventId} and deleted_at is null`);
    await tx.execute(sql`update events set deleted_at = now(), deleted_by = ${userId}, updated_at = now() where id = ${eventId}`);
  });
}

// ---------- photos (UPL-1..9) ----------

async function toPhotoItem(r: Raw): Promise<PhotoItem> {
  const status = r.status as PhotoStatus;
  const stored = status !== "pending_upload" && status !== "upload_failed";
  const original = stored ? String(r.original_key) : null;
  const storage = getStorage();
  const thumbKey = (r.thumb_key as string | null) ?? original;
  const previewKey = (r.web_key as string | null) ?? original;
  return {
    id: String(r.id),
    filename: String(r.original_filename),
    sizeBytes: Number(r.size_bytes),
    status,
    failReason: (r.fail_reason as string | null) ?? null,
    faceCount: r.face_count === null || r.face_count === undefined ? null : Number(r.face_count),
    takenAt: r.taken_at ? new Date(r.taken_at as string).toISOString() : null,
    uploadedAt: r.uploaded_at ? new Date(r.uploaded_at as string).toISOString() : null,
    thumbUrl: thumbKey ? await storage.presignGet(thumbKey, URL_TTL) : null,
    previewUrl: previewKey ? await storage.presignGet(previewKey, URL_TTL) : null,
  };
}

export type PhotoFilter = "all" | "ready" | "processing" | "failed";
const FILTERS: Record<PhotoFilter, ReturnType<typeof sql>> = {
  all: sql`true`,
  ready: sql`p.status = 'ready'`,
  processing: sql`p.status in ('pending_upload', 'uploaded', 'processing')`,
  failed: sql`p.status in ('failed', 'upload_failed')`,
};

/** Photos in capture-time order (GAL-4: EXIF time, falling back to upload time), 60 per page. */
export async function listPhotos(userId: string, eventId: string, filter: PhotoFilter = "all", page = 1, pageSize = 60): Promise<PhotoPage> {
  await assertOwnEvent(userId, eventId);
  const where = sql`p.event_id = ${eventId} and p.deleted_at is null and ${FILTERS[filter] ?? FILTERS.all}`;
  const offset = Math.max(0, (page - 1) * pageSize);
  const [rows, count] = await Promise.all([
    getDb().execute(sql`
      select p.* from photos p where ${where}
      order by coalesce(p.taken_at, p.uploaded_at, p.created_at), p.original_filename
      limit ${pageSize} offset ${offset}`),
    getDb().execute(sql`select count(*)::int as n from photos p where ${where}`),
  ]);
  return {
    photos: await Promise.all(rows.rows.map(toPhotoItem)),
    total: Number((count.rows[0] as Raw).n),
    page,
    pageSize,
  };
}

export interface UploadFileInput {
  name: string;
  size: number;
  type: string;
}

/**
 * UPL-7: validate a batch, create `pending_upload` rows and hand out one presigned PUT URL per file.
 * Files already uploaded to this event (same name and size) are skipped (UPL-5); earlier failed attempts are reused.
 */
export async function createUploads(userId: string, eventId: string, files: UploadFileInput[]): Promise<UploadBatchResult> {
  const event = await assertOwnEvent(userId, eventId);
  if (!Array.isArray(files) || files.length === 0) throw new DomainError("Choose at least one photo.");
  if (files.length > MAX_BATCH_FILES) throw new DomainError(`Upload at most ${MAX_BATCH_FILES} photos at a time.`);

  const result: UploadBatchResult = { uploads: [], skipped: [], rejected: [] };
  const wanted = new Map<string, UploadFileInput>();
  for (const f of files) {
    const name = String(f?.name ?? "").trim();
    const size = Number(f?.size);
    const isJpeg = /\.(jpe?g)$/i.test(name) && (!f.type || f.type === "image/jpeg" || f.type === "image/jpg");
    if (!name || name.length > 255) result.rejected.push({ name: name || "(no name)", reason: "Invalid file name." });
    else if (!isJpeg) result.rejected.push({ name, reason: "Only JPEG photos (.jpg, .jpeg) can be uploaded." });
    else if (!(size > 0)) result.rejected.push({ name, reason: "The file is empty." });
    else if (size > MAX_PHOTO_BYTES) result.rejected.push({ name, reason: "The file is larger than 15 MB." });
    else if (wanted.has(`${name}\n${size}`)) result.skipped.push({ name, reason: "Listed twice in this batch." });
    else wanted.set(`${name}\n${size}`, { name, size, type: "image/jpeg" });
  }
  if (wanted.size === 0) return result;

  const db = getDb();
  const names = [...new Set([...wanted.values()].map((f) => f.name))];
  const existing = await db
    .select({ id: photos.id, name: photos.originalFilename, size: photos.sizeBytes, status: photos.status, deletedAt: photos.deletedAt, key: photos.originalKey })
    .from(photos)
    .where(and(eq(photos.eventId, event.id), inArray(photos.originalFilename, names)));
  const byKey = new Map(existing.map((p) => [`${p.name}\n${p.size}`, p]));

  const reuse: string[] = [];
  const fresh: (typeof photos.$inferInsert)[] = [];
  const tickets: { photoId: string; key: string; name: string; size: number }[] = [];
  for (const [k, f] of wanted) {
    const prior = byKey.get(k);
    if (prior && !prior.deletedAt && prior.status !== "pending_upload" && prior.status !== "upload_failed") {
      result.skipped.push({ name: f.name, reason: "Already uploaded." });
    } else if (prior) {
      reuse.push(prior.id);
      tickets.push({ photoId: prior.id, key: prior.key, name: f.name, size: f.size });
    } else {
      const id = randomUUID();
      const key = `events/${event.id}/originals/${id}.jpg`;
      fresh.push({ id, eventId: event.id, originalKey: key, originalFilename: f.name, sizeBytes: f.size, status: "pending_upload" });
      tickets.push({ photoId: id, key, name: f.name, size: f.size });
    }
  }

  await db.transaction(async (tx) => {
    for (let i = 0; i < fresh.length; i += 1000) await tx.insert(photos).values(fresh.slice(i, i + 1000));
    if (reuse.length) {
      await tx
        .update(photos)
        .set({ status: "pending_upload", deletedAt: null, failReason: null, uploadedAt: null })
        .where(inArray(photos.id, reuse));
    }
  });

  const storage = getStorage();
  result.uploads = await Promise.all(
    tickets.map(async (t) => ({ photoId: t.photoId, name: t.name, size: t.size, url: await storage.presignPut(t.key, UPLOAD_TTL) })),
  );
  return result;
}

/**
 * UPL-8a: after the browser finished its PUTs, check each file really is in storage with the right size,
 * then mark it `uploaded` and queue a `process_photo` job in one transaction.
 */
export async function completeUploads(userId: string, eventId: string, photoIds: string[]) {
  await assertOwnEvent(userId, eventId);
  const ids = [...new Set((photoIds ?? []).filter((id) => typeof id === "string"))].slice(0, MAX_BATCH_FILES);
  if (ids.length === 0) return { uploaded: 0, failed: [] as string[] };
  const db = getDb();
  const rows = await db
    .select({ id: photos.id, key: photos.originalKey, size: photos.sizeBytes })
    .from(photos)
    .where(and(eq(photos.eventId, eventId), inArray(photos.id, ids), isNull(photos.deletedAt), inArray(photos.status, ["pending_upload", "upload_failed"])));

  const storage = getStorage();
  const ok: string[] = [];
  const failed: string[] = [];
  for (let i = 0; i < rows.length; i += 10) {
    const chunk = rows.slice(i, i + 10);
    const heads = await Promise.all(chunk.map((r) => storage.head(r.key)));
    chunk.forEach((r, j) => (heads[j] && heads[j]!.size === r.size ? ok : failed).push(r.id));
  }

  await db.transaction(async (tx) => {
    if (ok.length) {
      await tx.update(photos).set({ status: "uploaded", uploadedAt: new Date(), failReason: null }).where(inArray(photos.id, ok));
      await tx.insert(jobs).values(ok.map((photoId) => ({ type: "process_photo", payload: { photoId } })));
    }
    if (failed.length) {
      await tx.update(photos).set({ status: "upload_failed", failReason: "The file did not arrive in storage." }).where(inArray(photos.id, failed));
    }
  });
  return { uploaded: ok.length, failed };
}

/** UPL-8: the browser gave up on these files after its retries. */
export async function reportUploadFailures(userId: string, eventId: string, photoIds: string[]) {
  await assertOwnEvent(userId, eventId);
  const ids = (photoIds ?? []).filter((id) => typeof id === "string").slice(0, MAX_BATCH_FILES);
  if (!ids.length) return;
  await getDb()
    .update(photos)
    .set({ status: "upload_failed", failReason: "The upload did not finish." })
    .where(and(eq(photos.eventId, eventId), inArray(photos.id, ids), eq(photos.status, "pending_upload")));
}

async function ownedPhoto(userId: string, photoId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(photoId)) throw new DomainError("Photo not found.", 404);
  const [row] = await getDb()
    .select({ id: photos.id, status: photos.status, eventId: photos.eventId })
    .from(photos)
    .innerJoin(events, eq(events.id, photos.eventId))
    .where(and(eq(photos.id, photoId), eq(events.photographerId, userId), isNull(photos.deletedAt), isNull(events.deletedAt)));
  if (!row) throw new DomainError("Photo not found.", 404);
  return row;
}

/** Retry a photo whose processing failed: back to `uploaded` with a new job. Upload failures need the file again. */
export async function retryPhoto(userId: string, photoId: string): Promise<void> {
  const p = await ownedPhoto(userId, photoId);
  if (p.status === "upload_failed") throw new DomainError("This file never arrived. Upload it again from your computer.");
  if (p.status !== "failed") throw new DomainError("Only failed photos can be retried.");
  await getDb().transaction(async (tx) => {
    await tx.update(photos).set({ status: "uploaded", failReason: null }).where(eq(photos.id, photoId));
    await tx.insert(jobs).values({ type: "process_photo", payload: { photoId } });
  });
}

/** UPL-9: soft-delete photos together with their faces and guest matches, in one transaction. */
export async function deletePhotos(userId: string, eventId: string, photoIds: string[]): Promise<number> {
  await assertOwnEvent(userId, eventId);
  const ids = [...new Set((photoIds ?? []).filter((id) => typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id)))];
  if (!ids.length) throw new DomainError("Select at least one photo.");
  return getDb().transaction(async (tx) => {
    const marked = await tx
      .update(photos)
      .set({ deletedAt: new Date() })
      .where(and(eq(photos.eventId, eventId), inArray(photos.id, ids), isNull(photos.deletedAt)))
      .returning({ id: photos.id });
    const gone = marked.map((m) => m.id);
    if (gone.length) {
      await tx.execute(sql`update faces set deleted_at = now() where photo_id in ${gone} and deleted_at is null`);
      await tx.update(guestPhotos).set({ deletedAt: new Date() }).where(and(inArray(guestPhotos.photoId, gone), isNull(guestPhotos.deletedAt)));
    }
    return gone.length;
  });
}

// ---------- guests and originals (PHG-1..4) ----------

export async function listEventGuests(userId: string, eventId: string): Promise<EventGuest[]> {
  await assertOwnEvent(userId, eventId);
  const res = await getDb().execute(sql`
    select g.id, g.name, g.phone, g.created_at,
           (select count(*) from guest_photos gp join photos p on p.id = gp.photo_id
            where gp.guest_id = g.id and gp.deleted_at is null and p.deleted_at is null)::int as matched
    from guests g
    where g.event_id = ${eventId} and g.deleted_at is null
    order by g.created_at desc, g.name`);
  return res.rows.map((r: Raw) => ({
    id: String(r.id),
    name: String(r.name),
    phone: String(r.phone),
    registeredAt: new Date(r.created_at as string).toISOString(),
    matchedPhotos: Number(r.matched),
  }));
}

export async function guestMatchedPhotos(userId: string, eventId: string, guestId: string): Promise<{ guest: EventGuest; photos: PhotoItem[] }> {
  const guests = await listEventGuests(userId, eventId);
  const guest = guests.find((g) => g.id === guestId);
  if (!guest) throw new DomainError("Guest not found.", 404);
  const res = await getDb().execute(sql`
    select p.* from guest_photos gp join photos p on p.id = gp.photo_id
    where gp.guest_id = ${guestId} and gp.deleted_at is null and p.deleted_at is null
    order by coalesce(p.taken_at, p.uploaded_at, p.created_at), p.original_filename`);
  return { guest, photos: await Promise.all(res.rows.map(toPhotoItem)) };
}

/** PHG-3/4: short-lived download URLs for originals, for a browser-built zip, capped at 500 MB per batch. */
export async function originalDownloadUrls(userId: string, eventId: string, photoIds: string[]) {
  await assertOwnEvent(userId, eventId);
  const ids = [...new Set((photoIds ?? []).filter((id) => typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id)))];
  if (!ids.length) throw new DomainError("Select at least one photo.");
  const rows = await getDb()
    .select({ id: photos.id, key: photos.originalKey, name: photos.originalFilename, size: photos.sizeBytes })
    .from(photos)
    .where(and(eq(photos.eventId, eventId), inArray(photos.id, ids), isNull(photos.deletedAt), inArray(photos.status, ["uploaded", "processing", "ready", "failed"])));
  const total = rows.reduce((n, r) => n + r.size, 0);
  if (total > ORIGINALS_BATCH_BYTES) {
    throw new DomainError(`That is ${(total / 1024 ** 2).toFixed(0)} MB. Download at most 500 MB at a time; select fewer photos.`);
  }
  const storage = getStorage();
  return {
    totalBytes: total,
    files: await Promise.all(rows.map(async (r) => ({ photoId: r.id, name: r.name, size: r.size, url: await storage.presignGet(r.key, 15 * 60, r.name) }))),
  };
}
