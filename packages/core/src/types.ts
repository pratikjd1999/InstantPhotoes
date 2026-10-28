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

export class DomainError extends Error {
  constructor(
    message: string,
    public status: 400 | 404 | 409 = 400,
  ) {
    super(message);
    this.name = "DomainError";
  }
}
