"""Atomic snapshot publish with previous-file retention (Wave 2 / D-01, D-02, 2.5)."""

from __future__ import annotations

import logging
import os
from pathlib import Path

logger = logging.getLogger(__name__)


def snapshot_tmp_path(dest: Path) -> Path:
    """Candidate DB path written before gates / swap."""
    return dest.with_name(dest.name + ".tmp")


def snapshot_prev_path(dest: Path, index: int = 0) -> Path:
    """``dest.prev`` for index 0, ``dest.prev.1`` … for older copies."""
    if index <= 0:
        return dest.with_name(dest.name + ".prev")
    return dest.with_name(f"{dest.name}.prev.{index}")


def _env_keep_prev() -> int:
    raw = os.environ.get("SNAPSHOT_PREV_KEEP", "").strip()
    if not raw:
        return 1
    return max(0, int(raw))


def publish_snapshot_atomic(
    tmp_path: Path,
    dest_path: Path,
    *,
    keep_prev: int | None = None,
) -> None:
    """Retain previous dest copies, then ``os.replace`` tmp into place.

    Callers must dispose any SQLite engines that hold ``tmp_path`` / ``dest_path``
    before invoking (Windows file locks).
    """
    tmp_path = tmp_path.resolve()
    dest_path = dest_path.resolve()
    if not tmp_path.is_file():
        raise FileNotFoundError(f"Snapshot tmp missing: {tmp_path}")

    dest_path.parent.mkdir(parents=True, exist_ok=True)
    n = _env_keep_prev() if keep_prev is None else max(0, keep_prev)

    if dest_path.is_file() and n > 0:
        # Shift .prev.(i-1) → .prev.i (drop the oldest that would fall off).
        for i in range(n - 1, 0, -1):
            src = snapshot_prev_path(dest_path, i - 1)
            target = snapshot_prev_path(dest_path, i)
            if src.is_file():
                if target.is_file():
                    target.unlink()
                os.replace(src, target)
        prev0 = snapshot_prev_path(dest_path, 0)
        if prev0.is_file():
            prev0.unlink()
        os.replace(dest_path, prev0)
        logger.info("Kept previous snapshot at %s", prev0)
    elif dest_path.is_file() and n <= 0:
        dest_path.unlink()

    os.replace(tmp_path, dest_path)
    logger.info("Published snapshot %s ← tmp", dest_path)
