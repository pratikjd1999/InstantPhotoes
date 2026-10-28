// Dummy data for local development and demos. Same people, events and numbers as the earlier in-memory mock,
// so the admin screens look the same once they read from the database. Never runs in production (see seed.ts).

export interface SeedPhotographer {
  id: string;
  code: string;
  name: string;
  studioName: string;
  email: string;
  phone: string;
  status: "active" | "suspended";
  mustChangePassword: boolean;
  createdAt: string;
}

export interface SeedEvent {
  id: string;
  code: string;
  name: string;
  photographerId: string;
  eventDate: string;
  venue: string;
  /** Number of photo rows to generate. */
  photos: number;
  /** Number of guest rows to generate (the named guests below count toward this). */
  guests: number;
  status: "active" | "archived";
  expiresInDays?: number;
  /** Set for soft-deleted events: hidden in lists, still counted in usage (D26). */
  deletedAt?: string;
}

export interface SeedGuest {
  id: string;
  name: string;
  phone: string;
  eventId: string;
  matchedPhotos: number;
}

export const seedPhotographers: SeedPhotographer[] = [
  { id: "p1", code: "PHO-8841", name: "Kabir Sharma", studioName: "Kabir Sharma Photography", email: "kabir@sharmaphotography.in", phone: "+91 98201 44521", status: "active", mustChangePassword: false, createdAt: "2026-08-02" },
  { id: "p2", code: "PHO-8842", name: "Rohan Mehra", studioName: "Stories by Rohan Mehra", email: "rohan@storiesbyrohan.com", phone: "+91 98192 11094", status: "active", mustChangePassword: false, createdAt: "2026-08-09" },
  { id: "p3", code: "PHO-8843", name: "Priya Sundaram", studioName: "Lumière Wedding Co.", email: "priya@lumiereweddings.in", phone: "+91 98403 88120", status: "active", mustChangePassword: false, createdAt: "2026-08-21" },
  { id: "p4", code: "PHO-8844", name: "Arjun Rathore", studioName: "Royal Frames Jaipur", email: "arjun@royalframes.in", phone: "+91 94140 22319", status: "suspended", mustChangePassword: false, createdAt: "2026-09-01" },
  { id: "p5", code: "PHO-8845", name: "Vikram Nair", studioName: "House on the Clouds", email: "vikram@houseclouds.co", phone: "+91 98860 33901", status: "active", mustChangePassword: false, createdAt: "2026-09-05" },
  { id: "p6", code: "PHO-8846", name: "Aditya Sen", studioName: "Kolkata Candid Chronicles", email: "aditya@candidchronicles.in", phone: "+91 98300 77142", status: "suspended", mustChangePassword: false, createdAt: "2026-09-12" },
  { id: "p7", code: "PHO-8847", name: "Neha Kulkarni", studioName: "Frame & Fable", email: "neha@frameandfable.in", phone: "+91 98220 55018", status: "active", mustChangePassword: true, createdAt: "2026-10-20" },
];

export const seedEvents: SeedEvent[] = [
  { id: "e1", code: "EVT-2026-UDR-0091", name: "Aarav & Ananya Wedding", photographerId: "p1", eventDate: "2026-10-24", venue: "Taj Lake Palace, Udaipur", photos: 4820, guests: 512, status: "active" },
  { id: "e2", code: "EVT-2026-UDR-0084", name: "Dev & Rhea Sangeet", photographerId: "p1", eventDate: "2026-10-22", venue: "The Oberoi Udaivilas, Udaipur", photos: 2140, guests: 340, status: "active" },
  { id: "e3", code: "EVT-2026-JDH-0078", name: "Meera & Siddharth Vivah", photographerId: "p2", eventDate: "2026-10-14", venue: "Umaid Bhawan Palace, Jodhpur", photos: 6400, guests: 680, status: "active", expiresInDays: 30 },
  { id: "e4", code: "EVT-2026-MAA-0062", name: "Tanvi & Rohan Reception", photographerId: "p3", eventDate: "2026-10-18", venue: "ITC Grand Chola, Chennai", photos: 3910, guests: 410, status: "active" },
  { id: "e5", code: "EVT-2026-JAI-0054", name: "Karan & Shreya Sangeet", photographerId: "p5", eventDate: "2026-10-12", venue: "Alila Fort Bishangarh, Jaipur", photos: 5120, guests: 460, status: "active" },
  { id: "e6", code: "EVT-2026-BLR-0049", name: "Ishita & Varun Mehendi", photographerId: "p5", eventDate: "2026-10-26", venue: "Taj West End, Bengaluru", photos: 980, guests: 96, status: "active" },
  { id: "e7", code: "EVT-2026-JAI-0038", name: "Aditya & Pooja Engagement", photographerId: "p4", eventDate: "2026-08-18", venue: "Rambagh Palace, Jaipur", photos: 1890, guests: 210, status: "archived" },
  { id: "e8", code: "EVT-2026-CCU-0019", name: "Ishaan & Tara Cocktail", photographerId: "p6", eventDate: "2026-08-04", venue: "JW Marriott, Kolkata", photos: 2300, guests: 290, status: "archived" },
  { id: "e9", code: "EVT-2026-BOM-0066", name: "Zoya & Imran Nikah", photographerId: "p2", eventDate: "2026-09-20", venue: "The St. Regis, Mumbai", photos: 3150, guests: 355, status: "archived" },
  { id: "e10", code: "EVT-2026-DEL-0071", name: "Simran & Harjot Anand Karaj", photographerId: "p1", eventDate: "2026-09-27", venue: "Leela Palace, New Delhi", photos: 2760, guests: 301, status: "active", expiresInDays: 14 },
  { id: "e11", code: "EVT-2026-PNQ-0058", name: "Rhea & Kunal Haldi", photographerId: "p3", eventDate: "2026-09-10", venue: "Bhandarkar Hall, Pune", photos: 1240, guests: 150, status: "archived" },
  // Soft-deleted: hidden from the events list but still counted in usage (D26).
  { id: "e12", code: "EVT-2026-TEST-0001", name: "Test event (deleted)", photographerId: "p2", eventDate: "2026-09-02", venue: "Mumbai", photos: 300, guests: 4, status: "archived", deletedAt: "2026-09-03T10:00:00Z" },
  { id: "e13", code: "EVT-2026-TEST-0002", name: "Upload rehearsal (deleted)", photographerId: "p5", eventDate: "2026-09-08", venue: "Bengaluru", photos: 500, guests: 7, status: "archived", deletedAt: "2026-09-09T08:00:00Z" },
];

export const seedGuests: SeedGuest[] = [
  { id: "g1", name: "Simran Kaur", phone: "+91 98765 43210", eventId: "e1", matchedPhotos: 42 },
  { id: "g2", name: "Rahul Verma", phone: "+91 99887 10234", eventId: "e1", matchedPhotos: 18 },
  { id: "g3", name: "Anjali Desai", phone: "+91 98111 22334", eventId: "e2", matchedPhotos: 27 },
  { id: "g4", name: "Mohit Bansal", phone: "+91 97000 11223", eventId: "e3", matchedPhotos: 35 },
  { id: "g5", name: "Fatima Sheikh", phone: "+91 90040 55667", eventId: "e4", matchedPhotos: 12 },
  { id: "g6", name: "Karthik Iyer", phone: "+91 98400 99881", eventId: "e5", matchedPhotos: 51 },
  { id: "g7", name: "Divya Nair", phone: "+91 98450 66778", eventId: "e6", matchedPhotos: 6 },
  { id: "g8", name: "Simran Kaur", phone: "+91 98765 43210", eventId: "e10", matchedPhotos: 23 },
];
