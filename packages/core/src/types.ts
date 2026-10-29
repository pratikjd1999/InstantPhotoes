export type PhotographerStatus = "active" | "suspended";
export type EventStatus = "active" | "archived";

export interface Photographer {
  id: string;
  code: string;
  name: string;
  studioName: string;
  email: string;
  phone: string;
  status: PhotographerStatus;
  mustChangePassword: boolean;
  createdAt: string;
}

export interface EventRecord {
  id: string;
  code: string;
  name: string;
  photographerId: string;
  eventDate: string;
  venue: string;
  photos: number;
  guests: number;
  storageGb: number;
  galleryExpiresAt: string;
  status: EventStatus;
  /** null = live. Soft-deleted events still count toward usage (PRD D26). */
  deletedAt: string | null;
}

export interface GuestRecord {
  id: string;
  name: string;
  phone: string;
  eventId: string;
  matchedPhotos: number;
}

// ---- API shapes ----

export interface PhotographerRow extends Photographer {
  events: number;
  photos: number;
  guests: number;
  storageGb: number;
}

export interface AdminEventRow {
  id: string;
  code: string;
  name: string;
  photographerId: string;
  studioName: string;
  eventDate: string;
  venue: string;
  photos: number;
  guests: number;
  galleryExpiresAt: string;
  status: EventStatus;
}

export interface UsageSummary {
  totals: {
    storageGb: number;
    photos: number;
    guests: number;
    events: number;
    activeEvents: number;
    archivedEvents: number;
    activePhotographers: number;
    suspendedPhotographers: number;
    totalPhotographers: number;
  };
  /** Part of the totals that belongs to soft-deleted events. */
  includedDeleted: { events: number; photos: number; storageGb: number };
  perPhotographer: PhotographerRow[];
}

export interface GuestSearchRow extends GuestRecord {
  eventName: string;
  studioName: string;
}

// ---- photographer area ----

export type PhotoStatus = "pending_upload" | "upload_failed" | "uploaded" | "processing" | "ready" | "failed";

export interface PhotographerProfile {
  userId: string;
  name: string;
  email: string;
  code: string;
  studioName: string;
  displayName: string;
  phone: string;
  website: string;
  instagram: string;
  logoUrl: string | null;
  brandImageUrl: string | null;
}

export interface EventStats {
  /** Photos that reached storage (uploaded, processing, ready, failed). */
  photos: number;
  ready: number;
  /** Uploaded and waiting for, or in, face processing. */
  processing: number;
  /** Processing failed or the upload never arrived. Both can be retried. */
  failed: number;
  guests: number;
  /** Guests with at least one matched photo (EVT-7). */
  matchedGuests: number;
  /** Bytes of the stored originals. */
  storageBytes: number;
}

export interface PhotographerEvent {
  id: string;
  name: string;
  eventDate: string;
  venue: string;
  publicCode: string;
  /** What the QR code encodes: {APP_URL}/e/{publicCode} (EVT-2). */
  publicUrl: string;
  status: EventStatus;
  galleryExpiresAt: string;
  createdAt: string;
  /** First photo of the event, for cards. Null until a photo is uploaded. */
  coverUrl: string | null;
  stats: EventStats;
}

export interface DashboardSummary {
  totals: { events: number; activeEvents: number; photos: number; processing: number; guests: number; storageBytes: number };
  events: PhotographerEvent[];
}

export interface PhotoItem {
  id: string;
  filename: string;
  sizeBytes: number;
  status: PhotoStatus;
  failReason: string | null;
  faceCount: number | null;
  takenAt: string | null;
  uploadedAt: string | null;
  /** Small image for grids: the thumbnail once processed, otherwise the original. Null if nothing is stored yet. */
  thumbUrl: string | null;
  /** Large image for the preview: web copy once processed, otherwise the original. */
  previewUrl: string | null;
}

export interface PhotoPage {
  photos: PhotoItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface EventGuest {
  id: string;
  name: string;
  phone: string;
  registeredAt: string;
  matchedPhotos: number;
}

export interface UploadTicket {
  photoId: string;
  name: string;
  size: number;
  url: string;
}

export interface UploadBatchResult {
  uploads: UploadTicket[];
  skipped: { name: string; reason: string }[];
  rejected: { name: string; reason: string }[];
}

export class DomainError extends Error {
  constructor(
    message: string,
    public status: 400 | 404 | 409 = 400,
  ) {
    super(message);
    this.name = "DomainError";
  }
}
