# PRD — InstantPhotos: AI Event Photo Delivery (Beta)

| | |
|---|---|
| **Product name** | **InstantPhotos** |
| **Owner** | Pratik Jadhav |
| **Status** | Draft v1.1 — Beta scope |
| **Last updated** | 27 Oct 2026 |

---

## 1. Overview

### 1.1 Problem
At weddings and events, guests wait days or weeks to receive photos, and photographers spend hours sorting and sending images to individual people. Guests only want the photos they appear in.

### 1.2 Solution
A web application where photographers upload photos in batches **during the event**. The system detects and indexes every face. Guests scan a QR code, submit their name, phone number and a selfie, and instantly see a private gallery of every photo they appear in. The gallery keeps updating as new photos are uploaded.

### 1.3 Beta goal
Prove the core loop works reliably at real events:
**Photographer uploads → faces indexed → guest submits selfie → guest sees their photos.**

### 1.4 Success metrics (beta)
| Metric | Target |
|---|---|
| Photographers onboarded | 5–10 |
| Events run | 20 |
| Guests who find ≥ 1 photo of themselves | > 80% |
| Photo searchable after upload | ≤ 3 minutes |
| Selfie → gallery shown | < 5 seconds |
| Qualitative | Photographer feedback collected after every event |

---

## 2. Users and roles

| Role | Account? | How they get access | Lands on |
|---|---|---|---|
| **Super Admin** | Yes | Created once by a setup script | `/admin` |
| **Photographer** | Yes | Created by Super Admin with a temporary password | `/dashboard` |
| **Guest** | **No** | Scans event QR, submits form; recognised by a session cookie | `/g/{token}` |

- One login flow (email + password) for all account holders; role decides the dashboard.
- **Strict role separation:** Super Admin pages (`/admin/*`) and Photographer pages (`/dashboard/*`) are not interchangeable. Typing the other role's URL does not grant access (see AUTH-9, AUTH-10).
- **No public sign-up** in beta. Onboarding is invite-only via Super Admin.
- **Post-beta:** a fourth role, **Event Organiser**, will be added (see §14.1).

---

## 3. Beta scope

### 3.1 In scope
- Simple landing page with **Login** button and **"Contact us for access"** link
- Email/password login with roles (Super Admin, Photographer)
- Super Admin: create, suspend and reset photographers; view events and usage; delete a guest on request; **change own password**
- Server-enforced role separation between Super Admin and Photographer pages and APIs
- Photographer: profile and branding, create events, one QR per event, bulk upload, processing status, view guests, download originals
- Face detection and matching (self-hosted, free/commercial-safe models)
- Guest flow: QR → form (name, phone, selfie, consent) → instant web gallery
- Guest gallery: thumbnails grid, full-view, single download, download all, "Not me"
- Gallery expiry per event (default: event date + 7 days)

### 3.2 Out of scope (beta)
Google sign-in · public sign-up · payments · pricing/limits · WhatsApp delivery · album selection · AI pages · feature flags · SEO pages beyond the landing page · RAW/HEIC uploads · camera-to-cloud · sub-events · link-sharing protection · automatic data deletion · Spec Kit workflow · Event Organiser role.
All are listed in **§14 Post-beta roadmap**.

---

## 4. User journeys

### 4.1 Super Admin onboards a photographer
1. Super Admin logs in → `/admin/photographers` → **Add photographer**.
2. Enters name, email, phone, studio name, and a **temporary password**.
3. Shares the email + temporary password with the photographer (e.g. on WhatsApp).
4. Photographer logs in → is forced to **set a new password** → lands on `/dashboard`.

### 4.2 Photographer runs an event
1. Completes profile: studio name, logo, brand image, contact details.
2. Creates an event: name, date, venue. Gallery expiry defaults to event date + 7 days (editable).
3. Downloads the event **QR code** (PNG/PDF) to print or display at the venue.
4. During the event, drags and drops batches of JPEGs into the upload area.
5. Watches processing status per photo (uploaded → processing → ready / failed).
6. Sees the list of guests who registered and how many photos each matched.
7. Downloads originals (selected photos) for editing.

### 4.3 Guest finds their photos
1. Scans the QR → event page with the photographer's branding.
2. Enters **name**, **phone number**, takes a **selfie**, ticks the **consent checkbox**, submits.
3. Selfie is checked (exactly one clear face). If not OK → friendly retry message.
4. System matches the selfie against all faces already in the event.
5. A session cookie is set and the guest is taken to their gallery `/g/{token}`.
6. Gallery shows matched photos. New matches appear automatically as more photos are processed.
7. No matches yet → "We haven't found you yet — photos are still being uploaded. Check back later."

### 4.4 Guest returns later
- **Cookie present** → gallery opens directly.
- **Cookie missing** (new device, in-app browser, cleared data) → asked to re-enter phone number; if it matches the guest the link belongs to, a new cookie is set and the gallery opens.
- **Gallery expired** → "This gallery has expired. Please contact your photographer."

---

## 5. Functional requirements

### 5.1 Landing and authentication
| ID | Requirement |
|---|---|
| AUTH-1 | Landing page `/` with product intro, **Login** button and "Contact us for access" link. No sign-up. |
| AUTH-2 | Email + password login at `/login` for Super Admin and Photographer. |
| AUTH-3 | After login, redirect by role: Super Admin → `/admin`, Photographer → `/dashboard`. |
| AUTH-4 | Users created with a temporary password must change it at first login (`must_change_password`). |
| AUTH-5 | Super Admin account is created by a one-time seed script from environment variables. |
| AUTH-6 | Suspended users cannot log in; their existing sessions are revoked. |
| AUTH-7 | Logged-in users can change their own password. |
| AUTH-8 | Login is rate-limited to prevent password guessing. |
| AUTH-9 | **Super Admin cannot open Photographer pages.** A logged-in Super Admin who types or edits the URL to `/dashboard` or any `/dashboard/*` route is blocked (redirected to `/admin`; the matching photographer APIs return 403). |
| AUTH-10 | **Photographer cannot open Super Admin pages at all.** A logged-in Photographer who visits `/admin` or any `/admin/*` route is blocked (redirected to `/dashboard`; admin APIs return 403). Logged-out visitors to either area go to `/login`. |
| AUTH-11 | Role checks are enforced **on the server** (middleware plus a check in every page and API handler), never only by hiding links in the UI. |

### 5.2 Super Admin
| ID | Requirement |
|---|---|
| ADM-1 | List photographers with status, event count, photo count, storage used. **Soft-deleted events and their photos still count** in these numbers (the data still exists and still costs storage). |
| ADM-2 | Create photographer: name, email, phone, studio name, temporary password. |
| ADM-3 | Suspend / reactivate a photographer. |
| ADM-4 | Reset a photographer's password to a new temporary password. |
| ADM-5 | View all events across photographers (read-only). |
| ADM-6 | Usage view: total storage, photos, guests, per photographer and overall. Soft-deleted data **is included** in all totals (see D26). |
| ADM-7 | Delete a guest (selfie, face vector, matches, sessions) on request — for DPDP compliance. |
| ADM-8 | **Super Admin can change their own password** from `/admin/account` (current password + new password; other sessions are revoked on change). Same mechanism as AUTH-7, but reachable from inside the Super Admin area. |

### 5.3 Photographer profile and branding
| ID | Requirement |
|---|---|
| PRO-1 | Edit studio name, display name, phone, website, Instagram handle. |
| PRO-2 | Upload logo and brand image (JPEG/PNG, ≤ 5 MB). |
| PRO-3 | Branding (logo, studio name) is shown on the guest event page and gallery. |

### 5.4 Events
| ID | Requirement |
|---|---|
| EVT-1 | Create, edit, list events: name, event date, venue (optional). |
| EVT-2 | Each event gets a unique, random **public code**; QR encodes `https://{domain}/e/{code}`. |
| EVT-3 | Download QR as PNG and printable PDF. Layout of the downloaded QR: **photographer / studio name at the top**, event name and the QR code in the middle, and **"Powered by InstantPhotos"** at the bottom (the credit line wording is a single editable string, e.g. "Marketed by" / "Backed by"). |
| EVT-4 | `gallery_expires_at` defaults to event date + 7 days; photographer can change it. |
| EVT-5 | Event status: `active` / `archived`. Archived events reject new guest registrations. |
| EVT-6 | **Delete event = soft delete.** Requires confirmation. Nothing is physically deleted: the event and all its photos, faces, guests and matches are only **marked** with `deleted_at`, and the R2 files are left untouched. Soft-deleted data disappears from every screen and API (photographer, admin, guest), the event QR and all guest gallery links stop working, and matching ignores it. Permanent purge is out of scope for beta. |
| EVT-7 | Event detail shows: photo count, processing progress, guest count, matched-guest count. |

### 5.5 Photo upload
| ID | Requirement |
|---|---|
| UPL-1 | Drag-and-drop and file-picker bulk upload. |
| UPL-2 | **JPEG only**, max **25 MB** per file. Other files are rejected with a clear message. |
| UPL-3 | Browser uploads **directly to R2** using presigned URLs (files never pass through the app server). |
| UPL-4 | Parallel uploads (≈ 4 at a time) with per-file progress and automatic retry. |
| UPL-5 | Failed files can be retried; re-running a batch skips files already uploaded (same name + size in the event). |
| UPL-6 | Original filename is preserved and shown (for matching against the photographer's own files). |
| UPL-7 | Before uploading, the browser sends the batch (filename, size, type) to the app. The app validates it (JPEG, ≤ 25 MB, event ownership), creates one `photos` row per file with status `pending_upload`, and returns one presigned PUT URL per file (valid 15 minutes). |
| UPL-8 | The browser uploads each file directly to R2. R2 returns 200 + ETag on success or an error; the browser retries failed files up to 3 times and then reports them as `upload_failed`. |
| UPL-8a | After successful uploads, the browser calls the app's complete endpoint with the photo IDs. The app verifies each file with R2 `HeadObject` (exists, size matches) and, in one DB transaction, sets status `uploaded` and inserts a `process_photo` job. |
| UPL-8b | Cleanup sweep: every 10 minutes the worker checks `pending_upload` rows older than 15 minutes against R2. If the file exists, it is marked `uploaded` and queued; otherwise it is marked `upload_failed`. |
| UPL-8c | The dashboard shows per-photo status: `pending_upload` → `uploaded` → `processing` → `ready` / `failed`, plus `upload_failed`, with a Retry action for failed items. |
| UPL-9 | Photographer can delete individual photos. Deleting a photo must take away **everything tied to it in one action**: all versions (original, web copy, thumbnail), its detected faces, and all guest matches. Like EVT-6 this is a soft delete (`deleted_at` on the photo, its faces and its matches; R2 files kept), and the photo vanishes from every guest gallery and download immediately. |

### 5.6 Photo processing (face worker)
| ID | Requirement |
|---|---|
| PRC-1 | For each photo: download original from R2, apply EXIF rotation. |
| PRC-2 | Generate **web copy** (long edge 2048 px, ~500 KB) and **thumbnail** (long edge 400 px, ~30 KB); strip GPS/EXIF from both. |
| PRC-3 | Detect faces (YuNet). Ignore faces below a minimum size / confidence. |
| PRC-4 | Create a 128-dimension embedding for each face (SFace) and store it with its bounding box. |
| PRC-5 | Match each new face against all registered guests of the event; insert matches above threshold. |
| PRC-6 | Mark photo `ready` with face count. On error: retry up to 3 times, then `failed` with reason. |
| PRC-7 | Photo searchable within **3 minutes** of upload under beta load. |

### 5.7 Guest registration and matching
| ID | Requirement |
|---|---|
| GST-1 | Public event page `/e/{code}` shows event name and photographer branding. |
| GST-2 | Form: name, phone (Indian 10-digit, stored as +91…), selfie (front camera capture or file), consent checkbox (required). |
| GST-3 | Consent text: _"I agree that my selfie will be used to find my photos from this event."_ |
| GST-4 | Selfie validation: exactly **one** clear face. Zero or multiple faces → retry message. |
| GST-5 | Selfie stored in R2 under the event; embedding stored on the guest record. |
| GST-6 | Match selfie against all existing faces in the event; store matches. Response in **< 5 s**. |
| GST-7 | Phone number is unique per event. Re-registering with the same phone updates the selfie, re-runs matching and keeps the same gallery link. |
| GST-8 | Registration rejected if the event is archived or the gallery has expired. |
| GST-9 | On success: set guest session cookie, redirect to `/g/{token}`. |

### 5.8 Guest gallery
| ID | Requirement |
|---|---|
| GAL-1 | Access requires a valid gallery token **and** a guest session cookie for that guest. |
| GAL-2 | No cookie → "Enter your phone number" → if it matches the guest, set a new cookie and show the gallery. |
| GAL-3 | Expired gallery (`now > gallery_expires_at`) → expiry message with photographer contact. |
| GAL-4 | Grid of thumbnails **sorted by capture time** (EXIF `taken_at`; falls back to upload time when EXIF is missing), paginated by 50 (infinite scroll). The same default order is used for the photographer's photo list. |
| GAL-5 | Tap → full-screen web copy with swipe navigation. |
| GAL-6 | Download single photo (web copy). |
| GAL-7 | **Download all** → zip built in the browser from the web copies (no server load). |
| GAL-8 | **"Not me"** hides a photo from this guest's gallery only. |
| GAL-9 | Empty state when there are no matches yet. |
| GAL-10 | Images served via **per-image signed URLs** valid for **1 hour**, regenerated on each visit. |
| GAL-11 | Mobile-first design; works in Chrome (Android) and Safari (iOS). |

### 5.9 Photographer: guests and originals
| ID | Requirement |
|---|---|
| PHG-1 | View guests of an event: name, **full phone number (not masked)**, registered time, number of matched photos. |
| PHG-2 | View a guest's matched photos. |
| PHG-3 | Select photos and download **originals** (browser-built zip, capped per batch, e.g. 500 MB). |
| PHG-4 | Originals are only accessible to the owning photographer, through the photographer APIs. Super Admin does not use photographer pages (AUTH-9). |

---

## 6. Non-functional requirements

| Area | Requirement |
|---|---|
| **Scale (per event)** | ~3,000 photos, ~300 guests, ~50 guests searching at the same time |
| **Performance** | Selfie → gallery < 5 s; upload → searchable ≤ 3 min; gallery first page < 2 s on 4G |
| **Availability** | Best effort for beta; worker auto-restarts (`restart: always`) |
| **Security** | Private R2 bucket; signed URLs; httpOnly cookies; role checks on every API route; worker endpoint protected by shared secret and not publicly exposed |
| **Privacy** | Consent captured with timestamp; no automatic deletion in beta; manual guest deletion by Super Admin; GPS stripped from guest-visible images |
| **Observability** | Error tracking (Sentry free tier); job failures visible in dashboards; structured logs on worker |
| **Backups** | Neon point-in-time restore (free tier window); R2 is the image source of truth |
| **Browsers** | Latest Chrome, Safari, Edge; mobile-first for guest pages |

---

## 7. Architecture

### 7.1 Components
```
  Photographer / Guest (browser)
          │                         ▲
          │ pages + /api            │ images via signed URLs (direct from R2)
          ▼                         │
  ┌───────────────────────────┐     │
  │ Next.js app + Hono API    │     │
  │ (Cloudflare)              │     │
  └──┬──────────────┬─────────┘     │
     │ SQL          │ HTTPS via Cloudflare Tunnel
     │              │ POST /embed-selfie
     ▼              ▼
  ┌──────────────┐  ┌──────────────────────────────┐   S3 API   ┌──────────────────┐
  │ Neon Postgres│◀─│ Face worker (Python, Docker) │◀──────────▶│ Cloudflare R2    │
  │ + pgvector   │  │ Oracle Always Free VM        │            │ (private bucket) │
  │ + jobs table │  │  • job loop (photos)         │            └──────────────────┘
  └──────────────┘  │  • /embed-selfie endpoint    │                     ▲
                    └──────────────────────────────┘                     │
  Next.js also issues presigned upload/view URLs for R2 ─────────────────┘
```

### 7.2 Tech decisions
| Layer | Choice | Notes |
|---|---|---|
| Web app | **Next.js + TypeScript**, Tailwind, shadcn/ui | One app for frontend and API |
| API | **Hono**, mounted at `app/api/[[...route]]/route.ts` | Can be moved to its own server later without rewrite |
| Auth | **Better Auth** — email/password + admin plugin | Roles, sessions, create/suspend users |
| ORM | **Drizzle** | Shared schema in `packages/db` |
| Database | **Neon Postgres + pgvector** | Free tier ~1 GB per project (verify) |
| Image storage | **Cloudflare R2** (S3-compatible API) | 10 GB free, zero egress fees |
| Face worker | **Python, FastAPI, OpenCV YuNet + SFace** | Apache-2.0 models, CPU only |
| Queue | **Postgres `jobs` table** (`FOR UPDATE SKIP LOCKED`) | No Redis needed for beta |
| Worker hosting | **Oracle Cloud Always Free ARM VM**, Docker | Fallback: small paid VPS |
| Web hosting | **Cloudflare** (OpenNext adapter) | Free plan CPU limits may require the $5/month Workers plan; alternative: Docker on the same VM |
| Worker exposure | **Cloudflare Tunnel** + shared-secret header | No open ports on the VM |
| Monitoring | Sentry (free) | |
| UI design | **Google Stitch** | All screen designs, logos and UI assets are produced in Google Stitch and handed over for implementation. Code follows the Stitch designs; no designs or logos are invented in code. Until a Stitch design exists for a screen, use plain placeholder UI. |

### 7.3 Code structure (monorepo)
```
apps/web        → Next.js (pages + Hono API)
apps/worker     → Python face worker
packages/core   → business logic (createEvent, registerGuest, matchSelfie, …)
packages/db     → Drizzle schema, migrations, queries
```
**Rules:** route handlers only call `packages/core`; the frontend talks to the backend only through `/api` (Hono RPC client); no direct DB access in Server Components or Server Actions.

### 7.4 Communication between app and worker
| Flow | Mechanism |
|---|---|
| Photo processing | App inserts rows in `jobs`; worker polls (or wakes via `LISTEN/NOTIFY`), locks with `SKIP LOCKED`, processes, writes results to Postgres. |
| Selfie embedding | App calls `POST /embed-selfie` on the worker over HTTPS through Cloudflare Tunnel with a shared secret; worker returns the 128-d vector; app runs the pgvector search. |
| Images | Both read/write R2 directly via the S3 API. No files are sent between app and worker. |

---

## 8. Data model

> Better Auth also creates its own `user`, `session`, `account`, `verification` tables. Custom fields below are added to `user`.

**user** (Better Auth + custom)
`id, name, email, email_verified, password_hash (in account), role ['super_admin' | 'photographer'], status ['active' | 'suspended'], must_change_password bool, created_at, updated_at`

**photographer_profiles**
`user_id PK/FK, studio_name, display_name, phone, website, instagram, logo_key, brand_image_key, updated_at`

**events**
`id, photographer_id FK, name, event_date, venue, public_code UNIQUE, status ['active' | 'archived'], gallery_expires_at, created_at, updated_at, deleted_at (null = live), deleted_by FK`

**photos**
`id, event_id FK, original_key, web_key, thumb_key, original_filename, size_bytes, width, height, taken_at (EXIF), status ['pending_upload' | 'upload_failed' | 'uploaded' | 'processing' | 'ready' | 'failed'], fail_reason, face_count, uploaded_at, deleted_at`

| Status | Set by |
|---|---|
| pending_upload | App, when issuing presigned URLs |
| upload_failed | App (browser report) or cleanup sweep |
| uploaded + job inserted | App, after R2 HeadObject check |
| processing / ready / failed | Face worker |

Unique: `(event_id, original_filename, size_bytes)`

**faces**
`id, photo_id FK, event_id FK, embedding vector(128), bbox jsonb, det_score, created_at, deleted_at`
Index: `btree(event_id)`

**guests**
`id, event_id FK, name, phone, selfie_key, selfie_embedding vector(128), access_token UNIQUE, consent_at, created_at, updated_at, deleted_at`
Unique: `(event_id, phone)`

**guest_photos** — the guest's "virtual folder"
`guest_id FK, photo_id FK, similarity, hidden_by_guest bool default false, matched_at, deleted_at`
PK: `(guest_id, photo_id)`

**Soft-delete rule:** `deleted_at IS NULL` means live. Every query, signed-URL generator and matching search must filter on it. **Exception: usage and storage counts (ADM-1, ADM-6) do not filter on it**, so soft-deleted data still counts. Deleting an event or photo sets `deleted_at` on the row and on all its dependent rows in one transaction; no rows or R2 objects are removed.

**guest_sessions**
`id (random), guest_id FK, created_at, expires_at, ip, user_agent`

**jobs**
`id, type ['process_photo'], payload jsonb, status ['pending' | 'running' | 'done' | 'failed'], attempts, last_error, run_after, locked_at, created_at`
Index: `(status, run_after)`

**Matching note:** each event holds ~15,000 faces. For beta, use **exact cosine search filtered by `event_id`** (fast at this size and always correct). Add an HNSW index later if events grow much larger.

---

## 9. Storage layout (Cloudflare R2)

Single private bucket. "Folders" are key prefixes and cost nothing.

```
events/{eventId}/originals/{photoId}.jpg   ← photographer + admin only
events/{eventId}/web/{photoId}.jpg         ← guest full view and downloads
events/{eventId}/thumbs/{photoId}.jpg      ← gallery grid
events/{eventId}/selfies/{guestId}.jpg     ← guest selfies
photographers/{userId}/branding/logo.{ext}
photographers/{userId}/branding/brand.{ext}
```

- Matched photos are **never copied** per guest; matches live in `guest_photos`.
- Access is always through **per-image signed URLs** (1 hour for guests).

**Estimated beta storage cost**
| | Per wedding (~3,000 photos) | Monthly cost |
|---|---|---|
| Originals (~10 MB) | ~30 GB | ~$0.45 |
| Web copies + thumbnails | ~1.6 GB | ~$0.02 |
| Selfies (~300 × 200 KB) | ~0.06 GB | negligible |
| **10 weddings** | **~315 GB** | **~$4.70 (~₹400)** |

---

## 10. Face matching pipeline

### 10.1 Photo processing (worker job loop)
```
take pending job → download original → fix EXIF rotation
→ create web copy + thumbnail → upload both to R2
→ detect faces (YuNet) → embed each face (SFace, 128-d) → insert into faces
→ compare new faces with guests.selfie_embedding in this event → insert guest_photos
→ mark photo ready
```

### 10.2 Guest selfie
```
Next.js receives form → stores selfie in R2 → POST /embed-selfie to worker
→ worker validates exactly one face, returns embedding
→ Next.js saves guest + embedding → cosine search over faces WHERE event_id = X
→ insert guest_photos → set cookie → redirect to gallery
```

### 10.3 Threshold and quality
- Start with OpenCV's recommended SFace cosine-similarity threshold (~0.363) and **tune it on a labelled test set** of real wedding photos before launch.
- Minimum face size and detection confidence filter out tiny or blurry background faces.
- "Not me" feedback is stored and can be used to tune the threshold later.
- Known weak spots: low light, side profiles, partially covered faces.

---

## 11. Pages and API outline

### 11.1 Pages
| Route | Who | Purpose |
|---|---|---|
| `/` | Public | Landing page |
| `/login`, `/change-password` | Account holders | Auth |
| `/admin`, `/admin/photographers`, `/admin/events`, `/admin/usage`, `/admin/account` | Super Admin only (Photographer is blocked) | Administration, change own password |
| `/dashboard`, `/dashboard/profile` | Photographer only (Super Admin is blocked) | Overview, branding |
| `/dashboard/events/new`, `/dashboard/events/[id]` | Photographer only (Super Admin is blocked) | Event: upload, photos, guests, QR, settings |
| `/e/[code]` | Guest | Event page and registration form |
| `/g/[token]` | Guest | Personal gallery |

### 11.2 API (Hono, under `/api`)
**Auth** — `/api/auth/*` (Better Auth)

**Admin** (role: super_admin)
- `GET/POST /admin/photographers` · `PATCH /admin/photographers/:id` (suspend/reactivate)
- `POST /admin/photographers/:id/reset-password`
- `GET /admin/events` · `GET /admin/usage` · `DELETE /admin/guests/:id`

**Photographer** (role: photographer, own data only)
- `GET/PATCH /me/profile` · `POST /me/profile/branding-upload-url`
- `GET/POST /events` · `GET/PATCH/DELETE /events/:id` · `GET /events/:id/qr`
- `POST /events/:id/uploads` → validate batch, create `pending_upload` rows, return presigned PUT URLs
- `POST /events/:id/uploads/complete` → verify files in R2 (HeadObject), set `uploaded`, queue jobs
- `GET /events/:id/photos` (status, paginated) · `POST /photos/:id/retry` · `DELETE /photos/:id`
- `GET /events/:id/guests` · `GET /events/:id/guests/:guestId/photos`
- `POST /events/:id/originals/download-urls`

**Public / guest**
- `GET /public/events/:code` → event name, branding, open/closed
- `POST /public/events/:code/guests` → register (name, phone, selfie, consent); sets cookie
- `GET /public/gallery/:token?cursor=` → matched photos with signed URLs
- `POST /public/gallery/:token/hide/:photoId` → "Not me"
- `POST /public/gallery/:token/reclaim` → re-enter phone when cookie is missing

**Worker (internal, shared secret, via tunnel)**
- `POST /embed-selfie` · `GET /health`

---

## 12. Security and privacy

- **Bucket:** private; no public listing. All access via signed URLs.
- **Guest cookie:** `guest_session`, `HttpOnly; Secure; SameSite=Lax; Max-Age = until gallery_expires_at; Domain=.{domain}`; mapped to `guest_sessions`. (`Lax` is required so the cookie is sent when links are opened from WhatsApp.)
- **Tokens:** gallery tokens and event codes are random and unguessable (≥ 128-bit for gallery tokens).
- **Authorisation:** every photographer API checks ownership of the event/photo; admin routes check role. Role separation is enforced server-side in both directions: Super Admin → `/dashboard/*` and Photographer → `/admin/*` are always refused, even when the URL is typed by hand (AUTH-9, AUTH-10, AUTH-11).
- **Worker:** reachable only through Cloudflare Tunnel; rejects requests without the shared secret.
- **Consent:** stored with timestamp (`consent_at`) per guest.
- **Retention:** no automatic deletion in beta. Deleting an event or photo is a soft delete (data kept, hidden everywhere). Super Admin can delete a guest's data on request (DPDP).
- **Rate limits:** login, guest registration and gallery reclaim endpoints.
- **Accepted beta risk:** a forwarded gallery link plus knowledge of the guest's phone number gives access. Fixed post-beta (§14).

---

## 13. Delivery plan (phases)

| Phase | Deliverable | Done when |
|---|---|---|
| **0. Setup** | Monorepo, Neon + pgvector, R2 bucket, Oracle VM + Docker, Cloudflare Tunnel, Sentry, CI, `CLAUDE.md` with decisions | App and worker deploy; health checks pass |
| **1. Auth and admin** | Landing page, login, roles, seed Super Admin, create/suspend/reset photographers, forced password change | Admin can onboard a photographer who can log in |
| **2. Profile and events** | Branding upload, event CRUD, public code, QR download, gallery expiry | Photographer creates an event and downloads its QR |
| **3. Upload and processing** | Direct-to-R2 bulk upload, jobs queue, worker creates web copy + thumbnail, status UI, upload confirmation with R2 HeadObject check, cleanup sweep for stuck uploads | 500 photos upload and show `ready` |
| **4. Face indexing and guest flow** | Face detection + embeddings, `/embed-selfie`, guest form, selfie validation, matching both directions, cookie | Guest submits selfie and gets correct matches in < 5 s |
| **5. Gallery** | Gallery page, signed URLs, full view, download single/all, "Not me", reclaim, expiry | Guest can browse and download their photos on mobile |
| **6. Beta hardening** | Threshold tuning on test set, load test (50 concurrent guests), admin usage view, guest deletion, monitoring | Metrics in §1.4 met in a rehearsal event |

---

## 14. Post-beta roadmap

### 14.1 Event Organiser role

**Who:** the person or group managing an event on the client side, for example the host family, the couple, a group admin, a wedding planner, or a corporate event manager.

**Purpose:** let the organiser see **all photos of their event as they are**, not only the photos they appear in, without needing the photographer's account.

**Access and login**
| ID | Requirement |
|---|---|
| ORG-1 | Organisers have a login (same email + password flow as other roles) with role `organiser`. |
| ORG-2 | A photographer adds an organiser to one of their events (name, email, phone, temporary password). Super Admin can also add one. |
| ORG-3 | First login forces a password change (same as photographers). |
| ORG-4 | After login, organisers land on `/organiser`, listing the events they are assigned to. |
| ORG-5 | One event can have several organisers; one organiser can be assigned to several events. |
| ORG-6 | The photographer can remove an organiser from an event at any time. |

**What organisers can do**
| ID | Requirement |
|---|---|
| ORG-7 | View **all photos** of their assigned events (thumbnail grid + full-screen web copy), not filtered by face. |
| ORG-8 | Download web copies (single or browser-built zip). |
| ORG-9 | See new photos as soon as they are processed. |
| ORG-10 | Cannot upload, delete or edit photos, and cannot change event settings. |
| ORG-11 | Original-quality downloads only if the photographer enables it per organiser (`can_download_originals`, off by default). |

**Data model additions**
- `user.role` gains the value `'organiser'`.
- New table **event_organisers**: `event_id FK, user_id FK, added_by FK, can_download_originals bool default false, created_at` — PK `(event_id, user_id)`.

**Pages and API additions**
- Pages: `/organiser`, `/organiser/events/[id]`.
- Photographer API: `GET/POST /events/:id/organisers` · `PATCH/DELETE /events/:id/organisers/:userId`.
- Organiser API: `GET /organiser/events` · `GET /organiser/events/:id/photos?cursor=` · `POST /organiser/events/:id/download-urls`.

**Open questions for this role**
1. Should organisers see the guest list (names, phone numbers)?
2. Should organiser access expire with `gallery_expires_at`, or last longer?
3. Should the organiser be the person who does **album selection** (see Product list below)?

### 14.2 Other post-beta items

**Link and image protection (priority after beta)**
- Re-verify phone ownership (WhatsApp/OTP) when the cookie is missing
- Serve images through a Cloudflare Worker that checks the session cookie (forwarded image URLs stop working; better caching)
- Per-event setting: **private** vs **shareable** gallery
- Rate limiting, access logs, instant revoke, optional watermark on web copies

**Product**
- WhatsApp delivery (gallery link, notifications) via the official Cloud API — decision pending on cost
- Album selection by the couple → photographer downloads selected originals
- "Fast upload" mode (browser shrinks photos at the venue; originals uploaded later)
- RAW/HEIC support, camera-to-cloud upload, sub-events (haldi, sangeet, wedding)
- Google sign-in, public sign-up, pricing plans and payments
- Full-event originals export
- AI-powered pages, feature flags, SEO pages
- Data retention policies and automatic deletion
- Expansion to other segments: marathons/sports, corporate events, college fests, venues, tourist attractions
- R2 event notifications (via Cloudflare Queues) to detect uploads automatically instead of relying on the browser

**Process**
- Adopt the Spec Kit workflow for post-beta features

---

## 15. Decision log

| # | Decision | Reason |
|---|---|---|
| D1 | Build from this PRD + phased plan; Spec Kit later | Ship beta fast; adopt structure when features grow |
| D2 | Next.js with Hono API inside | One deployable now; backend can move to its own server later |
| D3 | Email/password via Better Auth; Super Admin creates photographers with temporary passwords | Invite-only beta; no email service needed |
| D4 | Postgres (Neon) + pgvector, not MongoDB | Relational data; vectors in the same DB; no vendor lock-in |
| D5 | Cloudflare R2 for images, not AWS S3 | Zero egress fees; ~₹115/month vs ~₹3,200/month at 100 GB stored + 500 GB served |
| D6 | Store originals + web copy + thumbnail | Originals needed for albums; small copies make galleries fast; extra cost ~5% |
| D7 | Self-hosted YuNet + SFace (OpenCV, Apache-2.0) | Free and commercial-safe; InsightFace pretrained models are non-commercial |
| D8 | Separate always-on Python worker | Different language, heavy CPU work, models loaded once |
| D9 | Postgres jobs table for queue; HTTPS for selfie embedding | No extra infrastructure for beta |
| D10 | Matches stored in DB (`guest_photos`), no per-guest copies | No duplicate storage; galleries update live |
| D11 | Per-image signed URLs (1 h) + gallery expiry in DB (default event + 7 days) | Signed URLs max 7 days and cannot be revoked; DB expiry is flexible |
| D12 | httpOnly cookie for guest session (`SameSite=Lax`) | Server-checkable, safe from scripts, works from WhatsApp links |
| D13 | Guests see results on the web immediately; WhatsApp after beta | Unofficial WhatsApp automation risks bans; Cloud API cost decision pending |
| D14 | No automatic deletion in beta; consent checkbox; manual guest delete | Keep data for re-matching; meet DPDP basics |
| D15 | No usage limits in beta; usage visible to Super Admin | Learn real usage; watch costs |
| D16 | JPEG only, ≤ 25 MB, drag and drop | Covers beta needs; RAW/HEIC later |
| D17 | Event Organiser role (view all event photos, own login) added **after beta** | Keeps beta focused on the core loop; data model and API designed in §14.1 |
| D18 | Product name is **InstantPhotoes** | Decided 27 Oct 2026 |
| D19 | Super Admin and Photographer areas are strictly separated, enforced server-side in both directions | Typing a URL by hand must never expose the other role's pages |
| D20 | All UI designs, logos and assets come from **Google Stitch** | Design is produced outside the code; code implements it |
| D21 | Deleting an event or a photo is a **soft delete** (`deleted_at`); nothing is removed from DB or R2 | Recoverable mistakes; no irreversible loss in beta |
| D22 | Photographers see **full** guest phone numbers | They already need to contact guests; masking adds no value |
| D23 | Guest gallery sorted by **capture time** (fallback upload time) | Photos appear in the order the day happened |
| D24 | Guest "download all" is a **zip** built in the browser | Accepted as sufficient for beta |
| D25 | Downloaded QR shows photographer name on top and "Powered by InstantPhotoes" at the bottom | Photographer branding with product credit |
| D26 | Soft-deleted events and photos **still count** toward storage and usage figures | The files remain in R2 and cost money until a purge exists |
| D27 | Browser confirms uploads; app verifies with R2 HeadObject and queues jobs; worker sweep recovers stuck uploads | Keeps file bytes off our server while guaranteeing every photo gets a status. R2 event notifications considered for post-beta |

---

## 16. Risks and open questions

### 16.1 Risks
| Risk | Mitigation |
|---|---|
| Face matching weak in low light / candid shots | Tune threshold on real test set; "Not me" feedback; consider licensed model later |
| Oracle free VM capacity unavailable or reduced | Fallback to a small paid VPS |
| Cloudflare free plan CPU limit for Next.js | Upgrade to $5/month Workers plan or run Next.js on the VM |
| Slow venue internet when uploading originals | Parallel uploads with retry; "fast upload" mode post-beta |
| Storage cost beyond R2 free 10 GB | Expected ~₹400/month for 10 weddings; usage dashboard |
| Neon free tier limits / pause | Database wakes on first query (~1 s); monitor storage |
| Biometric data and DPDP compliance | Consent, manual deletion, clear privacy notice; formal review before public launch |

### 16.2 Open questions
1. Domain name (product name is decided: InstantPhotos).
2. ~~Photographer sees full or masked phone numbers~~ → **Resolved: full numbers** (D22).
3. ~~Gallery sort order~~ → **Resolved: capture time** (D23).
4. ~~Download-all format~~ → **Resolved: zip** (D24).
5. Final matching threshold — to be set after the test-set evaluation.
6. Exact wording of the QR credit line ("Powered by" / "Marketed by" / "Backed by") — currently "Powered by InstantPhotos".
7. ~~Do soft-deleted events count toward storage usage?~~ → **Resolved: yes, they still count** (D26).
