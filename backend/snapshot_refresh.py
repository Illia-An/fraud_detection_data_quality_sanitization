"""Build a Q10012 snapshot SQLite file (Wave 2 refresh helper)."""

from __future__ import annotations

from datetime import date
from pathlib import Path
from typing import Any

from sqlalchemy import text

from backend.queries import TOP_BOX_VALUE
from backend.snapshot import (
    ANSWERS_TABLE,
    SCHEMA_VERSION,
    STORE_MONTH_TABLE,
    get_snapshot_engine_at,
    set_meta_conn,
    utc_now_iso,
)

_BATCH = 5_000


def write_snapshot_from_rows(
    *,
    out_path: Path,
    rows: list[dict[str, Any]],
    from_date: date,
    loaded_at: str | None = None,
    source_view: str = "dbo.TargetsByMetrics_RateGetAnswers",
) -> dict[str, object]:
    """Build a candidate snapshot at ``out_path`` (tmp or final). Meta in same txn."""
    out_path = out_path.resolve()
    if out_path.exists():
        out_path.unlink()

    snap = get_snapshot_engine_at(out_path, create_schema=True)
    loaded = loaded_at or utc_now_iso()
    store_month_count = 0
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
    try:
        with snap.begin() as dst:
            for i in range(0, len(rows), _BATCH):
                chunk = rows[i : i + _BATCH]
                for row in chunk:
                    row.setdefault("LoadedAt", loaded)
                if chunk:
                    dst.execute(insert_sql, chunk)

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
                dst.execute(text(f"SELECT COUNT(*) FROM {STORE_MONTH_TABLE}")).scalar()
                or 0
            )
            row_count = len(rows)
            set_meta_conn(
                dst,
                {
                    "loaded_at": loaded,
                    "row_count": str(row_count),
                    "store_month_count": str(store_month_count),
                    "source_view": source_view,
                    "from_date": from_date.isoformat(),
                    "schema_version": SCHEMA_VERSION,
                },
            )
    finally:
        snap.dispose()

    return {
        "path": str(out_path),
        "row_count": len(rows),
        "store_month_count": store_month_count,
        "loaded_at": loaded,
        "from_date": from_date.isoformat(),
        "schema_version": SCHEMA_VERSION,
    }
