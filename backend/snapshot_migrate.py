"""One-shot meta migrations for existing snapshot files (Wave 2+)."""

from __future__ import annotations

import logging
from pathlib import Path

from sqlalchemy import text

from backend.snapshot import (
    ANSWERS_TABLE,
    SCHEMA_VERSION,
    get_snapshot_engine_at,
    read_meta,
    set_meta,
)

logger = logging.getLogger(__name__)


def stamp_schema_version(path: Path, *, force: bool = False) -> int:
    """Write ``schema_version`` on an existing non-empty snapshot. Returns exit code."""
    if not path.is_file():
        logger.error("Snapshot not found: %s", path)
        return 1

    engine = get_snapshot_engine_at(path, create_schema=False)
    try:
        meta = read_meta(engine)
        with engine.connect() as conn:
            n = int(
                conn.execute(text(f"SELECT COUNT(*) FROM {ANSWERS_TABLE}")).scalar()
                or 0
            )
        if n <= 0:
            logger.error("Refusing to stamp: answers table is empty (%s)", path)
            return 2

        if meta.schema_version == SCHEMA_VERSION and not force:
            logger.info(
                "Already schema_version=%s (rows=%s, loaded_at=%s) — nothing to do",
                SCHEMA_VERSION,
                meta.row_count or n,
                meta.loaded_at,
            )
            return 0

        if meta.schema_version not in (None, "", SCHEMA_VERSION) and not force:
            logger.error(
                "Refusing to overwrite schema_version=%r (expected None or %r). "
                "Pass force=True if you intend to set it to %r.",
                meta.schema_version,
                SCHEMA_VERSION,
                SCHEMA_VERSION,
            )
            return 3

        set_meta(
            engine,
            {
                "schema_version": SCHEMA_VERSION,
                "row_count": str(meta.row_count if meta.row_count > 0 else n),
            },
        )
        after = read_meta(engine)
        logger.info(
            "Stamped %s → schema_version=%s rows=%s loaded_at=%s "
            "(PII at rest unchanged; run full refresh to hash)",
            path,
            after.schema_version,
            after.row_count,
            after.loaded_at,
        )
        return 0
    finally:
        engine.dispose()
