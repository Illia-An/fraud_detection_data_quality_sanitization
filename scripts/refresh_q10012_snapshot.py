"""Full-reload Q10012 daily snapshot from the production VIEW into SQLite.

Usage (repo root):
  uv run python scripts/refresh_q10012_snapshot.py
  uv run python scripts/refresh_q10012_snapshot.py --from-date 2025-01-01
  uv run python scripts/refresh_q10012_snapshot.py --out data/q10012_snapshot.sqlite

Requires DATABASE_URL (SQL Server VIEW). Writes local SQLite (may contain PII —
never commit). Idempotent full rebuild of answers + store_month + snapshot_meta.
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
from backend.queries import TOP_BOX_VALUE
from backend.snapshot import (
    ANSWERS_TABLE,
    DEFAULT_SNAPSHOT_PATH,
    STORE_MONTH_TABLE,
    get_snapshot_engine,
    init_snapshot_schema,
    resolve_snapshot_path,
    set_meta,
    utc_now_iso,
)

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


def refresh_snapshot(*, from_date: date, out_path: Path) -> dict[str, object]:
    """Pull VIEW → SQLite full reload. Returns summary stats."""
    out_path.parent.mkdir(parents=True, exist_ok=True)
    # Force file path for this run (SNAPSHOT_URL may point elsewhere).
    import os

    os.environ["SNAPSHOT_URL"] = f"sqlite:///{out_path.resolve().as_posix()}"

    t0 = time.perf_counter()
    src = _engine_from_settings()
    snap = get_snapshot_engine(create_schema=True)
    init_snapshot_schema(snap)
    loaded_at = utc_now_iso()

    sql, params = _pull_sql(from_date)
    logger.info("Pulling from %s (AnswerTime >= %s)…", VIEW_NAME, from_date.isoformat())

    insert_sql = text(
        f"""
INSERT INTO {ANSWERS_TABLE} (
    ParticipateNumber, Question_ID, Answer_Value, BlackList,
    UserContact, PhoneFromLog, ext_user_id, PrintStore,
    AnswerTime, Year, Month, LoadedAt
) VALUES (
    :ParticipateNumber, :Question_ID, :Answer_Value, :BlackList,
    :UserContact, :PhoneFromLog, :ext_user_id, :PrintStore,
    :AnswerTime, :Year, :Month, :LoadedAt
)
"""
    )

    row_count = 0
    with src.connect() as src_conn, snap.begin() as dst:
        dst.execute(text(f"DELETE FROM {ANSWERS_TABLE}"))
        dst.execute(text(f"DELETE FROM {STORE_MONTH_TABLE}"))

        result = src_conn.execute(text(sql), params)
        batch: list[dict] = []
        for mapping in result.mappings():
            row = dict(mapping)
            pn = row.get("ParticipateNumber")
            av = row.get("Answer_Value")
            batch.append(
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
            if len(batch) >= _BATCH:
                dst.execute(insert_sql, batch)
                row_count += len(batch)
                logger.info("  …inserted %s rows", row_count)
                batch = []
        if batch:
            dst.execute(insert_sql, batch)
            row_count += len(batch)

        # Pre-aggregate store×month for Query A.
        dst.execute(
            text(
                f"""
INSERT INTO {STORE_MONTH_TABLE} (
    PrintStore, Year, Month, total_count, top_box_count
)
SELECT
    PrintStore,
    Year,
    Month,
    COUNT(*) AS total_count,
    SUM(CASE WHEN Answer_Value = :top_box THEN 1 ELSE 0 END) AS top_box_count
FROM {ANSWERS_TABLE}
WHERE PrintStore IS NOT NULL
  AND Year IS NOT NULL
  AND Month IS NOT NULL
GROUP BY PrintStore, Year, Month
"""
            ),
            {"top_box": TOP_BOX_VALUE},
        )
        store_month_count = int(
            dst.execute(text(f"SELECT COUNT(*) FROM {STORE_MONTH_TABLE}")).scalar() or 0
        )

    set_meta(
        snap,
        {
            "loaded_at": loaded_at,
            "row_count": str(row_count),
            "store_month_count": str(store_month_count),
            "source_view": VIEW_NAME,
            "from_date": from_date.isoformat(),
        },
    )

    elapsed = round(time.perf_counter() - t0, 2)
    summary = {
        "path": str(out_path.resolve()),
        "row_count": row_count,
        "store_month_count": store_month_count,
        "loaded_at": loaded_at,
        "from_date": from_date.isoformat(),
        "elapsed_s": elapsed,
    }
    logger.info(
        "Snapshot ready: %s rows, %s store×month cells → %s (%.1fs)",
        row_count,
        store_month_count,
        out_path,
        elapsed,
    )
    return summary


def main() -> int:
    args = _parse_args()
    out = args.out or resolve_snapshot_path()
    try:
        refresh_snapshot(from_date=args.from_date, out_path=out)
    except Exception:
        logger.exception("Snapshot refresh failed")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
