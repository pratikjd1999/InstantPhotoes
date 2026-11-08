import os
from dataclasses import dataclass


def _int(name: str, default: int) -> int:
    return int(os.environ.get(name) or default)


def _float(name: str, default: float) -> float:
    return float(os.environ.get(name) or default)


@dataclass(frozen=True)
class Settings:
    database_url: str
    worker_secret: str
    r2_account_id: str
    r2_access_key_id: str
    r2_secret_access_key: str
    r2_bucket: str
    local_storage_dir: str
    models_dir: str
    # Photos processed at the same time. Each one uses its own model instances.
    concurrency: int
    # OpenCV's recommended SFace cosine threshold (PRD §10.3). The app must use the same value (MATCH_THRESHOLD).
    match_threshold: float
    # Faces smaller than this (pixels, on the 2048 px web copy) or less confident are ignored (PRC-3).
    # Kept low so blurry, side-on and small faces still reach guests; "Not me" handles the odd wrong match.
    min_face_px: int
    min_face_score: float
    # Queue polling: fast while uploads are coming in, slow when idle so Neon can suspend. The app also calls /wake.
    active_poll_seconds: int
    idle_poll_seconds: int
    # Camera clocks have no time zone; EXIF times without an offset are read in this zone.
    camera_timezone: str

    @property
    def r2_configured(self) -> bool:
        return all([self.r2_account_id, self.r2_access_key_id, self.r2_secret_access_key, self.r2_bucket])


def load() -> Settings:
    s = Settings(
        database_url=os.environ.get("DATABASE_URL", ""),
        worker_secret=os.environ.get("WORKER_SECRET", ""),
        r2_account_id=os.environ.get("R2_ACCOUNT_ID", ""),
        r2_access_key_id=os.environ.get("R2_ACCESS_KEY_ID", ""),
        r2_secret_access_key=os.environ.get("R2_SECRET_ACCESS_KEY", ""),
        r2_bucket=os.environ.get("R2_BUCKET", ""),
        local_storage_dir=os.environ.get("LOCAL_STORAGE_DIR", ""),
        models_dir=os.environ.get("MODELS_DIR", "models"),
        concurrency=max(1, _int("WORKER_CONCURRENCY", 2)),
        match_threshold=_float("MATCH_THRESHOLD", 0.363),
        min_face_px=_int("MIN_FACE_PX", 16),
        min_face_score=_float("MIN_FACE_SCORE", 0.5),
        active_poll_seconds=_int("ACTIVE_POLL_SECONDS", 3),
        idle_poll_seconds=_int("IDLE_POLL_SECONDS", 1800),
        camera_timezone=os.environ.get("CAMERA_TIMEZONE", "Asia/Kolkata"),
    )
    if not s.database_url:
        raise SystemExit("DATABASE_URL is not set.")
    if len(s.worker_secret) < 24:
        raise SystemExit("WORKER_SECRET must be set (at least 24 characters).")
    if not s.r2_configured and not s.local_storage_dir:
        raise SystemExit("Set the R2_* variables, or LOCAL_STORAGE_DIR for development.")
    return s
