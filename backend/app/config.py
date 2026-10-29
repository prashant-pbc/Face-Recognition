from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
MODEL_DIR = ROOT / "models"
THUMB_DIR = DATA_DIR / "thumbs"
DB_PATH = DATA_DIR / "sqlite3.db"

ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "liveface-admin"
SESSION_HOURS = 12

YUNET_FILE = "face_detection_yunet_2023mar.onnx"
SFACE_FILE = "face_recognition_sface_2021dec.onnx"
SPOOF_27_FILE = "2.7_80x80_MiniFASNetV2.onnx"
SPOOF_40_FILE = "4_0_0_80x80_MiniFASNetV1SE.onnx"

MATCH_THRESHOLD = 0.38
MIN_FACE_WIDTH = 80
DET_SCORE_THRESHOLD = 0.7
SPOOF_REAL_THRESHOLD = 0.42
DEVICE_FRAME_REJECT = 0.62

MODEL_URLS = {
    YUNET_FILE: [
        "https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx",
        "https://media.githubusercontent.com/media/opencv/opencv_zoo/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx",
    ],
    SFACE_FILE: [
        "https://github.com/opencv/opencv_zoo/raw/main/models/face_recognition_sface/face_recognition_sface_2021dec.onnx",
        "https://media.githubusercontent.com/media/opencv/opencv_zoo/main/models/face_recognition_sface/face_recognition_sface_2021dec.onnx",
    ],
    SPOOF_27_FILE: [
        "https://github.com/clibdev/face-anti-spoofing/raw/master/files/models/anti_spoofing/2.7_80x80_MiniFASNetV2.onnx",
        "https://huggingface.co/public-data/silent-face-anti-spoofing/resolve/main/2.7_80x80_MiniFASNetV2.onnx",
    ],
    SPOOF_40_FILE: [
        "https://github.com/clibdev/face-anti-spoofing/raw/master/files/models/anti_spoofing/4_0_0_80x80_MiniFASNetV1SE.onnx",
        "https://huggingface.co/public-data/silent-face-anti-spoofing/resolve/main/4_0_0_80x80_MiniFASNetV1SE.onnx",
    ],
}
