import { seedEvents, seedGuests, seedPhotographers } from "./seed";
import {
  DomainError,
  type AdminEventRow,
  type EventRecord,
  type EventStatus,
  type GuestRecord,
  type GuestSearchRow,
  type Photographer,
  type PhotographerRow,
  type PhotographerStatus,
  type UsageSummary,
} from "./types";

// In-memory mock store. Kept on globalThis so it survives Next.js dev reloads and is shared by route handlers.
interface Store {
  photographers: Photographer[];
  events: EventRecord[];
  guests: GuestRecord[];
  nextPhotographer: number;
}

const g = globalThis as unknown as { __ipStore?: Store };
function store(): Store {
  g.__ipStore ??= {
    photographers: seedPhotographers(),
    events: seedEvents(),
    guests: seedGuests(),
    nextPhotographer: 8848,
  };
  return g.__ipStore;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const digits = (s: string) => s.replace(/\D/g, "");

export function formatIndianPhone(input: string): string | null {
  let d = digits(input);
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  if (d.length !== 10) return null;
  return `+91 ${d.slice(0, 5)} ${d.slice(5)}`;
}

function toRow(p: Photographer, events: EventRecord[]): PhotographerRow {
  // Soft-deleted events are included on purpose (ADM-1, D26).
  const mine = events.filter((e) => e.photographerId === p.id);
  return {
    ...p,
    events: mine.length,
    photos: mine.reduce((n, e) => n + e.photos, 0),
    guests: mine.reduce((n, e) => n + e.guests, 0),
    storageGb: round1(mine.reduce((n, e) => n + e.storageGb, 0)),
  };
}

export function listPhotographers(): PhotographerRow[] {
  const s = store();
  return s.photographers.map((p) => toRow(p, s.events));
}

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

export function createPhotographer(input: Partial<CreatePhotographerInput>): PhotographerRow {
  const name = input.name?.trim() ?? "";
  const studioName = input.studioName?.trim() ?? "";
  const email = input.email?.trim().toLowerCase() ?? "";
  if (!name) throw new DomainError("Name is required.");
  if (!studioName) throw new DomainError("Studio name is required.");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new DomainError("Enter a valid email address.");
  const phone = formatIndianPhone(input.phone ?? "");
  if (!phone) throw new DomainError("Enter a 10-digit Indian phone number.");
  validateTemporaryPassword(input.temporaryPassword ?? "");

  const s = store();
  if (s.photographers.some((p) => p.email === email)) {
    throw new DomainError("A photographer with this email already exists.", 409);
  }
  // The temporary password is not stored in the mock. Auth for photographers arrives with the database.
  const p: Photographer = {
    id: `p${s.photographers.length + 1}`,
    code: `PHO-${s.nextPhotographer++}`,
    name,
    studioName,
    email,
    phone,
    status: "active",
    mustChangePassword: true,
    createdAt: new Date().toISOString().slice(0, 10),
  };
  s.photographers.unshift(p);
  return toRow(p, s.events);
}

export function setPhotographerStatus(id: string, status: PhotographerStatus): PhotographerRow {
  if (status !== "active" && status !== "suspended") throw new DomainError("Invalid status.");
  const s = store();
  const p = s.photographers.find((x) => x.id === id);
  if (!p) throw new DomainError("Photographer not found.", 404);
  p.status = status;
  return toRow(p, s.events);
}

export function resetPhotographerPassword(id: string, temporaryPassword: string): PhotographerRow {
  validateTemporaryPassword(temporaryPassword);
  const s = store();
  const p = s.photographers.find((x) => x.id === id);
  if (!p) throw new DomainError("Photographer not found.", 404);
  p.mustChangePassword = true;
  return toRow(p, s.events);
}

export function listEvents(): AdminEventRow[] {
  const s = store();
  return s.events
    .filter((e) => e.deletedAt === null)
    .map((e) => ({
      id: e.id,
      code: e.code,
      name: e.name,
      photographerId: e.photographerId,
      studioName: s.photographers.find((p) => p.id === e.photographerId)?.studioName ?? "Unknown studio",
      eventDate: e.eventDate,
      venue: e.venue,
      photos: e.photos,
      guests: e.guests,
      galleryExpiresAt: e.galleryExpiresAt,
      status: e.status as EventStatus,
    }))
    .sort((a, b) => b.eventDate.localeCompare(a.eventDate));
}

export function getUsage(): UsageSummary {
  const s = store();
  const rows = listPhotographers();
  const deleted = s.events.filter((e) => e.deletedAt !== null);
  const live = s.events.filter((e) => e.deletedAt === null);
  return {
    totals: {
      storageGb: round1(s.events.reduce((n, e) => n + e.storageGb, 0)),
      photos: s.events.reduce((n, e) => n + e.photos, 0),
      guests: s.events.reduce((n, e) => n + e.guests, 0),
      events: s.events.length,
      activeEvents: live.filter((e) => e.status === "active").length,
      archivedEvents: live.filter((e) => e.status === "archived").length,
      activePhotographers: rows.filter((r) => r.status === "active").length,
      suspendedPhotographers: rows.filter((r) => r.status === "suspended").length,
      totalPhotographers: rows.length,
    },
    includedDeleted: {
      events: deleted.length,
      photos: deleted.reduce((n, e) => n + e.photos, 0),
      storageGb: round1(deleted.reduce((n, e) => n + e.storageGb, 0)),
    },
    perPhotographer: rows,
  };
}

export function searchGuests(query: string): GuestSearchRow[] {
  const q = digits(query);
  if (q.length < 4) throw new DomainError("Enter at least 4 digits of the phone number.");
  const s = store();
  return s.guests
    .filter((gst) => digits(gst.phone).includes(q))
    .map((gst) => {
      const ev = s.events.find((e) => e.id === gst.eventId);
      const studio = s.photographers.find((p) => p.id === ev?.photographerId);
      return { ...gst, eventName: ev?.name ?? "Unknown event", studioName: studio?.studioName ?? "Unknown studio" };
    });
}

/** Removes the guest's selfie, face vector, matches and sessions (ADM-7). In the mock: removes the record. */
export function deleteGuest(id: string): GuestRecord {
  const s = store();
  const i = s.guests.findIndex((x) => x.id === id);
  if (i === -1) throw new DomainError("Guest not found.", 404);
  const [removed] = s.guests.splice(i, 1);
  return removed;
}
