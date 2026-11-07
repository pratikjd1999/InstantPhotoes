import { createHash, randomBytes, randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { getDb } from "@instantphotos/db";
import { formatIndianPhone } from "./admin";
import type { RateLimit } from "./auth";
import { getStorage } from "./storage";
import { embedSelfie, matchGuest, type SelfieProblem } from "./worker";
import { DomainError, type GuestGalleryPage, type GuestPhoto, type PublicEvent } from "./types";

// Everything a guest can do (PRD §4.3, §4.4, §5.7, §5.8). Guests have no account: the gallery link holds an
// unguessable token, and the `guest_session` cookie proves this browser registered (or re-entered the phone number).

const URL_TTL = 60 * 60; // GAL-10: per-image signed URLs, 1 hour
export const GALLERY_PAGE_SIZE = 50; // GAL-4
export const MAX_SELFIE_BYTES = 5 * 1024 * 1024; // the browser shrinks selfies to ~300 KB before sending
export const GUEST_SESSION_COOKIE = "guest_session";
// Venue Wi-Fi and mobile carriers put many guests behind one IP, so registration is limited loosely.
export const REGISTER_RATE_LIMIT: RateLimit = { maxFailures: 60, windowSeconds: 15 * 60 };
// Per gallery link, so nobody can guess the phone number behind a forwarded link.
export const RECLAIM_RATE_LIMIT: RateLimit = { maxFailures: 5, windowSeconds: 15 * 60 };

type Raw = Record<string, unknown>;

const hashToken = (value: string) => createHash("sha256").update(value).digest("base64url");
const CODE = /^[A-Za-z0-9-]{4,40}$/;
const TOKEN = /^[A-Za-z0-9_-]{20,64}$/;
const UUID = /^[0-9a-f-]{36}$/i;

const EVENT_COLUMNS = sql`
  e.id as event_id, e.public_code, e.name as event_name, e.event_date::text as event_date, e.venue, e.status,
  e.gallery_expires_at::text as gallery_expires_at,
  (now() at time zone 'Asia/Kolkata')::date > e.gallery_expires_at as expired,
  pp.studio_name, pp.logo_key, pp.brand_image_key, pp.phone as studio_phone, pp.instagram, pp.website`;

async function toPublicEvent(r: Raw): Promise<PublicEvent> {
  const storage = getStorage();
  const sign = (key: unknown) => (key ? storage.presignGet(String(key), URL_TTL) : Promise.resolve(null));
  const [logoUrl, brandImageUrl] = await Promise.all([sign(r.logo_key), sign(r.brand_image_key)]);
  return {
    id: String(r.event_id),
    code: String(r.public_code),
    name: String(r.event_name),
    eventDate: String(r.event_date),
    venue: String(r.venue ?? ""),
    galleryExpiresAt: String(r.gallery_expires_at),
    state: r.expired ? "expired" : r.status === "archived" ? "closed" : "open",
    studio: {
      studioName: String(r.studio_name),
      logoUrl,
      brandImageUrl,
      phone: String(r.studio_phone ?? ""),
      instagram: String(r.instagram ?? ""),
      website: String(r.website ?? ""),
    },
  };
}

/** GST-1: the public event page. Null when the code is unknown or the event was deleted. */
export async function getPublicEvent(code: string): Promise<PublicEvent | null> {
  if (!CODE.test(code)) return null;
  const res = await getDb().execute(sql`
    select ${EVENT_COLUMNS}
    from events e join photographer_profiles pp on pp.user_id = e.photographer_id
    where e.public_code = ${code} and e.deleted_at is null`);
  return res.rows[0] ? toPublicEvent(res.rows[0] as Raw) : null;
}

// ---------- sessions (GST-9, GAL-1, PRD §12) ----------

export interface GuestSessionTicket {
  /** Cookie value. Only its hash is stored. */
  value: string;
  expiresAt: Date;
}

/** The session lasts until the end of the gallery's last day, India time (D11). */
const sessionExpiry = (galleryExpiresAt: string) => new Date(`${galleryExpiresAt}T23:59:59.999+05:30`);

async function createSession(guestId: string, galleryExpiresAt: string, ip?: string, userAgent?: string): Promise<GuestSessionTicket> {
  const value = randomBytes(32).toString("base64url");
  const expiresAt = sessionExpiry(galleryExpiresAt);
  await getDb().execute(sql`
    insert into guest_sessions (id, guest_id, expires_at, ip, user_agent)
    values (${hashToken(value)}, ${guestId}, ${expiresAt.toISOString()}::timestamptz, ${ip ?? null}, ${userAgent?.slice(0, 300) ?? null})`);
  return { value, expiresAt };
}

/** The gallery token of the guest this browser is signed in as, if they belong to `eventId`. Lets G01 offer "Open my photos". */
export async function signedInGalleryToken(eventId: string, sessionValue: string | undefined): Promise<string | null> {
  if (!sessionValue) return null;
  const res = await getDb().execute(sql`
    select g.access_token from guest_sessions s join guests g on g.id = s.guest_id
    where s.id = ${hashToken(sessionValue)} and s.expires_at > now() and g.event_id = ${eventId} and g.deleted_at is null`);
  return res.rows[0] ? String((res.rows[0] as Raw).access_token) : null;
}

// ---------- registration (GST-2..9) ----------

export interface GuestRegistration {
  name: string;
  phone: string;
  consent: boolean;
  selfie: Uint8Array | null;
  ip?: string;
  userAgent?: string;
}

export type RegistrationResult =
  | { ok: true; token: string; matched: number; session: GuestSessionTicket }
  | { ok: false; code: SelfieProblem; message: string };

const isJpeg = (b: Uint8Array) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;

/**
 * Stores the selfie, has the worker check it (exactly one clear face) and embed it, saves the guest and matches them
 * against every face already in the event. Re-registering with the same phone keeps the gallery link (GST-7).
 */
export async function registerGuest(code: string, input: GuestRegistration): Promise<RegistrationResult> {
  const name = input.name.trim().replace(/\s+/g, " ");
  if (!name || name.length > 80) throw new DomainError("Enter your name.");
  const phone = formatIndianPhone(input.phone);
  if (!phone) throw new DomainError("Enter a valid 10-digit mobile number.");
  if (!input.consent) throw new DomainError("Please tick the box to agree before continuing.");
  const selfie = input.selfie;
  if (!selfie?.length) throw new DomainError("Take a selfie so we can find your photos.");
  if (selfie.length > MAX_SELFIE_BYTES || !isJpeg(selfie)) throw new DomainError("We couldn't read that photo. Please take the selfie again.");

  // One round trip for the event and, for a returning guest (GST-7), their id.
  const db = getDb();
  const found = CODE.test(code)
    ? await db.execute(sql`
        select e.id, e.gallery_expires_at::text as gallery_expires_at,
               e.status = 'active' and (now() at time zone 'Asia/Kolkata')::date <= e.gallery_expires_at as open,
               (select g.id from guests g where g.event_id = e.id and g.phone = ${phone}) as guest_id
        from events e where e.public_code = ${code} and e.deleted_at is null`)
    : null;
  const event = found?.rows[0] as Raw | undefined;
  if (!event) throw new DomainError("We can't find this event.", 404);
  if (!event.open) throw new DomainError("This event is no longer taking new guests.", 409);
  const eventId = String(event.id);
  const guestId = event.guest_id ? String(event.guest_id) : randomUUID();

  // GST-5: events/{eventId}/selfies/{guestId}.jpg (PRD §9)
  const key = `events/${eventId}/selfies/${guestId}.jpg`;
  await getStorage().put(key, selfie, "image/jpeg");
  const embedded = await embedSelfie(key);
  if (!embedded.ok) return embedded;

  const vector = `[${embedded.embedding.join(",")}]`;
  const saved = await db.execute(sql`
    insert into guests (id, event_id, name, phone, selfie_key, selfie_embedding, access_token, consent_at)
    values (${guestId}, ${eventId}, ${name}, ${phone}, ${key}, ${vector}::vector, ${randomBytes(24).toString("base64url")}, now())
    on conflict (event_id, phone) do update set
      name = excluded.name, selfie_key = excluded.selfie_key, selfie_embedding = excluded.selfie_embedding,
      consent_at = excluded.consent_at, updated_at = now()
    returning id, access_token, (xmax <> 0) as existed`);
  const row = saved.rows[0] as Raw;
  const id = String(row.id);

  const [matched, session] = await Promise.all([
    (async () => {
      // A new selfie replaces the old matches. Photos the guest hid ("Not me") stay hidden.
      if (row.existed) await db.execute(sql`delete from guest_photos where guest_id = ${id} and not hidden_by_guest`);
      return matchGuest(id);
    })(),
    createSession(id, String(event.gallery_expires_at), input.ip, input.userAgent),
  ]);
  return { ok: true, token: String(row.access_token), matched, session };
}

// ---------- gallery (GAL-1..10) ----------

export type GalleryAccess =
  | { state: "not_found" }
  | { state: "expired"; event: PublicEvent }
  /** Valid link, but this browser has no session for the guest: ask for the phone number (GAL-2). */
  | { state: "locked"; event: PublicEvent }
  | { state: "ok"; event: PublicEvent; guest: { id: string; name: string } };

async function findGallery(token: string, sessionValue: string | undefined): Promise<Raw | null> {
  if (!TOKEN.test(token)) return null;
  const res = await getDb().execute(sql`
    select g.id as guest_id, g.name as guest_name, g.phone as guest_phone, ${EVENT_COLUMNS},
           exists (select 1 from guest_sessions s
                   where s.id = ${sessionValue ? hashToken(sessionValue) : ""} and s.guest_id = g.id and s.expires_at > now()) as signed_in
    from guests g
    join events e on e.id = g.event_id
    join photographer_profiles pp on pp.user_id = e.photographer_id
    where g.access_token = ${token} and g.deleted_at is null and e.deleted_at is null`);
  return (res.rows[0] as Raw | undefined) ?? null;
}

export async function openGallery(token: string, sessionValue: string | undefined): Promise<GalleryAccess> {
  const r = await findGallery(token, sessionValue);
  if (!r) return { state: "not_found" };
  const event = await toPublicEvent(r);
  if (r.expired) return { state: "expired", event };
  if (!r.signed_in) return { state: "locked", event };
  return { state: "ok", event, guest: { id: String(r.guest_id), name: String(r.guest_name) } };
}

/** For the gallery API: the guest id, or an error the page turns into the right screen. */
export async function requireGalleryGuest(token: string, sessionValue: string | undefined): Promise<string> {
  const r = await findGallery(token, sessionValue);
  if (!r) throw new DomainError("This gallery link isn't valid.", 404);
  if (r.expired) throw new DomainError("This gallery has expired. Please contact your photographer.", 410);
  if (!r.signed_in) throw new DomainError("Enter your mobile number to open this gallery.", 401);
  return String(r.guest_id);
}

/** Photos the guest can see: matched, not hidden ("Not me"), processed and not deleted. */
function visibleFrom(guestId: string) {
  return sql`
    from guest_photos gp join photos p on p.id = gp.photo_id
    where gp.guest_id = ${guestId} and gp.deleted_at is null and not gp.hidden_by_guest
      and p.deleted_at is null and p.status = 'ready' and p.web_key is not null`;
}

/** The web copy is always a JPEG, whatever the original was called. */
const jpgName = (original: string) => `${original.replace(/\.[^.]*$/, "") || "photo"}.jpg`;

/** GAL-4: matched photos in capture-time order, 50 per page. */
export async function galleryPage(guestId: string, page = 1): Promise<GuestGalleryPage> {
  const offset = Math.max(0, (page - 1) * GALLERY_PAGE_SIZE);
  const db = getDb();
  const [rows, count] = await Promise.all([
    db.execute(sql`
      select p.id, p.thumb_key, p.web_key, p.original_filename ${visibleFrom(guestId)}
      order by coalesce(p.taken_at, p.uploaded_at, p.created_at), p.original_filename, p.id
      limit ${GALLERY_PAGE_SIZE} offset ${offset}`),
    db.execute(sql`select count(*)::int as n ${visibleFrom(guestId)}`),
  ]);
  const storage = getStorage();
  const photos: GuestPhoto[] = await Promise.all(
    rows.rows.map(async (r: Raw) => {
      const web = String(r.web_key);
      const [thumbUrl, webUrl, downloadUrl] = await Promise.all([
        storage.presignGet(String(r.thumb_key ?? web), URL_TTL),
        storage.presignGet(web, URL_TTL),
        storage.presignGet(web, URL_TTL, jpgName(String(r.original_filename))),
      ]);
      return { id: String(r.id), thumbUrl, webUrl, downloadUrl };
    }),
  );
  return { photos, total: Number((count.rows[0] as Raw).n), page, pageSize: GALLERY_PAGE_SIZE };
}

/** GAL-7: every visible photo, for the zip the browser builds from the web copies. */
export async function galleryDownloadList(guestId: string): Promise<{ files: { name: string; url: string }[] }> {
  const rows = await getDb().execute(sql`
    select p.web_key, p.original_filename ${visibleFrom(guestId)}
    order by coalesce(p.taken_at, p.uploaded_at, p.created_at), p.original_filename, p.id`);
  const storage = getStorage();
  return {
    files: await Promise.all(
      rows.rows.map(async (r: Raw) => ({ name: jpgName(String(r.original_filename)), url: await storage.presignGet(String(r.web_key), URL_TTL) })),
    ),
  };
}

/** GAL-8: "Not me" hides the photo from this guest only. The row stays, so the threshold can be tuned later (PRD §10.3). */
export async function hideGuestPhoto(guestId: string, photoId: string): Promise<void> {
  if (!UUID.test(photoId)) throw new DomainError("Photo not found.", 404);
  const res = await getDb().execute(sql`
    update guest_photos set hidden_by_guest = true
    where guest_id = ${guestId} and photo_id = ${photoId} and deleted_at is null`);
  if (!res.rowCount) throw new DomainError("Photo not found.", 404);
}

/**
 * GAL-2: no cookie on this browser (new phone, WhatsApp's in-app browser, cleared data). The guest re-enters the phone
 * number they registered with; if it matches the guest the link belongs to, they get a new session.
 * Returns null when the number does not match.
 */
export async function reclaimGallery(token: string, phoneInput: string, ip?: string, userAgent?: string): Promise<GuestSessionTicket | null> {
  const r = await findGallery(token, undefined);
  if (!r) throw new DomainError("This gallery link isn't valid.", 404);
  if (r.expired) throw new DomainError("This gallery has expired. Please contact your photographer.", 410);
  const phone = formatIndianPhone(phoneInput);
  if (!phone) throw new DomainError("Enter a valid 10-digit mobile number.");
  if (phone !== r.guest_phone) return null;
  return createSession(String(r.guest_id), String(r.gallery_expires_at), ip, userAgent);
}
