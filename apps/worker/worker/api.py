"""HTTP side of the worker (PRD §11.2): /health, /wake and /embed-selfie. Everything but /health needs the shared secret.

Run with one process only (the job threads live inside it):  uvicorn worker.api:app --host 0.0.0.0 --port 8000
"""

import hmac
import logging
import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI, Header, HTTPException
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import JSONResponse
from psycopg_pool import ConnectionPool
from pydantic import BaseModel

from . import config, images
from .faces import FaceEngine, to_bgr
from .jobs import JobRunner
from .storage import create_storage

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
log = logging.getLogger("worker")

# Selfie rules (GST-4). Faces much smaller than the main one are people in the background and are ignored.
SELFIE_MIN_FACE_PX = 80
BACKGROUND_RATIO = 0.5

state: dict = {}


@asynccontextmanager
async def lifespan(_: FastAPI):
    s = config.load()
    # Neon closes idle connections when it suspends; `check` replaces dead ones before use.
    # prepare_threshold=None: Neon's pooled URL (PgBouncer, transaction mode) can't keep prepared statements.
    # autocommit: every statement the worker sends is complete on its own (see jobs.py).
    pool = ConnectionPool(
        s.database_url,
        min_size=1,
        max_size=s.concurrency + 3,
        kwargs={"prepare_threshold": None, "connect_timeout": 20, "autocommit": True},
        check=ConnectionPool.check_connection,
        open=True,
    )
    storage = create_storage(s)
    runner = JobRunner(s, pool, storage)
    runner.start()
    state.update(settings=s, pool=pool, storage=storage, runner=runner, selfie_engine=FaceEngine(s.models_dir, s.min_face_score), selfie_lock=threading.Lock())
    log.info("worker started: storage=%s, %d job threads, threshold %.3f", storage.driver, s.concurrency, s.match_threshold)
    yield
    runner.stop()
    pool.close()


app = FastAPI(title="InstantPhotos worker", lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)


def require_secret(given: str | None) -> None:
    expected = state["settings"].worker_secret
    if not given or not hmac.compare_digest(given.encode(), expected.encode()):
        raise HTTPException(status_code=401, detail="Unauthorized")


@app.get("/health")
def health():
    # No database call here: frequent health checks would keep Neon from ever suspending.
    runner: JobRunner = state["runner"]
    return {"ok": True, "storage": state["storage"].driver, "processed": runner.processed, "failed": runner.failed}


@app.post("/wake", status_code=202)
def wake(x_worker_secret: str | None = Header(default=None)):
    require_secret(x_worker_secret)
    state["runner"].wake()
    return {"ok": True}


class SelfieRequest(BaseModel):
    key: str


def _embed_selfie(key: str) -> tuple[int, dict]:
    data = state["storage"].get(key)
    if data is None:
        return 404, {"ok": False, "code": "not_found", "message": "The selfie was not found."}
    try:
        img = images.open_selfie(data)
    except images.BadImage:
        return 422, {"ok": False, "code": "bad_image", "message": "We couldn't read that photo. Please take the selfie again."}
    with state["selfie_lock"]:
        faces = state["selfie_engine"].detect(to_bgr(img), min_px=24)
    if not faces:
        return 422, {"ok": False, "code": "no_face", "message": "We couldn't see a face. Face the camera in good light and try again."}
    main = max(faces, key=lambda f: f.w)
    others = [f for f in faces if f is not main and f.w >= main.w * BACKGROUND_RATIO]
    if others:
        return 422, {"ok": False, "code": "multiple_faces", "message": "We found more than one face. Please take a selfie with only you in it."}
    if main.w < SELFIE_MIN_FACE_PX:
        return 422, {"ok": False, "code": "face_too_small", "message": "Your face is too small in the photo. Hold the camera a little closer."}
    return 200, {"ok": True, "embedding": [round(x, 6) for x in main.embedding.tolist()], "score": round(main.score, 4)}


@app.post("/embed-selfie")
async def embed_selfie(body: SelfieRequest, x_worker_secret: str | None = Header(default=None)):
    """GST-4: the app stored the selfie in R2 and sends its key; returns the 128-d embedding of the one face in it."""
    require_secret(x_worker_secret)
    if "/selfies/" not in body.key:
        raise HTTPException(status_code=400, detail="Not a selfie key")
    try:
        status, result = await run_in_threadpool(_embed_selfie, body.key)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid key")
    return JSONResponse(result, status_code=status)
