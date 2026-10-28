import { randomBytes, randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { ensureSuperAdmin, superAdminsFromEnv } from "./admin-user";
import { createDb } from "./client";
import { seedEvents, seedGuests, seedPhotographers } from "./seed-data";
import { events, guestPhotos, guests, jobs, photoStatus, photographerProfiles, photos, user } from "./schema";

// Fills a local database with dummy data. Wipes the app tables first, so it is safe to re-run.
if (process.env.NODE_ENV === "production") {
  console.error("Refusing to seed: NODE_ENV is production.");
  process.exit(1);
}

const { db, pool } = createDb();

const MIB = 1024 * 1024;
const at = (day: string, time = "00:00:00") => new Date(`${day}T${time}Z`);
const plusDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const chunks = <T>(rows: T[], size: number) =>
  Array.from({ length: Math.ceil(rows.length / size) }, (_, i) => rows.slice(i * size, (i + 1) * size));

type PhotoStatus = (typeof photoStatus.enumValues)[number];

const FIRST = ["Aarav", "Diya", "Kabir", "Anaya", "Vihaan", "Ishani", "Reyansh", "Myra", "Arnav", "Kiara", "Dhruv", "Saanvi", "Aditya", "Riya", "Yash", "Tara"];
const LAST = ["Sharma", "Verma", "Iyer", "Nair", "Singh", "Patel", "Reddy", "Khan", "Gupta", "Joshi", "Menon", "Bose", "Kapoor", "Desai", "Rao", "Mehta"];

let fillerPhone = 0;
const nextFillerPhone = () => {
  // Distinct 6xxxxxxxxx range so filler guests never collide with the named ones.
  const d = String(6_000_000_000 + ++fillerPhone);
  return `+91 ${d.slice(0, 5)} ${d.slice(5)}`;
};

await db.transaction(async (tx) => {
  await tx.execute(
    sql`TRUNCATE login_attempts, guest_sessions, guest_photos, faces, jobs, guests, photos, events, photographer_profiles, session, account, verification, "user" CASCADE`,
  );

  // ---- photographers (no credentials yet: the photographer section and their login come later) ----
  await tx.insert(user).values(
    seedPhotographers.map((p) => ({
      id: `seed-${p.id}`,
      name: p.name,
      email: p.email,
      role: "photographer" as const,
      status: p.status,
      mustChangePassword: p.mustChangePassword,
      createdAt: at(p.createdAt),
      updatedAt: at(p.createdAt),
    })),
  );
  await tx.insert(photographerProfiles).values(
    seedPhotographers.map((p) => ({ userId: `seed-${p.id}`, code: p.code, studioName: p.studioName, phone: p.phone })),
  );

  // ---- events ----
  const eventId = new Map(seedEvents.map((e) => [e.id, randomUUID()]));
  await tx.insert(events).values(
    seedEvents.map((e) => ({
      id: eventId.get(e.id)!,
      photographerId: `seed-${e.photographerId}`,
      name: e.name,
      eventDate: e.eventDate,
      venue: e.venue,
      publicCode: e.code,
      status: e.status,
      galleryExpiresAt: plusDays(e.eventDate, e.expiresInDays ?? 7),
      createdAt: at(plusDays(e.eventDate, -30)),
      deletedAt: e.deletedAt ? new Date(e.deletedAt) : null,
    })),
  );

  // ---- photos ----
  // Sizes cycle 6.5 to 10.5 MiB (mean 8.5 MiB). The newest event is still being processed, so it shows every status.
  const photoIds = new Map<string, string[]>();
  const photoRows: (typeof photos.$inferInsert)[] = [];
  const jobRows: (typeof jobs.$inferInsert)[] = [];
  for (const e of seedEvents) {
    const evId = eventId.get(e.id)!;
    const deletedAt = e.deletedAt ? new Date(e.deletedAt) : null;
    const ids: string[] = [];
    for (let i = 0; i < e.photos; i++) {
      const id = randomUUID();
      ids.push(id);
      let status: PhotoStatus = "ready";
      if (e.id === "e6") status = i >= e.photos - 10 ? "failed" : i >= e.photos - 40 ? "processing" : "ready";
      const done = status === "ready";
      photoRows.push({
        id,
        eventId: evId,
        originalKey: `events/${evId}/originals/${id}.jpg`,
        webKey: done ? `events/${evId}/web/${id}.jpg` : null,
        thumbKey: done ? `events/${evId}/thumbs/${id}.jpg` : null,
        originalFilename: `IMG_${String(i + 1).padStart(4, "0")}.jpg`,
        sizeBytes: Math.round((6.5 + (i % 5)) * MIB),
        width: 6000,
        height: 4000,
        takenAt: new Date(at(e.eventDate, "10:00:00").getTime() + i * 20_000),
        status,
        failReason: status === "failed" ? "No decodable image data" : null,
        faceCount: done ? i % 7 : null,
        uploadedAt: at(e.eventDate, "23:00:00"),
        deletedAt,
      });
      if (status === "processing" || status === "failed") {
        jobRows.push({
          type: "process_photo",
          payload: { photoId: id },
          status: status === "failed" ? "failed" : "pending",
          attempts: status === "failed" ? 3 : 0,
          lastError: status === "failed" ? "No decodable image data" : null,
        });
      }
    }
    photoIds.set(e.id, ids);
  }
  for (const rows of chunks(photoRows, 2000)) await tx.insert(photos).values(rows);
  for (const rows of chunks(jobRows, 2000)) await tx.insert(jobs).values(rows);

  // ---- guests: the named ones first, then filler up to each event's guest count ----
  const guestRows: (typeof guests.$inferInsert)[] = [];
  const namedGuestId = new Map<string, string>();
  for (const e of seedEvents) {
    const evId = eventId.get(e.id)!;
    const deletedAt = e.deletedAt ? new Date(e.deletedAt) : null;
    const named = seedGuests.filter((g) => g.eventId === e.id);
    const row = (name: string, phone: string) => ({
      id: randomUUID(),
      eventId: evId,
      name,
      phone,
      accessToken: randomBytes(24).toString("hex"),
      consentAt: at(e.eventDate, "18:00:00"),
      createdAt: at(e.eventDate, "18:00:00"),
      deletedAt,
    });
    for (const g of named) {
      const r = row(g.name, g.phone);
      namedGuestId.set(g.id, r.id);
      guestRows.push(r);
    }
    for (let i = named.length; i < e.guests; i++) {
      guestRows.push(row(`${FIRST[i % FIRST.length]} ${LAST[(i * 7) % LAST.length]}`, nextFillerPhone()));
    }
  }
  for (const rows of chunks(guestRows, 2000)) await tx.insert(guests).values(rows);

  // ---- matches for the named guests: spread through the event's ready photos ----
  const matchRows: (typeof guestPhotos.$inferInsert)[] = [];
  for (const g of seedGuests) {
    const ids = photoIds.get(g.eventId)!;
    for (let k = 0; k < g.matchedPhotos; k++) {
      matchRows.push({
        guestId: namedGuestId.get(g.id)!,
        photoId: ids[k * 3],
        similarity: 0.62 + ((k * 13) % 35) / 100,
        matchedAt: at(seedEvents.find((e) => e.id === g.eventId)!.eventDate, "23:30:00"),
      });
    }
  }
  await tx.insert(guestPhotos).values(matchRows);

  console.log(
    `Seeded ${seedPhotographers.length} photographers, ${seedEvents.length} events, ${photoRows.length} photos, ${guestRows.length} guests, ${matchRows.length} matches, ${jobRows.length} jobs.`,
  );
});

// The Super Admins come from ADMIN_* / ADMIN2_* (same as `npm run db:create-admin`).
for (const admin of superAdminsFromEnv()) {
  await ensureSuperAdmin(db, admin);
  console.log(`Super Admin ready: ${admin.email.trim().toLowerCase()}`);
}

await pool.end();
