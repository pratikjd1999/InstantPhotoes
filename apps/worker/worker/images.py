"""Web copy and thumbnail (PRC-1, PRC-2): EXIF rotation applied, metadata (GPS included) stripped."""

import io
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from PIL import Image, ImageOps

WEB_EDGE = 2048
THUMB_EDGE = 400
SELFIE_EDGE = 1280

EXIF_IFD = 0x8769
DATETIME_ORIGINAL = 0x9003
OFFSET_TIME_ORIGINAL = 0x9011
DATETIME = 0x0132


class BadImage(Exception):
    """The file is not a readable JPEG. Retrying will not help."""


@dataclass
class Prepared:
    width: int  # original size, after rotation
    height: int
    taken_at: datetime | None
    web: Image.Image  # RGB, long edge <= WEB_EDGE
    icc: bytes | None


def _taken_at(img: Image.Image, camera_tz: str) -> datetime | None:
    exif = img.getexif()
    raw = exif.get_ifd(EXIF_IFD).get(DATETIME_ORIGINAL) or exif.get(DATETIME)
    if not isinstance(raw, str):
        return None
    try:
        at = datetime.strptime(raw.strip()[:19], "%Y:%m:%d %H:%M:%S")
    except ValueError:
        return None
    if not 1990 <= at.year <= 2100:
        return None
    offset = exif.get_ifd(EXIF_IFD).get(OFFSET_TIME_ORIGINAL)
    if isinstance(offset, str) and len(offset) == 6 and offset[0] in "+-":
        try:
            sign = 1 if offset[0] == "+" else -1
            delta = timedelta(hours=int(offset[1:3]), minutes=int(offset[4:6]))
            return at.replace(tzinfo=timezone(sign * delta))
        except ValueError:
            pass
    return at.replace(tzinfo=ZoneInfo(camera_tz))


def _open(data: bytes, max_edge: int) -> tuple[Image.Image, int, int, Image.Image]:
    """Decodes at reduced size where the JPEG allows it (much faster for 24 MP files). Returns (rotated RGB, w, h, raw)."""
    try:
        raw = Image.open(io.BytesIO(data))
        # MPO is a JPEG with extra embedded images (a preview, a depth map), written by many cameras and phones.
        # Pillow reads its first frame, the photo itself, like any JPEG.
        if raw.format not in ("JPEG", "MPO"):
            raise BadImage(f"Not a JPEG ({raw.format}).")
        w, h = raw.size
        scale = max_edge / max(w, h)
        if scale < 1:
            raw.draft("RGB", (max(1, int(w * scale)), max(1, int(h * scale))))
        img = ImageOps.exif_transpose(raw)
        img = img.convert("RGB")
    except BadImage:
        raise
    except Exception as e:  # Pillow raises many types for broken files
        raise BadImage(f"Could not decode the image: {e}") from e
    # Original dimensions, swapped when EXIF says the camera was rotated.
    if raw.getexif().get(0x0112) in (5, 6, 7, 8):
        w, h = h, w
    img.thumbnail((max_edge, max_edge), Image.Resampling.LANCZOS)
    return img, w, h, raw


def prepare(data: bytes, camera_tz: str) -> Prepared:
    img, w, h, raw = _open(data, WEB_EDGE)
    return Prepared(width=w, height=h, taken_at=_taken_at(raw, camera_tz), web=img, icc=raw.info.get("icc_profile"))


def open_selfie(data: bytes) -> Image.Image:
    return _open(data, SELFIE_EDGE)[0]


def jpeg(img: Image.Image, quality: int, icc: bytes | None = None, max_edge: int | None = None) -> bytes:
    if max_edge and max(img.size) > max_edge:
        img = img.copy()
        img.thumbnail((max_edge, max_edge), Image.Resampling.LANCZOS)
    out = io.BytesIO()
    # No `exif=` argument: EXIF (camera, GPS, time) is not written. The colour profile is kept so colours look right.
    img.save(out, "JPEG", quality=quality, optimize=True, progressive=True, icc_profile=icc)
    return out.getvalue()
