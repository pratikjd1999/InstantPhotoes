"""R2 access for the worker (PRD §7.4: app and worker both read and write R2 directly; no files pass between them).

Mirrors packages/core/src/storage.ts: R2 when the R2_* variables are set, otherwise the development folder
(.local/storage) that the app's local driver writes to.
"""

import re
from pathlib import Path

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

from .config import Settings

SAFE_KEY = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._\-/]*$")


def assert_safe_key(key: str) -> None:
    if not SAFE_KEY.match(key) or ".." in key or "//" in key:
        raise ValueError(f"Unsafe storage key: {key}")


class R2Storage:
    driver = "r2"

    def __init__(self, s: Settings):
        self.bucket = s.r2_bucket
        self.client = boto3.client(
            "s3",
            endpoint_url=f"https://{s.r2_account_id}.r2.cloudflarestorage.com",
            aws_access_key_id=s.r2_access_key_id,
            aws_secret_access_key=s.r2_secret_access_key,
            region_name="auto",
            config=Config(signature_version="s3v4", retries={"max_attempts": 4, "mode": "standard"}, max_pool_connections=16),
        )

    def get(self, key: str) -> bytes | None:
        assert_safe_key(key)
        try:
            return self.client.get_object(Bucket=self.bucket, Key=key)["Body"].read()
        except ClientError as e:
            if e.response.get("Error", {}).get("Code") in ("NoSuchKey", "404"):
                return None
            raise

    def head(self, key: str) -> int | None:
        assert_safe_key(key)
        try:
            return int(self.client.head_object(Bucket=self.bucket, Key=key)["ContentLength"])
        except ClientError as e:
            if e.response.get("Error", {}).get("Code") in ("NoSuchKey", "404", "NotFound"):
                return None
            raise

    def put(self, key: str, data: bytes, content_type: str = "image/jpeg") -> None:
        assert_safe_key(key)
        # Keys never change content (one key per photo version), so browsers may cache them for good.
        self.client.put_object(Bucket=self.bucket, Key=key, Body=data, ContentType=content_type, CacheControl="private, max-age=31536000, immutable")


class LocalStorage:
    driver = "local"

    def __init__(self, s: Settings):
        self.root = Path(s.local_storage_dir)

    def _path(self, key: str) -> Path:
        assert_safe_key(key)
        return self.root / key

    def get(self, key: str) -> bytes | None:
        p = self._path(key)
        return p.read_bytes() if p.is_file() else None

    def head(self, key: str) -> int | None:
        p = self._path(key)
        return p.stat().st_size if p.is_file() else None

    def put(self, key: str, data: bytes, content_type: str = "image/jpeg") -> None:
        p = self._path(key)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(data)


def create_storage(s: Settings) -> R2Storage | LocalStorage:
    return R2Storage(s) if s.r2_configured else LocalStorage(s)
