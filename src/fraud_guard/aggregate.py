"""Aggregate survey-level rows to store × year × month 5% panels."""

from __future__ import annotations

import pandas as pd

from fraud_guard.contracts import MonthlyMetricRow
from fraud_guard.features import ColumnMapping, require_mapping


def aggregate_five_percent(
    df: pd.DataFrame,
    mapping: ColumnMapping,
    *,
    question_id: int | None = None,
    top_box_value: int = 5,
) -> list[MonthlyMetricRow]:
    """Build monthly 5% rows from (optionally filtered) survey answers.

    Raises until ColumnMapping is filled from the real source schema.
    """
    require_mapping(mapping, "store_id", "event_ts", "question_id", "answer_value")
    _ = (df, question_id, top_box_value)
    raise NotImplementedError(
        "aggregate_five_percent awaits source schema and formula sign-off"
    )
