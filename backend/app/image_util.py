import base64
import re

import cv2
import numpy as np


def decode_image(payload: str) -> np.ndarray:
    if "," in payload:
        payload = payload.split(",", 1)[1]
    payload = re.sub(r"\s+", "", payload)
    raw = base64.b64decode(payload)
    arr = np.frombuffer(raw, dtype=np.uint8)
    image = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("Could not decode image")
    return image


def encode_jpeg_b64(image: np.ndarray, quality: int = 85) -> str:
    ok, buf = cv2.imencode(".jpg", image, [int(cv2.IMWRITE_JPEG_QUALITY), quality])
    if not ok:
        raise ValueError("Could not encode image")
    return base64.b64encode(buf.tobytes()).decode("ascii")


def crop_with_margin(image: np.ndarray, box, margin: float = 0.4) -> np.ndarray:
    h, w = image.shape[:2]
    x, y, bw, bh = [float(v) for v in box]
    mx = bw * margin
    my = bh * margin
    x1 = max(int(x - mx), 0)
    y1 = max(int(y - my), 0)
    x2 = min(int(x + bw + mx), w)
    y2 = min(int(y + bh + my), h)
    if x2 <= x1 or y2 <= y1:
        raise ValueError("Invalid face crop")
    return image[y1:y2, x1:x2]


def laplacian_var(gray: np.ndarray) -> float:
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())
