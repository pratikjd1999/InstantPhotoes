"""Face detection (YuNet) and 128-d embeddings (SFace), PRC-3/PRC-4 and GST-4.

OpenCV model objects are not thread-safe, so every thread builds its own FaceEngine.
Embeddings are L2-normalised, so pgvector's cosine distance (`<=>`) gives 1 - cosine similarity directly.
"""

from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

DETECTOR = "face_detection_yunet_2023mar.onnx"
RECOGNIZER = "face_recognition_sface_2021dec.onnx"

# Size range (shorter side, pixels) for faces the detector is unsure about. Smaller ones are too small to identify;
# a real face larger than this is detected with high confidence, so an unsure large box is almost always background.
UNSURE_PX = (40, 160)


@dataclass
class Face:
    x: float
    y: float
    w: float
    h: float
    score: float
    embedding: np.ndarray  # (128,) float32, unit length

    def bbox(self, img_w: int, img_h: int) -> dict:
        """Box as fractions of the image, so it fits any version of the photo."""
        return {
            "x": round(self.x / img_w, 5),
            "y": round(self.y / img_h, 5),
            "w": round(self.w / img_w, 5),
            "h": round(self.h / img_h, 5),
        }


def to_bgr(img: Image.Image) -> np.ndarray:
    return np.ascontiguousarray(np.asarray(img)[:, :, ::-1])


class FaceEngine:
    def __init__(self, models_dir: str, min_score: float):
        d = Path(models_dir)
        # Low built-in threshold; filtering happens in detect() so photos and selfies can use different rules.
        self.detector = cv2.FaceDetectorYN.create(str(d / DETECTOR), "", (320, 320), 0.5, 0.3, 5000)
        self.recognizer = cv2.FaceRecognizerSF.create(str(d / RECOGNIZER), "")
        self.min_score = min_score

    def detect(self, bgr: np.ndarray, min_px: int, sure_score: float | None = None) -> list[Face]:
        """`sure_score`: faces scoring below it must also fall within UNSURE_PX. Selfies leave it out."""
        h, w = bgr.shape[:2]
        self.detector.setInputSize((w, h))
        _, rows = self.detector.detect(bgr)
        faces: list[Face] = []
        for row in rows if rows is not None else []:
            x, y, fw, fh, score = float(row[0]), float(row[1]), float(row[2]), float(row[3]), float(row[14])
            side = min(fw, fh)
            if score < self.min_score or side < min_px:
                continue
            if sure_score is not None and score < sure_score and not UNSURE_PX[0] <= side <= UNSURE_PX[1]:
                continue
            aligned = self.recognizer.alignCrop(bgr, row)
            vec = self.recognizer.feature(aligned).flatten().astype(np.float32)
            norm = float(np.linalg.norm(vec))
            if norm == 0:
                continue
            faces.append(Face(x=max(0.0, x), y=max(0.0, y), w=fw, h=fh, score=score, embedding=vec / norm))
        return faces


def vector_literal(v: np.ndarray) -> str:
    return "[" + ",".join(f"{x:.6f}" for x in v.tolist()) + "]"
