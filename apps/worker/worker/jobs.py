"""Job loop (PRD §10.1) and the stuck-upload sweep (UPL-8b).

Jobs come from the Postgres `jobs` table, claimed with FOR UPDATE SKIP LOCKED (D9). Each job:
original from storage -> web copy + thumbnail to storage -> faces + embeddings -> photo `ready` -> match against
the event's guests. Retried up to 3 times (PRC-6); files that can't be decoded fail at once.

The database can be far away (Neon round trips are ~200 ms from India to a US region), so each step is one SQL
statement: about three round trips per photo. Connections are in autocommit mode; every statement is atomic.
"""

import logging
import threading
import time
import traceback
from concurrent.futures import ThreadPoolExecutor

import cv2
from psycopg.types.json import Jsonb
from psycopg_pool import ConnectionPool

from . import images
from .config import Settings
from .faces import FaceEngine, to_bgr, vector_literal

log = logging.getLogger("worker.jobs")

MAX_ATTEMPTS = 3
ACTIVE_WINDOW = 120  # seconds after the last job during which the queue is polled fast
SWEEP_EVERY = 600  # UPL-8b: every 10 minutes while busy; on each idle poll otherwise
STUCK_UPLOAD = "15 minutes"
STALE_JOB = "15 minutes"  # a running job this old belonged to a worker that died
RETRY_REASON = "Processing failed after 3 attempts. Try again."

# Takes the next job, marks its photo `processing` and returns what the job needs, in one statement.
CLAIM_SQL = """
with j as (
  update jobs set status = 'running', locked_at = now(), attempts = attempts + 1
  where id = (
    select id from jobs
    where status = 'pending' and run_after <= now() and type = 'process_photo'
    order by run_after, created_at
    limit 1
    for update skip locked)
  returning id, attempts,
    case when payload->>'photoId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
         then (payload->>'photoId')::uuid end as photo_id
),
mark as (
  update photos p set status = 'processing'
  from j, events e
  where p.id = j.photo_id and e.id = p.event_id and p.deleted_at is null and e.deleted_at is null
    and p.status in ('uploaded', 'processing')
  returning p.id
)
select j.id, j.attempts, j.photo_id, p.event_id, p.original_key, (select count(*) from mark) = 1 as live
from j left join photos p on p.id = j.photo_id
"""

# Saves faces, marks the photo `ready` and the job `done` together. Does nothing to the photo if it was deleted meanwhile.
SAVE_SQL = """
with live as (
  select id from photos where id = %(photo)s and deleted_at is null and status = 'processing' for update
),
gone as (delete from faces where photo_id in (select id from live)),
ins as (
  insert into faces (photo_id, event_id, embedding, bbox, det_score)
  select l.id, %(event)s, f.e::vector, f.b, f.s
  from live l, unnest(%(embeddings)s::text[], %(boxes)s::jsonb[], %(scores)s::real[]) as f(e, b, s)
),
done as (update jobs set status = 'done', locked_at = null where id = %(job)s),
upd as (
  update photos set status = 'ready', web_key = %(web)s, thumb_key = %(thumb)s, width = %(w)s, height = %(h)s,
    taken_at = coalesce(%(taken)s, taken_at), face_count = %(faces)s, fail_reason = null
  where id in (select id from live)
  returning id
)
select count(*) from upd
"""

# Runs after SAVE_SQL has committed. A guest who registers at the same moment searches after their own commit,
# so between the two searches every match is found.
MATCH_PHOTO_SQL = """
insert into guest_photos (guest_id, photo_id, similarity)
select g.id, %(photo)s::uuid, max(1 - (f.embedding <=> g.selfie_embedding))
from guests g
join faces f on f.photo_id = %(photo)s and f.deleted_at is null
where g.event_id = %(event)s and g.deleted_at is null and g.selfie_embedding is not null
group by g.id
having max(1 - (f.embedding <=> g.selfie_embedding)) >= %(threshold)s
on conflict (guest_id, photo_id) do nothing
"""


class Permanent(Exception):
    """Fail the photo now; retrying cannot help. The message is shown to the photographer."""


class JobRunner:
    def __init__(self, settings: Settings, pool: ConnectionPool, storage):
        self.s = settings
        self.pool = pool
        self.storage = storage
        self.uploads = ThreadPoolExecutor(max_workers=settings.concurrency * 2, thread_name_prefix="put")
        self.cond = threading.Condition()
        self.stopping = False
        self.last_activity = time.monotonic()
        self.last_sweep = 0.0
        self.processed = 0
        self.failed = 0

    # ---------- lifecycle ----------

    def start(self) -> None:
        # Split the CPU between the photo threads instead of letting each OpenCV call grab every core.
        cv2.setNumThreads(1 if self.s.concurrency > 1 else 0)
        for i in range(self.s.concurrency):
            threading.Thread(target=self._loop, name=f"job-{i}", daemon=True).start()
        threading.Thread(target=self._sweep_loop, name="sweep", daemon=True).start()

    def stop(self) -> None:
        with self.cond:
            self.stopping = True
            self.cond.notify_all()

    def wake(self) -> None:
        """Called by the app after uploads (POST /wake), so jobs start at once without fast polling all day."""
        self.last_activity = time.monotonic()
        with self.cond:
            self.cond.notify_all()

    def _wait(self) -> None:
        busy = time.monotonic() - self.last_activity < ACTIVE_WINDOW
        with self.cond:
            if not self.stopping:
                self.cond.wait(self.s.active_poll_seconds if busy else self.s.idle_poll_seconds)

    def _loop(self) -> None:
        engine = FaceEngine(self.s.models_dir, self.s.min_face_score)
        while not self.stopping:
            try:
                with self.pool.connection() as conn:
                    job = conn.execute(CLAIM_SQL).fetchone()
                    if job is not None:
                        self.last_activity = time.monotonic()
                        self._run(conn, job, engine)
            except Exception:
                log.exception("job loop error")
                time.sleep(5)
                continue
            if job is None:
                self._wait()

    # ---------- one job ----------

    def _run(self, conn, job, engine: FaceEngine) -> None:
        job_id, attempts, photo_id, event_id, original_key, live = job
        started = time.monotonic()
        try:
            if not live:
                conn.execute("update jobs set status = 'done', locked_at = null where id = %s", (job_id,))
                log.info("job %s skipped: photo %s deleted, missing or already done", job_id, photo_id)
                return
            outcome = self._process(conn, job_id, photo_id, event_id, original_key, engine)
            self.processed += 1
            log.info("photo %s %s in %.1fs", photo_id, outcome, time.monotonic() - started)
        except Permanent as e:
            self._fail(conn, job_id, photo_id, str(e), str(e))
        except Exception as e:
            detail = f"{type(e).__name__}: {e}"
            log.warning("photo %s attempt %s failed: %s\n%s", photo_id, attempts, detail, traceback.format_exc())
            if attempts >= MAX_ATTEMPTS:
                self._fail(conn, job_id, photo_id, RETRY_REASON, detail)
            else:
                self._retry_later(conn, job_id, photo_id, attempts, detail)

    def _process(self, conn, job_id, photo_id, event_id, original_key: str, engine: FaceEngine) -> str:
        web_key = original_key.replace("/originals/", "/web/", 1)
        thumb_key = original_key.replace("/originals/", "/thumbs/", 1)
        if web_key == original_key:
            raise Permanent("Unexpected storage key.")
        data = self.storage.get(original_key)
        if data is None:
            raise Permanent("The original file is missing from storage. Upload it again.")
        try:
            prepared = images.prepare(data, self.s.camera_timezone)
        except images.BadImage as e:
            raise Permanent("The file could not be read as a JPEG photo.") from e

        web = images.jpeg(prepared.web, 82, prepared.icc)
        thumb = images.jpeg(prepared.web, 75, prepared.icc, max_edge=images.THUMB_EDGE)
        puts = [self.uploads.submit(self.storage.put, web_key, web), self.uploads.submit(self.storage.put, thumb_key, thumb)]
        faces = engine.detect(to_bgr(prepared.web), self.s.min_face_px)  # runs while the copies upload
        for p in puts:
            p.result()

        web_w, web_h = prepared.web.size
        saved = conn.execute(
            SAVE_SQL,
            {
                "photo": photo_id,
                "event": event_id,
                "job": job_id,
                "embeddings": [vector_literal(f.embedding) for f in faces],
                "boxes": [Jsonb(f.bbox(web_w, web_h)) for f in faces],
                "scores": [round(f.score, 4) for f in faces],
                "web": web_key,
                "thumb": thumb_key,
                "w": prepared.width,
                "h": prepared.height,
                "taken": prepared.taken_at,
                "faces": len(faces),
            },
        ).fetchone()[0]
        if not saved:
            return "skipped (deleted while processing)"
        matched = 0
        if faces:
            matched = conn.execute(MATCH_PHOTO_SQL, {"photo": photo_id, "event": event_id, "threshold": self.s.match_threshold}).rowcount
        return f"ready ({len(faces)} faces, {matched} guest matches)"

    def _fail(self, conn, job_id, photo_id, reason: str, detail: str) -> None:
        self.failed += 1
        log.warning("photo %s failed: %s", photo_id, detail)
        conn.execute(
            """
            with j as (update jobs set status = 'failed', last_error = %(detail)s, locked_at = null where id = %(job)s)
            update photos set status = 'failed', fail_reason = %(reason)s where id = %(photo)s and status = 'processing'
            """,
            {"job": job_id, "photo": photo_id, "reason": reason, "detail": detail[:2000]},
        )

    def _retry_later(self, conn, job_id, photo_id, attempts: int, detail: str) -> None:
        conn.execute(
            """
            with j as (
              update jobs set status = 'pending', last_error = %(detail)s, locked_at = null,
                run_after = now() + make_interval(secs => %(delay)s)
              where id = %(job)s)
            update photos set status = 'uploaded' where id = %(photo)s and status = 'processing'
            """,
            {"job": job_id, "photo": photo_id, "detail": detail[:2000], "delay": 30 * attempts},
        )

    # ---------- sweep (UPL-8b) ----------

    def _sweep_loop(self) -> None:
        while not self.stopping:
            since_sweep = time.monotonic() - self.last_sweep
            busy = time.monotonic() - self.last_activity < 30 * 60
            if self.last_sweep == 0 or since_sweep >= (SWEEP_EVERY if busy else self.s.idle_poll_seconds):
                try:
                    self.sweep()
                except Exception:
                    log.exception("sweep failed")
                self.last_sweep = time.monotonic()
            with self.cond:
                if not self.stopping:
                    self.cond.wait(SWEEP_EVERY)

    def sweep(self) -> None:
        with self.pool.connection() as conn:
            # Jobs left `running` by a worker that stopped mid-photo go back in the queue, or fail when out of attempts.
            conn.execute(
                f"""
                with stale as (
                  update jobs set status = case when attempts >= {MAX_ATTEMPTS} then 'failed'::job_status else 'pending'::job_status end,
                    locked_at = null, last_error = coalesce(last_error, 'Worker stopped while processing.')
                  where status = 'running' and locked_at < now() - interval '{STALE_JOB}'
                  returning status, (payload->>'photoId') as photo_id)
                update photos set status = case when stale.status = 'failed' then 'failed'::photo_status else 'uploaded'::photo_status end,
                  fail_reason = case when stale.status = 'failed' then '{RETRY_REASON}' end
                from stale where photos.id::text = stale.photo_id and photos.status = 'processing'
                """
            )
            stuck = conn.execute(
                f"""
                select p.id, p.original_key, p.size_bytes from photos p join events e on e.id = p.event_id
                where p.status = 'pending_upload' and p.deleted_at is null and e.deleted_at is null
                  and p.created_at < now() - interval '{STUCK_UPLOAD}'
                order by p.created_at limit 200
                """
            ).fetchall()

            arrived, missing = [], []
            for photo_id, key, size in stuck:
                got = self.storage.head(key)
                (arrived if got is not None and got == int(size) else missing).append(photo_id)
            if not (arrived or missing):
                return
            with conn.transaction():
                if arrived:
                    conn.execute(
                        """
                        with u as (
                          update photos set status = 'uploaded', uploaded_at = now(), fail_reason = null
                          where id = any(%s) and status = 'pending_upload' returning id)
                        insert into jobs (type, payload) select 'process_photo', jsonb_build_object('photoId', id) from u
                        """,
                        (arrived,),
                    )
                if missing:
                    conn.execute(
                        "update photos set status = 'upload_failed', fail_reason = 'The upload did not finish.' where id = any(%s) and status = 'pending_upload'",
                        (missing,),
                    )
        log.info("sweep: %d stuck uploads found in storage, %d marked failed", len(arrived), len(missing))
        if arrived:
            self.wake()
