"""Downloads the OpenCV Zoo face models (Apache-2.0, D7) at image build time and checks their SHA-256."""

import hashlib
import sys
import urllib.request
from pathlib import Path

BASE = "https://github.com/opencv/opencv_zoo/raw/main/models"
MODELS = {
    "face_detection_yunet_2023mar.onnx": (
        f"{BASE}/face_detection_yunet/face_detection_yunet_2023mar.onnx",
        "8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4",
    ),
    "face_recognition_sface_2021dec.onnx": (
        f"{BASE}/face_recognition_sface/face_recognition_sface_2021dec.onnx",
        "0ba9fbfa01b5270c96627c4ef784da859931e02f04419c829e83484087c34e79",
    ),
}


def main(target: Path) -> None:
    target.mkdir(parents=True, exist_ok=True)
    for name, (url, sha256) in MODELS.items():
        path = target / name
        if not path.exists():
            with urllib.request.urlopen(url, timeout=120) as res:
                path.write_bytes(res.read())
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        if digest != sha256:
            path.unlink()
            sys.exit(f"{name}: checksum mismatch ({digest})")
        print(f"{name}: ok")


if __name__ == "__main__":
    main(Path(sys.argv[1] if len(sys.argv) > 1 else "models"))
