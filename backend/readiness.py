"""Snapshot readiness checks for GET /ready (Wave 4 / D-06, OB-03)."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.exc import SQLAlchemyError

from backend.snapshot import (
    SCHEMA_VERSION,
    get_sanitization_source,
    get_snapshot_engine,
    read_meta,
    resolve_snapshot_path,
)

# Wave 0 FRESH: engineering placeholder until owner SIGNED (see WAVE-0-DECISIONS.md).
DEFAULT_SNAPSHOT_MAX_AGE_DAYS = 14.0


def snapshot_max_age_days() -> float:
    """Max snapshot age in days; override with ``SNAPSHOT_MAX_AGE_DAYS``."""
    raw = os.environ.get("SNAPSHOT_MAX_AGE_DAYS", "").strip()
    if raw:
        return max(0.0, float(raw))
    return DEFAULT_SNAPSHOT_MAX_AGE_DAYS


def snapshot_max_age_seconds() -> float:
    return snapshot_max_age_days() * 86400.0


def parse_loaded_at(loaded_at: str | None) -> datetime | None:
    if not loaded_at:
        return None
    text = loaded_at.strip()
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    try:
        dt = datetime.fromisoformat(text)
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def snapshot_age_seconds(
    loaded_at: str | None,
    *,
    now: datetime | None = None,
) -> float | None:
    dt = parse_loaded_at(loaded_at)
    if dt is None:
        return None
    current = now or datetime.now(timezone.utc)
    return max(0.0, (current - dt).total_seconds())


def is_snapshot_stale(
    loaded_at: str | None,
    *,
    now: datetime | None = None,
    max_age_days: float | None = None,
) -> bool:
    age = snapshot_age_seconds(loaded_at, now=now)
    if age is None:
        return True
    limit = (
        snapshot_max_age_seconds()
        if max_age_days is None
        else max(0.0, max_age_days) * 86400.0
    )
    return age > limit


def snapshot_freshness_fields(
    loaded_at: str | None,
    *,
    now: datetime | None = None,
) -> dict[str, Any]:
    """Extra process-meta keys for UI / process_done (age + stale flag)."""
    age = snapshot_age_seconds(loaded_at, now=now)
    max_days = snapshot_max_age_days()
    stale = is_snapshot_stale(loaded_at, now=now, max_age_days=max_days)
    return {
        "snapshot_age_s": None if age is None else round(age, 3),
        "snapshot_stale": stale,
        "snapshot_max_age_days": max_days,
    }


@dataclass
class ReadinessResult:
    """Outcome of readiness evaluation (HTTP 200 vs 503)."""

    ok: bool
    reasons: list[str] = field(default_factory=list)
    snapshot_present: bool = False
    snapshot_loaded_at: str | None = None
    snapshot_age_s: float | None = None
    snapshot_row_count: int | None = None
    schema_version: str | None = None
    schema_ok: bool = False
    sanitization_source: str | None = None

    def to_dict(self, *, version: str) -> dict[str, Any]:
        return {
            "status": "ready" if self.ok else "not_ready",
            "version": version,
            "sanitization_source": self.sanitization_source,
            "snapshot_present": self.snapshot_present,
            "snapshot_loaded_at": self.snapshot_loaded_at,
            "snapshot_age_s": self.snapshot_age_s,
            "snapshot_max_age_days": snapshot_max_age_days(),
            "snapshot_row_count": self.snapshot_row_count,
            "schema_version": self.schema_version,
            "schema_ok": self.schema_ok,
            "reasons": list(self.reasons),
        }


def evaluate_readiness(*, now: datetime | None = None) -> ReadinessResult:
    """Check Q10012 snapshot file, schema, rows, and freshness SLA."""
    source = get_sanitization_source()
    result = ReadinessResult(ok=True, sanitization_source=source)
    path = resolve_snapshot_path()

    if not path.is_file():
        result.ok = False
        result.reasons.append("snapshot_missing")
        return result

    result.snapshot_present = True
    try:
        engine = get_snapshot_engine(create_schema=False)
        meta = read_meta(engine)
    except (SQLAlchemyError, OSError, ValueError):
        result.ok = False
        result.reasons.append("snapshot_unreadable")
        return result

    result.snapshot_loaded_at = meta.loaded_at
    result.snapshot_row_count = meta.row_count
    result.schema_version = meta.schema_version
    result.schema_ok = meta.schema_version == SCHEMA_VERSION
    age = snapshot_age_seconds(meta.loaded_at, now=now)
    result.snapshot_age_s = None if age is None else round(age, 3)

    if not result.schema_ok:
        result.ok = False
        result.reasons.append("schema_mismatch")
    if meta.row_count <= 0:
        result.ok = False
        result.reasons.append("empty_rows")
    if meta.loaded_at is None or age is None:
        result.ok = False
        result.reasons.append("loaded_at_missing")
    elif is_snapshot_stale(meta.loaded_at, now=now):
        result.ok = False
        result.reasons.append("stale")

    return result
