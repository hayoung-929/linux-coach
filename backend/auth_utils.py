"""JWT creation/verification, password hashing, and reset-token utilities."""

from __future__ import annotations

import hashlib
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import JWTError, jwt
from passlib.context import CryptContext

# TODO: switch to httpOnly cookie transport in production
SECRET_KEY = os.getenv("JWT_SECRET", "dev-secret-key-CHANGE-THIS-IN-PRODUCTION")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 30

_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain: str) -> str:
    return _pwd.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return _pwd.verify(plain, hashed)


def create_access_token(user_id: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    return jwt.encode({"sub": str(user_id), "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> Optional[int]:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        return None


# ── Password-reset tokens ─────────────────────────────────────────────────────

RESET_TOKEN_EXPIRE_MINUTES = 30


def generate_reset_token() -> str:
    """Return a URL-safe random token (256 bits of entropy)."""
    return secrets.token_urlsafe(32)


def hash_reset_token(raw_token: str) -> str:
    """SHA-256 hash of the raw token for storage.

    We use SHA-256 (not bcrypt) because:
    - The token is already high-entropy random data (256 bits)
    - We need fast lookup by hash on the DB side
    - bcrypt's 72-byte limit and slow KDF are unnecessary here
    """
    return hashlib.sha256(raw_token.encode()).hexdigest()


def mask_email(email: str) -> str:
    """Return a privacy-safe masked email, e.g. kim@example.com → k**@example.com."""
    if "@" not in email:
        return "***"
    local, domain = email.split("@", 1)
    if len(local) <= 1:
        masked_local = local
    else:
        masked_local = local[0] + "**"
    return f"{masked_local}@{domain}"
