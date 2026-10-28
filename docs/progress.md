# InstantPhotos: Project Progress

Single place to review where the project stands.
Source of truth for scope: [PRD.md](PRD.md). Remaining design work: [remaining screen.txt](remaining%20screen.txt).

**Last updated:** 28 Oct 2026
**Overall status:** Planning and design. No application code written yet.

**Legend:** `[ ]` not started · `[~]` in progress · `[x]` done · `[!]` blocked / needs decision

---

## 1. Where to track what

| What | Where |
|---|---|
| Scope, requirements, decisions | [PRD.md](PRD.md) (§5 requirements, §15 decision log, §16 open questions) |
| Delivery phases and "done when" criteria | PRD §13 (mirrored below) |
| Database (schema, ER diagram, screen-to-table map, how to run) | [database.md](database.md) |
| Screen designs | Google Stitch project **IP Workspace** (`5215924601128412052`) |
| Screens still to design | [remaining screen.txt](remaining%20screen.txt) |
| Overall progress (this file) | `docs/progress.md`: update the checkboxes after each piece of work |
| Beta success metrics | PRD §1.4, measured in Phase 6 |
| Code changes | Local working tree. The user uploads to GitHub by hand (see CLAUDE.md) |

---

## 2. Summary dashboard

| Track | Status |
|---|---|
| Product definition (PRD) | `[x]` Draft v1.1 done; open questions remain |
| UI design (Stitch) | `[~]` Admin and photographer screens mostly done, guest screens not done |
| Phase 0: Setup | `[~]` Monorepo + web app scaffolded; Neon, R2, VM, Tunnel, Sentry, CI not started |
| Phase 1: Auth and admin | `[~]` Landing page, admin login (Better Auth, in Postgres), role guards and all four admin pages run on the Neon dev database; photographer login exists but photographer pages are not built |
| Phase 2: Profile and events | `[ ]` |
| Phase 3: Upload and processing | `[ ]` |
| Phase 4: Face indexing and guest flow | `[ ]` |
| Phase 5: Gallery | `[ ]` |
| Phase 6: Beta hardening | `[ ]` |
| Beta rollout (real events) | `[ ]` |

---

## 3. Track A: Product definition

- [x] PRD written (problem, roles, scope, requirements, architecture, data model, storage, matching, API, security)
- [x] Decision log D1-D27
- [x] Post-beta roadmap (Event Organiser role and others)
- [ ] Reconcile product name spelling: "InstantPhotos" vs "InstantPhotoes" (D18)
- [ ] Add missing DB indexes to PRD §8 (`photos(event_id, status)`, `guest_photos(guest_id)`, `guests(access_token)`, `events(public_code)`)
- [ ] Document two-way matching (new face vs existing guests, new guest vs existing faces)
- [ ] Define job retry / backoff rules (PRC-6)

**Open questions (PRD §16.2)**
- [ ] Domain name
- [ ] Final matching threshold (after test-set evaluation, Phase 6)
- [ ] QR credit-line wording ("Powered by" / "Marketed by" / "Backed by")

---

## 4. Track B: UI design (Google Stitch)

Design system: "Regal Modernity" (burgundy, ivory, Newsreader + Manrope).
Full detail and order of work in [remaining screen.txt](remaining%20screen.txt).

**Designed (per Stitch labels, to be verified)**
- [x] Landing page (login version is hidden in Stitch, so verify)
- [x] Admin: Photographers (built in code)
- [x] Admin: Events (read-only)
- [x] Admin: Usage and storage
- [x] Admin: Account and privacy
- [x] Photographer dashboard (P01)
- [x] All events (P02)
- [x] Add new event
- [x] View event (verify it covers upload, statuses, guests, QR, settings)
- [~] Photo gallery (unclear if guest or photographer)

**Not designed**
- [ ] Guest registration `/e/[code]` (mobile)
- [ ] Guest gallery `/g/[token]` + viewer + download-all (mobile)
- [ ] Guest reclaim (phone number entry)
- [ ] Guest closed states (expired / event closed)
- [ ] Change password
- [ ] Error pages (404, no access, session expired)
- [ ] Photographer profile and branding
- [ ] Printable QR layout
- [ ] Admin modals (add, reset password, suspend, delete guest)

---

## 5. Track C: Build phases (PRD §13)

### Phase 0: Setup
**Done when:** app and worker deploy; health checks pass.
- [x] Monorepo (`apps/web`, `apps/worker`, `packages/core`, `packages/db`): npm workspaces, Next.js 16 + Tailwind 4 + TypeScript in `apps/web`; core/db/worker are placeholders
- [x] Confirm public npm registry: project `.npmrc` pins `registry.npmjs.org` (global npm config points at a company registry, so keep this file)
- [x] Database schema (Drizzle, PRD §8) in `packages/db`: Better Auth tables + photographer_profiles, events, photos, faces (vector 128), guests, guest_photos, guest_sessions, jobs. Migration, dummy-data seed and local Postgres script done (`npm run db:local:start`, `db:migrate`, `db:seed`)
- [x] Neon Postgres + pgvector: personal dev database migrated and seeded (a production database comes at deploy time)
- [x] `packages/core` and the API now read and write the database; the in-memory mock is deleted
- [ ] Cloudflare R2 bucket (private)
- [ ] Oracle VM + Docker for worker
- [ ] Cloudflare Tunnel + shared secret
- [ ] Sentry
- [ ] CI
- [ ] `CLAUDE.md` extended with technical decisions
- [ ] Health checks pass for app and worker

### Phase 1: Auth and admin
**Done when:** Super Admin can onboard a photographer who can log in.
- [~] Landing page + login (AUTH-1, AUTH-2): landing page built from Stitch. Login works against the admin credentials in `apps/web/src/config/auth.config.ts` (env overrides); Better Auth + database come later
- [~] Redirect by role (AUTH-3): done for the admin session; photographer redirect target `/dashboard` does not exist yet. Better Auth not wired
- [ ] Seed script for Super Admin (AUTH-5)
- [ ] Forced password change at first login (AUTH-4)
- [~] Change own password (AUTH-7, ADM-8): admin can change it at `/admin/account` and other sessions are revoked; the new password lives in memory until the DB exists
- [x] Login rate limit (AUTH-8): 5 failed attempts per 15 min per IP (in memory)
- [x] Role separation enforced server-side both ways (AUTH-9, AUTH-10, AUTH-11): `proxy.ts` + layout check + API guards, tested with a forged photographer session
- [~] Admin: list, create, suspend/reactivate, reset password (ADM-1 to ADM-4): UI + Hono API done on in-memory mock data in `packages/core`; no database yet
- [~] Admin: events, usage, delete guest (ADM-5, ADM-6, ADM-7): pages + API done on mock data; usage includes soft-deleted events (D26)
- [ ] Suspended users' sessions revoked (AUTH-6)

### Phase 2: Profile and events
**Done when:** a photographer creates an event and downloads its QR.
- [ ] Photographer profile and branding upload (PRO-1 to PRO-3)
- [ ] Event create / edit / list (EVT-1)
- [ ] Public code + QR URL (EVT-2)
- [ ] QR download PNG + PDF with agreed layout (EVT-3)
- [ ] Gallery expiry default and edit (EVT-4)
- [ ] Event status active / archived (EVT-5)
- [ ] Soft delete of events (EVT-6)
- [ ] Event detail counts (EVT-7)
- [ ] Admin: all events read-only (ADM-5)

### Phase 3: Upload and processing
**Done when:** 500 photos upload and show `ready`.
- [ ] Batch validation + presigned URLs (UPL-7)
- [ ] Direct-to-R2 upload with parallelism, retry, progress (UPL-1 to UPL-6, UPL-8)
- [ ] Upload complete endpoint with `HeadObject` check and job insert (UPL-8a)
- [ ] Cleanup sweep for stuck uploads (UPL-8b)
- [ ] Per-photo status UI + Retry (UPL-8c)
- [ ] Jobs queue (`SKIP LOCKED`)
- [ ] Worker: EXIF rotation, web copy, thumbnail, strip GPS (PRC-1, PRC-2)
- [ ] Photo soft delete (UPL-9)

### Phase 4: Face indexing and guest flow
**Done when:** a guest submits a selfie and gets correct matches in under 5 s.
- [ ] Face detection (YuNet) + embeddings (SFace) stored in pgvector (PRC-3, PRC-4)
- [ ] Match new faces against registered guests (PRC-5, PRC-6)
- [ ] `/embed-selfie` endpoint on worker
- [ ] Guest event page and form (GST-1, GST-2, GST-3)
- [ ] Selfie validation: exactly one face (GST-4)
- [ ] Selfie stored; match against existing faces (GST-5, GST-6)
- [ ] Re-registration by same phone (GST-7)
- [ ] Reject when archived / expired (GST-8)
- [ ] Guest session cookie + redirect (GST-9)
- [ ] Photographer: guests list and per-guest photos (PHG-1, PHG-2)

### Phase 5: Gallery
**Done when:** a guest can browse and download their photos on mobile.
- [ ] Gallery access check: token + cookie (GAL-1)
- [ ] Reclaim by phone number (GAL-2)
- [ ] Expiry message (GAL-3)
- [ ] Grid sorted by capture time, infinite scroll (GAL-4)
- [ ] Full-screen viewer with swipe (GAL-5)
- [ ] Download single and download-all zip (GAL-6, GAL-7)
- [ ] "Not me" (GAL-8)
- [ ] Empty state (GAL-9)
- [ ] Signed URLs, 1 hour (GAL-10)
- [ ] Works on Chrome (Android) and Safari (iOS) (GAL-11)
- [ ] Photographer originals download (PHG-3, PHG-4)

### Phase 6: Beta hardening
**Done when:** the PRD §1.4 metrics are met in a rehearsal event.
- [ ] Labelled test set of real wedding photos
- [ ] Tune matching threshold (start ~0.363)
- [ ] Load test: 50 concurrent guests
- [ ] Admin usage view, including soft-deleted data (ADM-6)
- [ ] Guest deletion for DPDP (ADM-7)
- [ ] Monitoring and alerts (Sentry, job failures visible)
- [ ] Rate limits on guest registration and reclaim
- [ ] Rehearsal event

---

## 6. Track D: Beta rollout

Targets from PRD §1.4. Fill in the actuals as events happen.

| Metric | Target | Actual |
|---|---|---|
| Photographers onboarded | 5-10 | 0 |
| Events run | 20 | 0 |
| Guests who find at least 1 photo | > 80% | n/a |
| Photo searchable after upload | ≤ 3 min | n/a |
| Selfie to gallery | < 5 s | n/a |
| Photographer feedback collected after each event | every event | 0 |

---

## 7. Change log

| Date | Update |
|---|---|
| 29 Oct 2026 | Admin area runs on the database: Better Auth (login, sessions, change password in Postgres), core services as SQL, rate limit table, role guards checked against the database, Neon dev database migrated and seeded. Config-file login removed. Tested with curl and a real browser. |
| 28 Oct 2026 | Added the database: full Drizzle schema, first migration (enables pgvector), seed with the same dummy data as the mock (7 photographers, 13 events, 35,510 photos, 3,815 guests), local Postgres script. Seeded totals checked against the old mock: identical. Admin pages still read the mock. |
| 28 Oct 2026 | Built the four admin pages (Photographers, Events, Usage, Account) from the Stitch designs on mock data, a Hono API under `/api`, config-based admin login with signed session cookie, `proxy.ts` role guards and login rate limit. Tested end to end with Playwright and curl. |
| 28 Oct 2026 | Scaffolded monorepo and built the landing page in `apps/web` from the Stitch design (desktop and mobile checked, build passes). |
| 28 Oct 2026 | Created this file. PRD v1.1 done. Stitch checked: admin and photographer screens mostly designed, guest screens not. No code yet. |
