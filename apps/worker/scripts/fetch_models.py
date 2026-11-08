"""Downloads the OpenCV Zoo face models (Apache-2.0, D7) at image build time and checks their SHA-256."""

import hashlib
import sys
import urllib.request
from pathlib import Path

# The same repository from two hosts: GitHub serves these files through Git LFS, which sometimes answers 504.
MIRRORS = [
    "https://github.com/opencv/opencv_zoo/raw/main/models",
    "https://huggingface.co/opencv/opencv_zoo/resolve/main/models",
]
MODELS = {
    "face_detection_yunet_2023mar.onnx": (
        "face_detection_yunet/face_detection_yunet_2023mar.onnx",
        "8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4",
    ),
    "face_recognition_sface_2021dec.onnx": (
        "face_recognition_sface/face_recognition_sface_2021dec.onnx",
        "0ba9fbfa01b5270c96627c4ef784da859931e02f04419c829e83484087c34e79",
    ),
}


def download(rel: str, sha256: str) -> bytes:
    for base in MIRRORS:
        try:
            with urllib.request.urlopen(f"{base}/{rel}", timeout=120) as res:
                data = res.read()
        except OSError as e:
            print(f"{base}: {e}; trying the next mirror")
            continue
        digest = hashlib.sha256(data).hexdigest()
        if digest == sha256:
            return data
        print(f"{base}: checksum mismatch ({digest}); trying the next mirror")
    sys.exit(f"{rel}: could not download a file with the expected checksum")


def main(target: Path) -> None:
    target.mkdir(parents=True, exist_ok=True)
    for name, (rel, sha256) in MODELS.items():
        path = target / name
        if not path.exists() or hashlib.sha256(path.read_bytes()).hexdigest() != sha256:
            path.write_bytes(download(rel, sha256))
        print(f"{name}: ok")


if __name__ == "__main__":
    main(Path(sys.argv[1] if len(sys.argv) > 1 else "models"))
