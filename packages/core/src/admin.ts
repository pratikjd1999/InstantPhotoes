import { randomUUID } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { account, getDb, guestPhotos, guestSessions, guests, photographerProfiles, user } from "@instantphotos/db";
import { revokeUserSessions } from "./auth";
import {
  DomainError,
  type AdminEventRow,
  type EventStatus,
  type GuestRecord,
  type GuestSearchRow,
  type PhotographerRow,
  type PhotographerStatus,
  type UsageSummary,
} from "./types";

const round1 = (n: number) => Math.round(n * 10) / 10;
const digits = (s: string) => s.replace(/\D/g, "");
const GB = 1024 ** 3;

// A photo counts once it has reached the server: not while pending_upload or after upload_failed.
const COUNTED = sql`('uploaded', 'processing', 'ready', 'failed')`;

export function formatIndianPhone(input: string): string | null {
  let d = digits(input);
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  if (d.length !== 10) return null;
  return `+91 ${d.slice(0, 5)} ${d.slice(5)}`;
}

type Raw = Record<string, unknown>;

function toPhotographerRow(r: Raw): PhotographerRow {
  return {
    id: String(r.id),
    code: String(r.code),
    name: String(r.name),
    studioName: String(r.studio_name),
    email: String(r.email),
    phone: String(r.phone),
    status: r.status as PhotographerStatus,
    mustChangePassword: Boolean(r.must_change_password),
    createdAt: String(r.created_at),
    events: Number(r.events),
    photos: Number(r.photos),
    guests: Number(r.guests),
    storageGb: round1(Number(r.bytes) / GB),
  };
}

/**
 * Photographers with their event, photo, guest and storage totals.
 * Soft-deleted events are included on purpose (ADM-1, D26): deleting an event does not reduce usage.
 */
async function photographerRows(id?: string): Promise<PhotographerRow[]> {
  const res = await getDb().execute(sql`
    select u.id, pp.code, u.name, pp.studio_name, u.email, pp.phone, u.status, u.must_change_password,
           to_char(u.created_at at time zone 'UTC', 'YYYY-MM-DD') as created_at,
           coalesce(s.events, 0)::int as events, coalesce(s.photos, 0)::int as photos,
           coalesce(s.guests, 0)::int as guests, coalesce(s.bytes, 0)::float8 as bytes
    from "user" u
    join photographer_profiles pp on pp.user_id = u.id
    left join (
      select e.photographer_id, count(*)::int as events, sum(pc.n) as photos, sum(gc.n) as guests, sum(pc.bytes) as bytes
      from events e
      left join (select event_id, count(*) as n, sum(size_bytes) as bytes from photos where status in ${COUNTED} group by event_id) pc on pc.event_id = e.id
      left join (select event_id, count(*) as n from guests group by event_id) gc on gc.event_id = e.id
      group by e.photographer_id
    ) s on s.photographer_id = u.id
    where u.role = 'photographer' ${id ? sql`and u.id = ${id}` : sql``}
    order by u.created_at desc, pp.code desc`);
  return res.rows.map(toPhotographerRow);
}

async function photographerRow(id: string): Promise<PhotographerRow> {
  const [row] = await photographerRows(id);
  if (!row) throw new DomainError("Photographer not found.", 404);
  return row;
}

export const listPhotographers = () => photographerRows();

export interface CreatePhotographerInput {
  name: string;
  email: string;
  phone: string;
  studioName: string;
  temporaryPassword: string;
}

export function validateTemporaryPassword(pw: string) {
  if (pw.length < 10) throw new DomainError("Temporary password must be at least 10 characters.");
}

export async function createPhotographer(input: Partial<CreatePhotographerInput>): Promise<PhotographerRow> {
  const name = input.name?.trim() ?? "";
  const studioName = input.studioName?.trim() ?? "";
  const email = input.email?.trim().toLowerCase() ?? "";
  if (!name) throw new DomainError("Name is required.");
  if (!studioName) throw new DomainError("Studio name is required.");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new DomainError("Enter a valid email address.");
  const phone = formatIndianPhone(input.phone ?? "");
  if (!phone) throw new DomainError("Enter a 10-digit Indian phone number.");
  validateTemporaryPassword(input.temporaryPassword ?? "");

  const db = getDb();
  const [taken] = await db.select({ id: user.id }).from(user).where(eq(user.email, email));
  if (taken) throw new DomainError("A photographer with this email already exists.", 409);

  const passwordHash = await hashPassword(input.temporaryPassword!);
  const id = randomUUID();
  try {
    await db.transaction(async (tx) => {
      const [{ next }] = (
        await tx.execute(sql`select coalesce(max(substring(code from 5)::int), 8840) + 1 as next from photographer_profiles`)
      ).rows as { next: number }[];
      await tx.insert(user).values({ id, name, email, role: "photographer", status: "active", mustChangePassword: true });
      await tx.insert(account).values({ id: randomUUID(), userId: id, accountId: id, providerId: "credential", password: passwordHash });
      await tx.insert(photographerProfiles).values({ userId: id, code: `PHO-${next}`, studioName, phone });
    });
  } catch (err) {
    // Two admins creating the same email at once: the unique index decides.
    if ((err as { code?: string }).code === "23505") throw new DomainError("A photographer with this email already exists.", 409);
    throw err;
  }
  return photographerRow(id);
}

async function requirePhotographer(id: string) {
  const [row] = await getDb()
    .select({ id: user.id })
    .from(user)
    .where(and(eq(user.id, id), eq(user.role, "photographer")));
  if (!row) throw new DomainError("Photographer not found.", 404);
}

export async function setPhotographerStatus(id: string, status: PhotographerStatus): Promise<PhotographerRow> {
  if (status !== "active" && status !== "suspended") throw new DomainError("Invalid status.");
  await requirePhotographer(id);
  await getDb().update(user).set({ status, updatedAt: new Date() }).where(eq(user.id, id));
  if (status === "suspended") await revokeUserSessions(id);
  return photographerRow(id);
}

export async function resetPhotographerPassword(id: string, temporaryPassword: string): Promise<PhotographerRow> {
  validateTemporaryPassword(temporaryPassword);
  await requirePhotographer(id);
  const passwordHash = await hashPassword(temporaryPassword);
  const db = getDb();
  await db.transaction(async (tx) => {
    await tx.update(account).set({ password: passwordHash, updatedAt: new Date() }).where(and(eq(account.userId, id), eq(account.providerId, "credential")));
    await tx.update(user).set({ mustChangePassword: true, updatedAt: new Date() }).where(eq(user.id, id));
  });
  await revokeUserSessions(id);
  return photographerRow(id);
}

export async function listEvents(): Promise<AdminEventRow[]> {
  const res = await getDb().execute(sql`
    select e.id, e.public_code as code, e.name, e.photographer_id, pp.studio_name, e.event_date::text as event_date, e.venue,
           coalesce(pc.n, 0)::int as photos, coalesce(gc.n, 0)::int as guests, e.gallery_expires_at::text as gallery_expires_at, e.status
    from events e
    join photographer_profiles pp on pp.user_id = e.photographer_id
    left join (select event_id, count(*) as n from photos where deleted_at is null and status in ${COUNTED} group by event_id) pc on pc.event_id = e.id
    left join (select event_id, count(*) as n from guests where deleted_at is null group by event_id) gc on gc.event_id = e.id
    where e.deleted_at is null
    order by e.event_date desc, e.created_at desc`);
  return res.rows.map((r) => ({
    id: String(r.id),
    code: String(r.code),
    name: String(r.name),
    photographerId: String(r.photographer_id),
    studioName: String(r.studio_name),
    eventDate: String(r.event_date),
    venue: String(r.venue),
    photos: Number(r.photos),
    guests: Number(r.guests),
    galleryExpiresAt: String(r.gallery_expires_at),
    status: r.status as EventStatus,
  }));
}

export async function getUsage(): Promise<UsageSummary> {
  const db = getDb();
  // No deleted_at filter on purpose: soft-deleted data still counts toward usage and storage (ADM-1, ADM-6, D26).
  const [rows, totalsRes] = await Promise.all([
    photographerRows(),
    db.execute(sql`
      select
        (select count(*) from events)::int as events,
        (select count(*) from events where deleted_at is null and status = 'active')::int as active_events,
        (select count(*) from events where deleted_at is null and status = 'archived')::int as archived_events,
        (select count(*) from photos where status in ${COUNTED})::int as photos,
        (select coalesce(sum(size_bytes), 0) from photos where status in ${COUNTED})::float8 as bytes,
        (select count(*) from guests)::int as guests,
        (select count(*) from events where deleted_at is not null)::int as deleted_events,
        (select count(*) from photos p join events e on e.id = p.event_id where e.deleted_at is not null and p.status in ${COUNTED})::int as deleted_photos,
        (select coalesce(sum(p.size_bytes), 0) from photos p join events e on e.id = p.event_id where e.deleted_at is not null and p.status in ${COUNTED})::float8 as deleted_bytes`),
  ]);
  const t = totalsRes.rows[0] as Raw;
  return {
    totals: {
      storageGb: round1(Number(t.bytes) / GB),
      photos: Number(t.photos),
      guests: Number(t.guests),
      events: Number(t.events),
      activeEvents: Number(t.active_events),
      archivedEvents: Number(t.archived_events),
      activePhotographers: rows.filter((r) => r.status === "active").length,
      suspendedPhotographers: rows.filter((r) => r.status === "suspended").length,
      totalPhotographers: rows.length,
    },
    includedDeleted: {
      events: Number(t.deleted_events),
      photos: Number(t.deleted_photos),
      storageGb: round1(Number(t.deleted_bytes) / GB),
    },
    perPhotographer: rows,
  };
}

export async function searchGuests(query: string): Promise<GuestSearchRow[]> {
  const q = digits(query);
  if (q.length < 4) throw new DomainError("Enter at least 4 digits of the phone number.");
  const res = await getDb().execute(sql`
    select g.id, g.name, g.phone, g.event_id, e.name as event_name, pp.studio_name,
           (select count(*) from guest_photos gp where gp.guest_id = g.id and gp.deleted_at is null)::int as matched
    from guests g
    join events e on e.id = g.event_id
    join photographer_profiles pp on pp.user_id = e.photographer_id
    where g.deleted_at is null and regexp_replace(g.phone, '\D', '', 'g') like ${"%" + q + "%"}
    order by g.name, e.event_date desc
    limit 100`);
  return res.rows.map((r) => ({
    id: String(r.id),
    name: String(r.name),
    phone: String(r.phone),
    eventId: String(r.event_id),
    matchedPhotos: Number(r.matched),
    eventName: String(r.event_name),
    studioName: String(r.studio_name),
  }));
}

/**
 * Removes the guest's personal data (ADM-7): the guest row (name, phone, selfie reference, face vector),
 * their matches and their sessions. The selfie file in R2 is removed once storage is connected.
 */
export async function deleteGuest(id: string): Promise<GuestRecord> {
  const db = getDb();
  return db.transaction(async (tx) => {
    const [g] = await tx.select().from(guests).where(and(eq(guests.id, id), isNull(guests.deletedAt)));
    if (!g) throw new DomainError("Guest not found.", 404);
    const [{ n }] = (await tx.execute(sql`select count(*)::int as n from guest_photos where guest_id = ${id}`)).rows as { n: number }[];
    await tx.delete(guestSessions).where(eq(guestSessions.guestId, id));
    await tx.delete(guestPhotos).where(eq(guestPhotos.guestId, id));
    await tx.delete(guests).where(eq(guests.id, id));
    return { id: g.id, name: g.name, phone: g.phone, eventId: g.eventId, matchedPhotos: n };
  });
}
