from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

import cv2
import numpy as np
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from . import models
from .anti_spoof import get_spoof
from .config import MATCH_THRESHOLD, THUMB_DIR
from .db import Base, engine, get_db
from .face_engine import get_engine
from .image_util import crop_with_margin, decode_image
from .liveness import CHALLENGES, validate_signals
from .schemas import AnalyzeIn, EnrollIn, PersonUpdate

Base.metadata.create_all(bind=engine)

app = FastAPI(title="LiveFace Gate")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

THUMB_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/thumbs", StaticFiles(directory=str(THUMB_DIR)), name="thumbs")


def _iso(dt: datetime | None) -> str:
    if dt is None:
        return ""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()


def _thumb_url(path: str) -> str:
    if not path:
        return ""
    name = Path(path).name
    return f"/thumbs/{name}"


def person_out(p: models.Person) -> dict:
    return {
        "id": p.id,
        "name": p.name,
        "person_id": p.person_id,
        "notes": p.notes or "",
        "thumbnail_url": _thumb_url(p.thumbnail_path),
        "created_at": _iso(p.created_at),
    }


def load_gallery(db: Session) -> list[tuple[models.Person, np.ndarray]]:
    rows = db.query(models.FaceEmbedding).all()
    people = {p.id: p for p in db.query(models.Person).all()}
    gallery = []
    for row in rows:
        person = people.get(row.person_pk)
        if person is None:
            continue
        vec = np.frombuffer(row.vector, dtype=np.float32)
        n = np.linalg.norm(vec)
        if n > 0:
            vec = vec / n
        gallery.append((person, vec))
    return gallery


def best_match(vec: np.ndarray, gallery: list[tuple[models.Person, np.ndarray]]):
    if not gallery:
        return None, 0.0
    best_p = None
    best_s = -1.0
    for person, stored in gallery:
        sim = float(np.dot(vec, stored))
        if sim > best_s:
            best_s = sim
            best_p = person
    return best_p, best_s


def inspect_frame(image: np.ndarray, challenge: str, signals: dict, require_challenge: bool = True) -> dict:
    if require_challenge:
        live_ok, live_reason = validate_signals(challenge, signals)
    else:
        live_ok, live_reason = True, "ok"
    engine = get_engine()
    faces = engine.detect_with_raw(image)

    if len(faces) == 0:
        return {"ok": False, "reason": "no_face", "liveness": live_reason}
    if len(faces) > 1:
        return {"ok": False, "reason": "multiple_faces", "liveness": live_reason}

    face = faces[0]
    q = engine.quality_check(image, face)
    if q:
        return {"ok": False, "reason": q, "liveness": live_reason}

    if not live_ok:
        return {"ok": False, "reason": live_reason, "liveness": live_reason}

    spoof = get_spoof().score(image, face["box"])
    if not spoof["is_real"]:
        return {
            "ok": False,
            "reason": "spoof_detected",
            "liveness": live_reason,
            "spoof": spoof,
            "face": face,
        }

    aligned = engine.align_crop(image, face)
    vec = engine.embedding(aligned)
    return {
        "ok": True,
        "reason": "live_face",
        "liveness": live_reason,
        "spoof": spoof,
        "face": face,
        "vec": vec,
        "aligned": aligned,
    }


def log_event(db: Session, result: str, reason: str, person_pk=None, similarity=0.0, spoof_score=0.0):
    db.add(
        models.ScanEvent(
            result=result,
            reason=reason,
            person_pk=person_pk,
            similarity=similarity,
            spoof_score=spoof_score,
        )
    )
    db.commit()


@app.get("/api/health")
def health():
    return {"ok": True}


@app.get("/api/people")
def list_people(db: Session = Depends(get_db)):
    rows = db.query(models.Person).order_by(models.Person.created_at.desc()).all()
    return [person_out(p) for p in rows]


@app.get("/api/people/{pk}")
def get_person(pk: int, db: Session = Depends(get_db)):
    p = db.query(models.Person).filter(models.Person.id == pk).first()
    if not p:
        raise HTTPException(404, "Person not found")
    return person_out(p)


@app.patch("/api/people/{pk}")
def update_person(pk: int, body: PersonUpdate, db: Session = Depends(get_db)):
    p = db.query(models.Person).filter(models.Person.id == pk).first()
    if not p:
        raise HTTPException(404, "Person not found")
    if body.name is not None:
        p.name = body.name.strip()
    if body.notes is not None:
        p.notes = body.notes
    db.commit()
    db.refresh(p)
    return person_out(p)


@app.delete("/api/people/{pk}")
def delete_person(pk: int, db: Session = Depends(get_db)):
    p = db.query(models.Person).filter(models.Person.id == pk).first()
    if not p:
        raise HTTPException(404, "Person not found")
    if p.thumbnail_path:
        path = Path(p.thumbnail_path)
        if path.exists():
            path.unlink(missing_ok=True)
    db.delete(p)
    db.commit()
    return {"ok": True}


@app.post("/api/analyze")
def analyze(body: AnalyzeIn, db: Session = Depends(get_db)):
    if body.challenge not in CHALLENGES:
        raise HTTPException(400, "Invalid challenge")
    try:
        image = decode_image(body.image)
    except Exception as exc:
        raise HTTPException(400, f"Bad image: {exc}") from exc

    inspected = inspect_frame(image, body.challenge, body.signals)
    spoof = inspected.get("spoof") or {}
    spoof_score = float(spoof.get("real") or 0)

    if not inspected["ok"]:
        log_event(db, "reject", inspected["reason"], spoof_score=spoof_score)
        return {
            "ok": False,
            "status": "reject",
            "reason": inspected["reason"],
            "spoof_score": spoof_score,
            "person": None,
            "similarity": 0,
        }

    if body.mode == "enroll_preview":
        return {
            "ok": True,
            "status": "live",
            "reason": "live_face",
            "spoof_score": spoof_score,
            "person": None,
            "similarity": 0,
        }

    gallery = load_gallery(db)
    person, sim = best_match(inspected["vec"], gallery)
    if person is None or sim < MATCH_THRESHOLD:
        log_event(db, "unknown", "unknown_person", similarity=sim, spoof_score=spoof_score)
        return {
            "ok": False,
            "status": "unknown",
            "reason": "unknown_person",
            "spoof_score": spoof_score,
            "person": None,
            "similarity": round(sim, 4),
        }

    log_event(db, "match", "matched", person_pk=person.id, similarity=sim, spoof_score=spoof_score)
    return {
        "ok": True,
        "status": "match",
        "reason": "matched",
        "spoof_score": spoof_score,
        "person": person_out(person),
        "similarity": round(sim, 4),
    }


@app.post("/api/enroll")
def enroll(body: EnrollIn, db: Session = Depends(get_db)):
    name = (body.name or "").strip()
    person_id = (body.person_id or "").strip()
    if not name or not person_id:
        raise HTTPException(400, "Name and ID are required")
    if len(body.images) < 2:
        raise HTTPException(400, "Need at least 2 live frames")
    if db.query(models.Person).filter(models.Person.person_id == person_id).first():
        raise HTTPException(409, "A person with this ID already exists")

    engine = get_engine()
    vectors = []
    thumb = None
    last_spoof = 0.0

    for idx, raw in enumerate(body.images):
        try:
            image = decode_image(raw)
        except Exception as exc:
            raise HTTPException(400, f"Bad image: {exc}") from exc

        inspected = inspect_frame(
            image,
            body.challenge,
            body.signals,
            require_challenge=(idx == 0),
        )
        if not inspected["ok"]:
            raise HTTPException(400, f"Live face required ({inspected['reason']})")
        last_spoof = float((inspected.get("spoof") or {}).get("real") or 0)
        vectors.append(inspected["vec"])
        if thumb is None:
            crop = crop_with_margin(image, inspected["face"]["box"], 0.25)
            thumb = crop

    person = models.Person(name=name, person_id=person_id, notes=body.notes or "")
    db.add(person)
    db.flush()

    if thumb is not None:
        thumb_path = THUMB_DIR / f"{person.id}.jpg"
        cv2.imwrite(str(thumb_path), thumb, [int(cv2.IMWRITE_JPEG_QUALITY), 88])
        person.thumbnail_path = str(thumb_path)

    for vec in vectors:
        db.add(models.FaceEmbedding(person_pk=person.id, vector=vec.astype(np.float32).tobytes()))

    db.commit()
    db.refresh(person)
    log_event(db, "enroll", "enrolled", person_pk=person.id, spoof_score=last_spoof)
    return person_out(person)


@app.get("/api/events")
def events(db: Session = Depends(get_db)):
    rows = (
        db.query(models.ScanEvent)
        .order_by(models.ScanEvent.created_at.desc())
        .limit(40)
        .all()
    )
    people = {p.id: p for p in db.query(models.Person).all()}
    out = []
    for e in rows:
        p = people.get(e.person_pk) if e.person_pk else None
        out.append(
            {
                "id": e.id,
                "result": e.result,
                "reason": e.reason,
                "similarity": e.similarity,
                "spoof_score": e.spoof_score,
                "created_at": _iso(e.created_at),
                "person": person_out(p) if p else None,
            }
        )
    return out
