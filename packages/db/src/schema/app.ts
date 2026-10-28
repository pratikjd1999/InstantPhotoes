import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  unique,
  uuid,
  vector,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

// Application tables (PRD §8).
// Soft-delete rule: `deleted_at IS NULL` means live. Every read path filters on it, EXCEPT the usage and storage
// counts for the Super Admin (ADM-1, ADM-6, D26), which deliberately include soft-deleted rows.

const createdAt = () => timestamp({ withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp({ withTimezone: true }).notNull().defaultNow();
const deletedAt = () => timestamp({ withTimezone: true });

export const eventStatus = pgEnum("event_status", ["active", "archived"]);
export const photoStatus = pgEnum("photo_status", [
  "pending_upload",
  "upload_failed",
  "uploaded",
  "processing",
  "ready",
  "failed",
]);
export const jobStatus = pgEnum("job_status", ["pending", "running", "done", "failed"]);

export const photographerProfiles = pgTable("photographer_profiles", {
  userId: text()
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  /** Human-readable id shown to the Super Admin, e.g. PHO-8841. */
  code: text().notNull().unique(),
  studioName: text().notNull(),
  displayName: text(),
  /** Stored as entered by the admin, formatted "+91 98201 44521". */
  phone: text().notNull(),
  website: text(),
  instagram: text(),
  logoKey: text(),
  brandImageKey: text(),
  updatedAt: updatedAt(),
});

export const events = pgTable(
  "events",
  {
    id: uuid().primaryKey().defaultRandom(),
    photographerId: text()
      .notNull()
      .references(() => user.id),
    name: text().notNull(),
    eventDate: date({ mode: "string" }).notNull(),
    venue: text().notNull().default(""),
    /** Public identifier used in the QR link and shown to admins, e.g. EVT-2026-UDR-0091. */
    publicCode: text().notNull().unique(),
    status: eventStatus().notNull().default("active"),
    /** Last day guests can view their photos. Default is eventDate + 7 days (D11). */
    galleryExpiresAt: date({ mode: "string" }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
    deletedBy: text().references(() => user.id),
  },
  (t) => [index("events_photographer_idx").on(t.photographerId), index("events_live_idx").on(t.deletedAt)],
);

export const photos = pgTable(
  "photos",
  {
    id: uuid().primaryKey().defaultRandom(),
    eventId: uuid()
      .notNull()
      .references(() => events.id),
    originalKey: text().notNull(),
    webKey: text(),
    thumbKey: text(),
    originalFilename: text().notNull(),
    sizeBytes: bigint({ mode: "number" }).notNull(),
    width: integer(),
    height: integer(),
    /** EXIF capture time, used to order the gallery. */
    takenAt: timestamp({ withTimezone: true }),
    status: photoStatus().notNull().default("pending_upload"),
    failReason: text(),
    faceCount: integer(),
    uploadedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    deletedAt: deletedAt(),
  },
  (t) => [
    // Re-uploading the same file is a no-op (UPL dedupe).
    unique("photos_event_file_unique").on(t.eventId, t.originalFilename, t.sizeBytes),
    index("photos_event_status_idx").on(t.eventId, t.status),
  ],
);

export const faces = pgTable(
  "faces",
  {
    id: uuid().primaryKey().defaultRandom(),
    photoId: uuid()
      .notNull()
      .references(() => photos.id),
    eventId: uuid()
      .notNull()
      .references(() => events.id),
    embedding: vector({ dimensions: 128 }).notNull(),
    bbox: jsonb(),
    detScore: real(),
    createdAt: createdAt(),
    deletedAt: deletedAt(),
  },
  // Exact cosine search filtered by event_id is enough for beta (~15k faces per event). Add HNSW later if needed.
  (t) => [index("faces_event_idx").on(t.eventId), index("faces_photo_idx").on(t.photoId)],
);

export const guests = pgTable(
  "guests",
  {
    id: uuid().primaryKey().defaultRandom(),
    eventId: uuid()
      .notNull()
      .references(() => events.id),
    name: text().notNull(),
    phone: text().notNull(),
    selfieKey: text(),
    selfieEmbedding: vector({ dimensions: 128 }),
    /** Guest's private link token; the gallery URL contains it. */
    accessToken: text().notNull().unique(),
    consentAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => [unique("guests_event_phone_unique").on(t.eventId, t.phone), index("guests_phone_idx").on(t.phone)],
);

/** The guest's "virtual folder": matches are rows, never copies of the image (D10). */
export const guestPhotos = pgTable(
  "guest_photos",
  {
    guestId: uuid()
      .notNull()
      .references(() => guests.id),
    photoId: uuid()
      .notNull()
      .references(() => photos.id),
    similarity: real().notNull(),
    hiddenByGuest: boolean().notNull().default(false),
    matchedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    deletedAt: deletedAt(),
  },
  (t) => [primaryKey({ columns: [t.guestId, t.photoId] }), index("guest_photos_guest_idx").on(t.guestId)],
);

export const guestSessions = pgTable("guest_sessions", {
  id: text().primaryKey(),
  guestId: uuid()
    .notNull()
    .references(() => guests.id, { onDelete: "cascade" }),
  createdAt: createdAt(),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
  ip: text(),
  userAgent: text(),
});

/** Work queue for the face worker (`FOR UPDATE SKIP LOCKED`, D9). */
export const jobs = pgTable(
  "jobs",
  {
    id: uuid().primaryKey().defaultRandom(),
    type: text().notNull().default("process_photo"),
    payload: jsonb().notNull().default(sql`'{}'::jsonb`),
    status: jobStatus().notNull().default("pending"),
    attempts: integer().notNull().default(0),
    lastError: text(),
    runAfter: timestamp({ withTimezone: true }).notNull().defaultNow(),
    lockedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("jobs_status_run_after_idx").on(t.status, t.runAfter)],
);

/** Failed-login counter per client IP (AUTH-8). Kept in the database so it works across server instances. */
export const loginAttempts = pgTable("login_attempts", {
  key: text().primaryKey(),
  count: integer().notNull().default(0),
  resetAt: timestamp({ withTimezone: true }).notNull(),
});
