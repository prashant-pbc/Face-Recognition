from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np

from .config import (
    DET_SCORE_THRESHOLD,
    MIN_FACE_WIDTH,
    MODEL_DIR,
    SFACE_FILE,
    YUNET_FILE,
)
from .image_util import crop_with_margin, laplacian_var


class FaceEngine:
    def __init__(self) -> None:
        self.detector = cv2.FaceDetectorYN.create(
            str(MODEL_DIR / YUNET_FILE),
            "",
            (320, 320),
            DET_SCORE_THRESHOLD,
            0.3,
            5000,
        )
        self.recognizer = cv2.FaceRecognizerSF.create(
            str(MODEL_DIR / SFACE_FILE),
            "",
        )

    def detect(self, image: np.ndarray) -> list[dict]:
        h, w = image.shape[:2]
        self.detector.setInputSize((w, h))
        _, faces = self.detector.detect(image)
        if faces is None:
            return []
        results = []
        for face in faces:
            box = face[:4].astype(float)
            score = float(face[-1])
            landmarks = face[4:14].reshape(5, 2).astype(float)
            results.append({"box": box, "score": score, "landmarks": landmarks})
        results.sort(key=lambda f: f["box"][2] * f["box"][3], reverse=True)
        return results

    def quality_check(self, image: np.ndarray, face: dict) -> str | None:
        x, y, bw, bh = face["box"]
        if bw < MIN_FACE_WIDTH or bh < MIN_FACE_WIDTH:
            return "face_too_small"
        if face["score"] < DET_SCORE_THRESHOLD:
            return "low_detect_score"
        crop = crop_with_margin(image, face["box"], 0.15)
        gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
        if laplacian_var(gray) < 45:
            return "too_blurry"
        h, w = image.shape[:2]
        cx = x + bw / 2
        cy = y + bh / 2
        if cx < w * 0.12 or cx > w * 0.88 or cy < h * 0.10 or cy > h * 0.92:
            return "face_near_edge"
        return None

    def align_crop(self, image: np.ndarray, face: dict) -> np.ndarray:
        aligned = self.recognizer.alignCrop(image, np.array(face["raw"], dtype=np.float32))
        return aligned

    def embedding(self, aligned: np.ndarray) -> np.ndarray:
        feat = self.recognizer.feature(aligned)
        vec = np.asarray(feat, dtype=np.float32).reshape(-1)
        n = np.linalg.norm(vec)
        if n > 0:
            vec = vec / n
        return vec

    def detect_with_raw(self, image: np.ndarray) -> list[dict]:
        h, w = image.shape[:2]
        self.detector.setInputSize((w, h))
        _, faces = self.detector.detect(image)
        if faces is None:
            return []
        results = []
        for face in faces:
            box = face[:4].astype(float)
            score = float(face[-1])
            landmarks = face[4:14].reshape(5, 2).astype(float)
            results.append(
                {
                    "box": box,
                    "score": score,
                    "landmarks": landmarks,
                    "raw": face.copy(),
                }
            )
        results.sort(key=lambda f: f["box"][2] * f["box"][3], reverse=True)
        return results


_engine: FaceEngine | None = None


def get_engine() -> FaceEngine:
    global _engine
    if _engine is None:
        MODEL_DIR.mkdir(parents=True, exist_ok=True)
        for name in (YUNET_FILE, SFACE_FILE):
            path = MODEL_DIR / name
            if not path.exists():
                raise FileNotFoundError(f"Missing model: {path}")
        _engine = FaceEngine()
    return _engine
