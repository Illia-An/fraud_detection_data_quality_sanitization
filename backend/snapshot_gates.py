"""Refresh gates for Q10012 snapshot integrity (Wave 2 / D-04, D-08, D-09)."""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass

from sqlalchemy import Engine, text

from backend.snapshot import ANSWERS_TABLE, STORE_MONTH_TABLE, read_meta

logger = logging.getLogger(__name__)


class SnapshotGateError(ValueError):
    """Raised when a candidate snapshot fails integrity gates (do not publish)."""


@dataclass(frozen=True)
class SnapshotGateResult:
    row_count: int
    store_month_count: int
    store_month_sum: int
    answers_keyed_count: int
    duplicate_participate_count: int
    previous_row_count: int | None


def _env_int(name: str, default: int) -> int:
    raw = os.environ.get(name, "").strip()
    if not raw:
        return default
    return int(raw)


def _env_float(name: str, default: float) -> float:
    raw = os.environ.get(name, "").strip()
    if not raw:
        return default
    return float(raw)


def measure_snapshot_gates(
    engine: Engine,
    *,
    previous_row_count: int | None = None,
) -> SnapshotGateResult:
    """Collect counts used by refresh gates (read-only)."""
    meta = read_meta(engine)
    with engine.connect() as conn:
        answers_total = int(
            conn.execute(text(f"SELECT COUNT(*) FROM {ANSWERS_TABLE}")).scalar() or 0
        )
        store_month_count = int(
            conn.execute(text(f"SELECT COUNT(*) FROM {STORE_MONTH_TABLE}")).scalar()
            or 0
        )
        store_month_sum = int(
            conn.execute(
                text(f"SELECT COALESCE(SUM(total_count), 0) FROM {STORE_MONTH_TABLE}")
            ).scalar()
            or 0
        )
        answers_keyed = int(
            conn.execute(
                text(
                    f"""
SELECT COUNT(*) FROM {ANSWERS_TABLE}
WHERE PrintStore IS NOT NULL
  AND Year IS NOT NULL
  AND Month IS NOT NULL
"""
                )
            ).scalar()
            or 0
        )
        dupes = int(
            conn.execute(
                text(
                    f"""
SELECT COALESCE(SUM(cnt - 1), 0) FROM (
  SELECT ParticipateNumber, COUNT(*) AS cnt
  FROM {ANSWERS_TABLE}
  WHERE ParticipateNumber IS NOT NULL
    AND TRIM(CAST(ParticipateNumber AS TEXT)) <> ''
  GROUP BY ParticipateNumber
  HAVING COUNT(*) > 1
) AS dupes
"""
                )
            ).scalar()
            or 0
        )

    # Prefer live COUNT; fall back to meta if needed.
    row_count = answers_total if answers_total > 0 else meta.row_count
    return SnapshotGateResult(
        row_count=row_count,
        store_month_count=store_month_count,
        store_month_sum=store_month_sum,
        answers_keyed_count=answers_keyed,
        duplicate_participate_count=dupes,
        previous_row_count=previous_row_count,
    )


def validate_snapshot_gates(
    engine: Engine,
    *,
    previous_row_count: int | None = None,
    min_rows: int | None = None,
    min_ratio: float | None = None,
    max_dup_participate: int | None = None,
) -> SnapshotGateResult:
    """Fail closed on empty / shrinkage / store_month parity / optional dupes.

    Env defaults (overridable by kwargs):
    - ``SNAPSHOT_MIN_ROWS`` (default 1)
    - ``SNAPSHOT_MIN_RATIO`` vs previous (default 0.5)
    - ``SNAPSHOT_MAX_DUP_PARTICIPATE`` (default: no fail, metric only)
    """
    floor = _env_int("SNAPSHOT_MIN_ROWS", 1) if min_rows is None else min_rows
    ratio = (
        _env_float("SNAPSHOT_MIN_RATIO", 0.5) if min_ratio is None else min_ratio
    )
    if max_dup_participate is None:
        raw_dup = os.environ.get("SNAPSHOT_MAX_DUP_PARTICIPATE", "").strip()
        max_dup = int(raw_dup) if raw_dup else None
    else:
        max_dup = max_dup_participate

    result = measure_snapshot_gates(engine, previous_row_count=previous_row_count)

    if result.row_count < floor:
        raise SnapshotGateError(
            f"Snapshot row floor failed: row_count={result.row_count} < min_rows={floor}"
        )

    if previous_row_count is not None and previous_row_count > 0:
        needed = max(floor, int(previous_row_count * ratio))
        if result.row_count < needed:
            raise SnapshotGateError(
                "Snapshot vs-previous gate failed: "
                f"row_count={result.row_count} < required={needed} "
                f"(previous={previous_row_count}, ratio={ratio})"
            )

    if result.store_month_sum != result.answers_keyed_count:
        raise SnapshotGateError(
            "store_month ↔ answers parity failed: "
            f"sum(store_month.total_count)={result.store_month_sum} != "
            f"answers(PrintStore,Year,Month NOT NULL)={result.answers_keyed_count}"
        )

    if max_dup is not None and result.duplicate_participate_count > max_dup:
        raise SnapshotGateError(
            "ParticipateNumber duplicate gate failed: "
            f"extra_rows={result.duplicate_participate_count} > max={max_dup}"
        )

    if result.duplicate_participate_count:
        logger.warning(
            "Snapshot has %s duplicate ParticipateNumber extras (metric only)",
            result.duplicate_participate_count,
        )

    return result
