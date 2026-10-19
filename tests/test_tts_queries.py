"""Stage 1: TTS Query A builders and aggregate fold (no live DB)."""

from __future__ import annotations

from datetime import date
from unittest.mock import MagicMock

import pytest

from backend.tts_queries import (
    DEFAULT_TTS_VIEW,
    TTS_AUDIT_COLUMNS,
    TtsStorePeriodAggregate,
    baseline_from_tts_aggregates,
    build_tts_actual_baseline_sql,
    build_tts_bump_rows_sql,
    get_tts_actual_baseline_aggregates,
    network_mean_tts_sec,
)
from db.config import Settings, resolve_tts_database_url


def test_build_tts_actual_baseline_sql_no_select_star() -> None:
    sql, params = build_tts_actual_baseline_sql(
        date(2026, 9, 1),
        date(2026, 10, 17),
        store_ids=[10, 266],
    )
    assert "SELECT *" not in sql.upper().replace(" ", "")
    assert "SELECT *" not in sql
    assert "GROUP BY StoreIndex" in sql
    assert "DATEDIFF(SECOND, UpDatetime, BumpDateTime)" in sql
    assert "BumpDateTime IS NOT NULL" in sql
    assert "SaleDate >=" in sql
    assert "SaleDate <" in sql
    assert "StoreIndex IN" in sql
    assert "mean_tts_sec" in sql
    assert "sum_tts_sec" in sql
    assert DEFAULT_TTS_VIEW in sql
    assert params["period_start"] == "2026-09-01"
    assert params["period_end_exclusive"] == "2026-10-18"
    assert params["store_id_0"] == 10
    assert params["store_id_1"] == 266


def test_build_tts_actual_baseline_sql_open_ended() -> None:
    sql, params = build_tts_actual_baseline_sql(date(2026, 9, 1), period_end=None)
    assert "period_end_exclusive" not in params
    assert "SaleDate <" not in sql
    assert params["period_start"] == "2026-09-01"


def test_build_tts_bump_rows_sql_audit_columns_only() -> None:
    sql, _params = build_tts_bump_rows_sql(date(2026, 9, 1), date(2026, 9, 30))
    assert "SELECT *" not in sql
    for col in TTS_AUDIT_COLUMNS:
        assert col in sql
    assert "Grill" not in sql


def test_network_mean_tts_sec() -> None:
    assert network_mean_tts_sec(0.0, 0) == 0.0
    assert network_mean_tts_sec(400.0, 2) == 200.0


def test_baseline_from_tts_aggregates_weighted() -> None:
    rows = [
        TtsStorePeriodAggregate(1, 2026, 9, bump_count=10, sum_tts_sec=2000.0, mean_tts_sec=200.0),
        TtsStorePeriodAggregate(2, 2026, 9, bump_count=5, sum_tts_sec=1500.0, mean_tts_sec=300.0),
    ]
    baseline = baseline_from_tts_aggregates(rows, query_time_ms=12.5)
    assert baseline.bump_count == 15
    assert baseline.mean_tts_sec == network_mean_tts_sec(3500.0, 15)
    assert baseline.query_time_ms == 12.5
    assert len(baseline.by_store_period) == 2


def test_get_tts_actual_baseline_aggregates_maps_sql_rows(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DATABASE_URL", "sqlite:///:memory:")
    monkeypatch.setenv("TTS_VIEW", "dbo.TargetsByMetrics_McKitiBump")
    from db.config import get_settings

    get_settings.cache_clear()

    row_list = [
        {
            "store_id": 82,
            "year": 2026,
            "month": 9,
            "bump_count": 100,
            "sum_tts_sec": 23100.0,
            "mean_tts_sec": 231.0,
        }
    ]
    result = MagicMock()
    result.mappings.return_value = row_list
    conn = MagicMock()
    conn.__enter__.return_value = conn
    conn.__exit__.return_value = None
    conn.execute.return_value = result
    engine = MagicMock()
    engine.connect.return_value = conn

    baseline = get_tts_actual_baseline_aggregates(
        engine, date(2026, 9, 1), date(2026, 10, 17)
    )
    assert baseline.bump_count == 100
    assert baseline.mean_tts_sec == 231.0
    assert baseline.by_store_period[0].store_id == 82
    assert baseline.query_time_ms >= 0.0
    get_settings.cache_clear()


def test_resolve_tts_database_url_fallback() -> None:
    primary = Settings(
        database_url="mssql+primary",
        cors_origins="*",
        tts_database_url="",
        tts_view="dbo.TargetsByMetrics_McKitiBump",
    )
    assert resolve_tts_database_url(primary) == "mssql+primary"
    dedicated = Settings(
        database_url="mssql+primary",
        cors_origins="*",
        tts_database_url="mssql+mc",
        tts_view="dbo.TargetsByMetrics_McKitiBump",
    )
    assert resolve_tts_database_url(dedicated) == "mssql+mc"
