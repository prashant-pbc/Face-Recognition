from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from .config import ADMIN_PASSWORD, ADMIN_USERNAME, SESSION_HOURS
from .db import get_db
from . import models


def _now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _naive(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


def hash_password(password: str, salt: str | None = None) -> tuple[str, str]:
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 180_000).hex()
    return salt, digest


def verify_password(password: str, salt: str, digest: str) -> bool:
    _, check = hash_password(password, salt)
    return secrets.compare_digest(check, digest)


def seed_admin(db: Session) -> None:
    if db.query(models.AdminUser).first():
        return
    salt, digest = hash_password(ADMIN_PASSWORD)
    db.add(models.AdminUser(username=ADMIN_USERNAME, password_salt=salt, password_hash=digest))
    db.commit()


def create_session(db: Session, admin: models.AdminUser) -> str:
    token = secrets.token_urlsafe(32)
    db.add(
        models.AdminSession(
            token=token,
            admin_pk=admin.id,
            expires_at=_now() + timedelta(hours=SESSION_HOURS),
        )
    )
    db.commit()
    return token


def current_admin(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> models.AdminUser:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Admin login required")
    token = authorization.split(" ", 1)[1].strip()
    row = db.query(models.AdminSession).filter(models.AdminSession.token == token).first()
    expires = _naive(row.expires_at) if row else None
    if not row or expires is None or expires < _now():
        raise HTTPException(401, "Session expired. Sign in again.")
    admin = db.query(models.AdminUser).filter(models.AdminUser.id == row.admin_pk).first()
    if not admin:
        raise HTTPException(401, "Admin login required")
    return admin
