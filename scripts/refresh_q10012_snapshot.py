"""Full-reload Q10012 daily snapshot from the production VIEW into SQLite.

Usage (repo root):
  uv run python scripts/refresh_q10012_snapshot.py
  uv run python scripts/refresh_q10012_snapshot.py --from-date 2025-01-01
  uv run python scripts/refresh_q10012_snapshot.py --out data/q10012_snapshot.sqlite

Requires DATABASE_URL (SQL Server VIEW). Writes local SQLite (may contain PII —
never commit). Wave 2: build ``*.tmp``, run gates, write meta, ``os.replace``,
keep ``*.prev`` copies. Idempotent full rebuild of answers + store_month + meta.
"""

from __future__ import annotations

import argparse
import logging
import sys
import time
from datetime import date, datetime
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import text

from backend.db_sample import (
    DEFAULT_FROM_DATE,
    QUESTION_ID,
    VIEW_NAME,
    _engine_from_settings,
)
from backend.snapshot import (
    DEFAULT_SNAPSHOT_PATH,
    get_snapshot_engine_at,
    read_meta,
    resolve_snapshot_path,
    utc_now_iso,
)
from backend.snapshot_gates import SnapshotGateError, validate_snapshot_gates
from backend.snapshot_publish import publish_snapshot_atomic, snapshot_tmp_path
from backend.snapshot_refresh import write_snapshot_from_rows

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("refresh_q10012_snapshot")

# Must-columns only (Invariant 4) — matches SPEC / DB request docx.
_PULL_COLUMNS = (
    "ParticipateNumber",
    "Question_ID",
    "Answer_Value",
    "BlackList",
    "UserContact",
    "PhoneFromLog",
    "ext_user_id",
    "PrintStore",
    "AnswerTime",
    "Year",
    "Month",
)

_BATCH = 5_000


def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument(
        "--from-date",
        type=date.fromisoformat,
        default=DEFAULT_FROM_DATE,
        help=f"Inclusive AnswerTime lower bound (default {DEFAULT_FROM_DATE})",
    )
    p.add_argument(
        "--out",
        type=Path,
        default=None,
        help=f"SQLite file path (default {DEFAULT_SNAPSHOT_PATH})",
    )
    return p.parse_args()


def _pull_sql(from_date: date) -> tuple[str, dict]:
    cols = ",\n    ".join(_PULL_COLUMNS)
    sql = f"""
SELECT
    {cols}
FROM {VIEW_NAME}
WHERE Question_ID = :question_id
  AND Answer_Value IS NOT NULL
  AND AnswerTime >= :from_date
ORDER BY AnswerTime ASC
"""
    params = {
        "question_id": QUESTION_ID,
        "from_date": datetime.combine(from_date, datetime.min.time()),
    }
    return sql, params


def _as_iso(value: object) -> str | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.replace(microsecond=0).isoformat(sep=" ")
    if isinstance(value, date):
        return value.isoformat()
    return str(value)


def _previous_row_count(out_path: Path) -> int | None:
    if not out_path.is_file():
        return None
    engine = get_snapshot_engine_at(out_path, create_schema=False)
    try:
        return read_meta(engine).row_count
    finally:
        engine.dispose()


def refresh_snapshot(*, from_date: date, out_path: Path) -> dict[str, object]:
    """Pull VIEW → tmp SQLite → gates → atomic publish. Returns summary stats."""
    out_path = out_path.resolve()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = snapshot_tmp_path(out_path)
    if tmp_path.exists():
        tmp_path.unlink()

    t0 = time.perf_counter()
    previous = _previous_row_count(out_path)
    src = _engine_from_settings()
    loaded_at = utc_now_iso()
    sql, params = _pull_sql(from_date)
    logger.info("Pulling from %s (AnswerTime >= %s)…", VIEW_NAME, from_date.isoformat())

    rows: list[dict[str, object]] = []
    try:
        with src.connect() as src_conn:
            result = src_conn.execute(text(sql), params)
            for mapping in result.mappings():
                row = dict(mapping)
                pn = row.get("ParticipateNumber")
                av = row.get("Answer_Value")
                rows.append(
                    {
                        "ParticipateNumber": None if pn is None else str(pn),
                        "Question_ID": row.get("Question_ID"),
                        "Answer_Value": int(av) if av is not None else None,
                        "BlackList": row.get("BlackList"),
                        "UserContact": row.get("UserContact"),
                        "PhoneFromLog": row.get("PhoneFromLog"),
                        "ext_user_id": row.get("ext_user_id"),
                        "PrintStore": row.get("PrintStore"),
                        "AnswerTime": _as_iso(row.get("AnswerTime")),
                        "Year": row.get("Year"),
                        "Month": row.get("Month"),
                        "LoadedAt": loaded_at,
                    }
                )
                if len(rows) % _BATCH == 0:
                    logger.info("  …pulled %s rows", len(rows))
    finally:
        src.dispose()

    logger.info("Pulled %s rows; writing tmp %s", len(rows), tmp_path)
    summary = write_snapshot_from_rows(
        out_path=tmp_path,
        rows=rows,
        from_date=from_date,
        loaded_at=loaded_at,
        source_view=VIEW_NAME,
    )

    tmp_engine = get_snapshot_engine_at(tmp_path, create_schema=False)
    try:
        gates = validate_snapshot_gates(
            tmp_engine, previous_row_count=previous if previous else None
        )
        summary["duplicate_participate_count"] = gates.duplicate_participate_count
        summary["answers_keyed_count"] = gates.answers_keyed_count
    except SnapshotGateError:
        tmp_engine.dispose()
        if tmp_path.is_file():
            tmp_path.unlink()
        raise
    else:
        tmp_engine.dispose()

    publish_snapshot_atomic(tmp_path, out_path)

    elapsed = round(time.perf_counter() - t0, 2)
    summary["path"] = str(out_path)
    summary["elapsed_s"] = elapsed
    summary["previous_row_count"] = previous
    logger.info(
        "Snapshot ready: %s rows, %s store×month cells → %s (%.1fs)",
        summary["row_count"],
        summary["store_month_count"],
        out_path,
        elapsed,
    )
    return summary


def main() -> int:
    args = _parse_args()
    out = args.out or resolve_snapshot_path()
    try:
        refresh_snapshot(from_date=args.from_date, out_path=out)
    except SnapshotGateError as exc:
        logger.error("Snapshot refresh blocked by gate: %s", exc)
        return 2
    except Exception:
        logger.exception("Snapshot refresh failed")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
