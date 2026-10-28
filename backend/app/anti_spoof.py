from __future__ import annotations

import cv2
import numpy as np
import onnxruntime as ort

from .config import MODEL_DIR, SPOOF_27_FILE, SPOOF_40_FILE, SPOOF_REAL_THRESHOLD
from .image_util import crop_with_margin


def _softmax(x: np.ndarray) -> np.ndarray:
    e = np.exp(x - np.max(x))
    return e / np.sum(e)


class SilentAntiSpoof:
    """MiniFASNet Silent-Face-Anti-Spoofing (2.7 and 4.0 scales)."""

    def __init__(self) -> None:
        opts = ort.SessionOptions()
        opts.inter_op_num_threads = 1
        opts.intra_op_num_threads = 1
        self.sessions = [
            (2.7, ort.InferenceSession(str(MODEL_DIR / SPOOF_27_FILE), opts, providers=["CPUExecutionProvider"])),
            (4.0, ort.InferenceSession(str(MODEL_DIR / SPOOF_40_FILE), opts, providers=["CPUExecutionProvider"])),
        ]

    def _prep(self, image: np.ndarray, box, scale: float) -> np.ndarray:
        h, w = image.shape[:2]
        x, y, bw, bh = [float(v) for v in box]
        cx = x + bw / 2
        cy = y + bh / 2
        side = max(bw, bh) * scale
        x1 = int(cx - side / 2)
        y1 = int(cy - side / 2)
        x2 = int(cx + side / 2)
        y2 = int(cy + side / 2)
        left = max(0, -x1)
        top = max(0, -y1)
        right = max(0, x2 - w)
        bottom = max(0, y2 - h)
        x1c, y1c = max(x1, 0), max(y1, 0)
        x2c, y2c = min(x2, w), min(y2, h)
        crop = image[y1c:y2c, x1c:x2c]
        if left or top or right or bottom:
            crop = cv2.copyMakeBorder(crop, top, bottom, left, right, cv2.BORDER_CONSTANT)
        crop = cv2.resize(crop, (80, 80))
        blob = crop.astype(np.float32)
        blob = np.transpose(blob, (2, 0, 1))
        blob = np.expand_dims(blob, 0)
        return blob

    def score(self, image: np.ndarray, box) -> dict:
        real_scores = []
        fake_scores = []
        for scale, sess in self.sessions:
            blob = self._prep(image, box, scale)
            inp = sess.get_inputs()[0].name
            out = sess.run(None, {inp: blob})[0].reshape(-1)
            prob = _softmax(out.astype(np.float64))
            # typical MiniFASNet: [spoof, real] or 3-class [spoof, real, fake]
            if prob.size == 2:
                fake, real = float(prob[0]), float(prob[1])
            else:
                fake = float(prob[0] + (prob[2] if prob.size > 2 else 0))
                real = float(prob[1])
            real_scores.append(real)
            fake_scores.append(fake)
        real = float(np.mean(real_scores))
        fake = float(np.mean(fake_scores))
        return {
            "real": real,
            "fake": fake,
            "is_real": real >= SPOOF_REAL_THRESHOLD and real > fake,
        }


class TextureSpoofFallback:
    """Used only if MiniFASNet models are missing. Weaker than MiniFASNet."""

    def score(self, image: np.ndarray, box) -> dict:
        crop = crop_with_margin(image, box, 0.35)
        gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
        gray = cv2.resize(gray, (160, 160))
        lap = cv2.Laplacian(gray, cv2.CV_64F)
        lap_std = float(np.std(lap))
        hsv = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV)
        sat = hsv[:, :, 1].astype(np.float32)
        val = hsv[:, :, 2].astype(np.float32)
        sat_mean = float(np.mean(sat))
        val_std = float(np.std(val))
        edges = cv2.Canny(gray, 60, 140)
        edge_ratio = float(np.mean(edges > 0))
        # photos/screens: flatter laplacian, more uniform value, harsh rectangular edges
        real = 0.5
        if lap_std > 18:
            real += 0.18
        if 35 < sat_mean < 150:
            real += 0.12
        if val_std > 28:
            real += 0.12
        if edge_ratio < 0.18:
            real += 0.08
        if lap_std < 8:
            real -= 0.28
        if val_std < 14:
            real -= 0.18
        real = float(np.clip(real, 0.0, 1.0))
        return {"real": real, "fake": 1.0 - real, "is_real": real >= 0.55}


_spoof = None


def get_spoof():
    global _spoof
    if _spoof is None:
        p27 = MODEL_DIR / SPOOF_27_FILE
        p40 = MODEL_DIR / SPOOF_40_FILE
        if p27.exists() and p40.exists():
            _spoof = SilentAntiSpoof()
        else:
            _spoof = TextureSpoofFallback()
    return _spoof
