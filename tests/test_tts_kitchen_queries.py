"""Kitchen before/after SQL text and read mapping. No live database."""

from __future__ import annotations

import re
from datetime import date
from unittest.mock import MagicMock

import pytest
from sqlalchemy.exc import SQLAlchemyError

from db.config import Settings

from backend.tts_kitchen_queries import (
    KITCHEN_PERIOD_END,
    KITCHEN_PERIOD_START,
    KitchenReadError,
    build_tts_kitchen_before_after_sql,
    fetch_tts_kitchen_month_cells,
    load_tts_kitchen_month_cells_from_settings,
)
from backend.tts_queries import DEFAULT_TTS_VIEW

_WRITE_WORDS = re.compile(
    r"\b(INSERT|UPDATE|DELETE|MERGE|TRUNCATE|DROP|ALTER|CREATE|EXEC|EXECUTE|INTO)\b",
    re.IGNORECASE,
)


def test_kitchen_sql_is_one_read_of_the_tts_view() -> None:
    sql, params = build_tts_kitchen_before_after_sql(
        KITCHEN_PERIOD_START,
        KITCHEN_PERIOD_END,
        view_name=DEFAULT_TTS_VIEW,
    )
    assert DEFAULT_TTS_VIEW in sql
    assert "BumpDateTime IS NOT NULL" in sql
    assert "DATEDIFF(SECOND, UpDatetime, BumpDateTime)" in sql
    assert "tts < :min_sec" in sql
    assert "tts >= :min_sec" in sql
    assert "tts < 30" not in sql
    assert "GROUP BY StoreIndex, MeitNumber, YEAR(SaleDate), MONTH(SaleDate)" in sql
    assert sql.upper().count(f"FROM {DEFAULT_TTS_VIEW}".upper()) == 1
    assert ";" not in sql
    assert _WRITE_WORDS.search(sql) is None
    for banned in ("Dim_McMEIT", "TRHE_StoredTime", "WeborderID", "SortOrder", "KVSGroup"):
        assert banned not in sql
    assert params == {
        "period_start": "2026-09-01",
        "period_end_exclusive": "2026-10-21",
        "min_sec": 30,
    }


def test_kitchen_sql_binds_a_custom_cut_and_rejects_a_negative() -> None:
    sql, params = build_tts_kitchen_before_after_sql(
        date(2026, 9, 1),
        date(2026, 10, 20),
        view_name=DEFAULT_TTS_VIEW,
        min_sec=45,
    )
    assert params["min_sec"] == 45
    assert "45" not in sql
    with pytest.raises(ValueError, match="min_sec"):
        build_tts_kitchen_before_after_sql(
            date(2026, 9, 1),
            date(2026, 10, 20),
            view_name=DEFAULT_TTS_VIEW,
            min_sec=-1,
        )


def test_kitchen_sql_rejects_a_view_name_that_is_not_an_identifier() -> None:
    with pytest.raises(ValueError, match="view name"):
        build_tts_kitchen_before_after_sql(
            date(2026, 9, 1),
            date(2026, 10, 20),
            view_name="dbo.TargetsByMetrics_McKitiBump; DROP TABLE dbo.X",
        )


def test_fetch_maps_null_item_code_and_does_not_write() -> None:
    result = MagicMock()
    result.mappings.return_value = [
        {
            "StoreIndex": 5,
            "MeitNumber": None,
            "year": 2026,
            "month": 9,
            "rows_in": 1,
            "rows_dropped": 1,
            "sum_before": 10,
            "sum_after": 0,
            "rows_after": 0,
        },
        {
            "StoreIndex": 5,
            "MeitNumber": 77,
            "year": 2026,
            "month": 10,
            "rows_in": 2,
            "rows_dropped": 0,
            "sum_before": 80,
            "sum_after": 80,
            "rows_after": 2,
        },
    ]
    conn = MagicMock()
    conn.__enter__.return_value = conn
    conn.__exit__.return_value = None
    conn.execute.return_value = result
    engine = MagicMock()
    engine.connect.return_value = conn

    cells, query_ms = fetch_tts_kitchen_month_cells(
        engine,
        view_name=DEFAULT_TTS_VIEW,
    )
    assert query_ms >= 0.0
    assert len(cells) == 2
    assert cells[0].meit_number is None
    assert cells[0].rows_dropped == 1
    assert cells[1].meit_number == 77
    assert cells[1].month == 10
    sql = conn.execute.call_args.args[0].text
    assert _WRITE_WORDS.search(sql) is None
    assert conn.execute.call_count == 1
    engine.begin.assert_not_called()


def test_fetch_raises_read_error_without_a_second_attempt() -> None:
    conn = MagicMock()
    conn.__enter__.return_value = conn
    conn.__exit__.return_value = None
    conn.execute.side_effect = SQLAlchemyError("down")
    engine = MagicMock()
    engine.connect.return_value = conn

    with pytest.raises(KitchenReadError, match="read failed"):
        fetch_tts_kitchen_month_cells(engine, view_name=DEFAULT_TTS_VIEW)
    assert engine.connect.call_count == 1
    assert conn.execute.call_count == 1


def test_settings_loader_opens_one_engine(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls = {"n": 0}

    def engine_factory() -> MagicMock:
        calls["n"] += 1
        conn = MagicMock()
        conn.__enter__.return_value = conn
        conn.__exit__.return_value = None
        conn.execute.side_effect = SQLAlchemyError("down")
        engine = MagicMock()
        engine.connect.return_value = conn
        return engine

    monkeypatch.setattr(
        "db.config.get_settings",
        lambda: Settings(
            database_url="sqlite:///:memory:",
            cors_origins="",
            tts_database_url="",
            tts_view=DEFAULT_TTS_VIEW,
        ),
    )
    monkeypatch.setattr("db.connection.get_tts_engine", engine_factory)
    with pytest.raises(KitchenReadError):
        load_tts_kitchen_month_cells_from_settings()
    assert calls["n"] == 1
