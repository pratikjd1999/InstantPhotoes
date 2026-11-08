# Face worker

Python service (FastAPI + OpenCV YuNet/SFace) that turns uploaded originals into everything guests need (PRD §5.6, §7.4, §10).
It runs in Docker and talks to the same Neon database and R2 bucket as the app. No files pass between the app and the worker.

## What it does

**Photo jobs** (`jobs` table, claimed with `FOR UPDATE SKIP LOCKED`), for each `process_photo` job:

1. reads the original from R2 and applies EXIF rotation
2. writes `events/{eventId}/web/{photoId}.jpg` (long edge 2048 px, ~500 KB) and `.../thumbs/{photoId}.jpg` (400 px, ~30 KB), with EXIF and GPS removed
3. finds faces (YuNet; ignores faces under 16 px or below 0.6 confidence, and faces under 0.8 confidence unless they are 40–160 px) and makes a 128-d embedding for each (SFace)
4. saves the faces, marks the photo `ready` with width, height, capture time and face count
5. matches the new faces against the event's registered guests (`guest_photos`, cosine similarity ≥ `MATCH_THRESHOLD`)

Errors are retried 3 times (after 30 s, then 60 s). A file that can't be decoded, or is missing from storage, fails at once
with a message the photographer sees.

**Sweep** (UPL-8b): uploads stuck in `pending_upload` for 15 minutes are checked against R2 and either queued or marked
`upload_failed`. Jobs left `running` by a worker that stopped are put back in the queue.

**HTTP** (port 8000):

| Endpoint | Secret | Purpose |
|---|---|---|
| `GET /health` | no | Liveness. Doesn't touch the database. |
| `POST /wake` | yes | The app calls it after queuing jobs, so they start at once. |
| `POST /embed-selfie` `{ "key": "events/{eventId}/selfies/{guestId}.jpg" }` | yes | Checks the selfie has exactly one clear face and returns its embedding (200), or `422` with `code` (`no_face`, `multiple_faces`, `face_too_small`, `bad_image`) and a guest-friendly `message`. |

The secret goes in the `x-worker-secret` header. The app side is `packages/core/src/worker.ts` (`wakeWorker`, `embedSelfie`, `matchGuest`).

**Polling** (D28): every 3 s while photos are coming in, every 30 min when idle, so Neon can suspend. `/wake` covers the gap.

## Run locally

Needs Docker Desktop and these in the repo's `.env.local`: `DATABASE_URL`, `R2_*`, `WORKER_SECRET` (and `WORKER_URL=http://localhost:8000`
for the app).

```bash
cd apps/worker
docker compose up --build        # add -d to run in the background
docker compose logs -f           # watch jobs
docker compose down              # stop
```

Without the `R2_*` variables it reads and writes `.local/storage`, the app's development storage folder.

## Settings

| Variable | Default | |
|---|---|---|
| `DATABASE_URL` | required | Same database as the app |
| `WORKER_SECRET` | required | At least 24 characters; the same value as the app's |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | | Same bucket as the app |
| `WORKER_CONCURRENCY` | 2 | Photos processed at once. Set to the number of CPU cores on the server. |
| `MATCH_THRESHOLD` | 0.363 | Must match the app's value. Tune on real photos before launch (PRD §10.3). |
| `MIN_FACE_PX`, `MIN_FACE_SCORE` | 16, 0.6 | Smaller or less certain faces are ignored. Kept low so blurry and small faces still match (phase 1). |
| `SURE_FACE_SCORE` | 0.8 | Faces scoring below this are kept only at 40–160 px; outside that range they are almost always background, flowers or fabric patterns |
| `ACTIVE_POLL_SECONDS`, `IDLE_POLL_SECONDS` | 3, 1800 | Queue polling |
| `CAMERA_TIMEZONE` | Asia/Kolkata | Used for EXIF capture times that have no offset |

## Speed

Measured on an M-series Mac in Docker: a 24 MP, 10 MB JPEG takes ~0.2 s to decode and resize, ~0.1 s to encode both copies,
and ~25 ms per face. Most of the remaining time is network: each database round trip and R2 call costs as much as the
distance to Neon and R2. Run the worker in, or close to, the region of the production database.

## Deploy

On a Linux server with Docker (ARM or x86): copy this folder, create `.env` next to `docker-compose.yml` with the settings
above, then `WORKER_ENV_FILE=.env docker compose up -d --build`. The port is bound to `127.0.0.1` only; expose it through a
tunnel or a reverse proxy with HTTPS, and set the app's `WORKER_URL` and `WORKER_SECRET` in Vercel.
