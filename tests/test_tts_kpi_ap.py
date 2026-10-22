"""AP TTS minutes: one KPI, stores below 500, no write, synthetic stays the other path."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text

from backend.main import create_app
from backend.tts_kpi_ap import load_ap_tts_kpi_panel
from planner.tts_kpi_ap import (
    TtsKpiSourceError,
    dreamfactory_query,
    rows_to_panel,
    tts_kpi_select_sql,
)


def test_select_is_one_read_of_the_four_columns():
    sql = tts_kpi_select_sql("AP.dbo.T_KPITrendAlerts")
    assert sql.startswith("SELECT StoreID_external, year, month, KPI_Score\n")
    assert "FROM AP.dbo.T_KPITrendAlerts\n" in sql
    assert "WHERE KPI = :kpi\n" in sql
    assert "StoreID_external < :store_cap" in sql
    upper = sql.upper()
    for forbidden in ("INSERT", "UPDATE", "DELETE", "MERGE", "DROP", "*"):
        assert forbidden not in upper


def test_bad_table_name_is_rejected():
    with pytest.raises(TtsKpiSourceError):
        tts_kpi_select_sql("AP.dbo.T_KPITrendAlerts; DROP TABLE alerts")


def test_panel_matches_the_export_and_drops_other_kpis():
    panel = rows_to_panel(
        [
            {
                "StoreID_external": 20,
                "year": 2025,
                "month": 11,
                "KPI_Score": 3.9,
                "GuestName": "hidden",
            },
            {
                "StoreID_external": 10,
                "year": 2025,
                "month": 12,
                "KPI_Score": 4.2,
                "KPI": "avg_serve_time_minutes",
            },
            {
                "StoreID_external": 20,
                "year": 2025,
                "month": 12,
                "KPI_Score": 3.8,
            },
            {
                "StoreID_external": 500,
                "year": 2025,
                "month": 12,
                "KPI_Score": 9.0,
                "KPI": "avg_serve_time_minutes",
            },
            {
                "StoreID_external": 30,
                "year": 2025,
                "month": 12,
                "KPI_Score": 1.0,
                "KPI": "other_kpi",
            },
        ]
    )
    assert panel.reference_year == 2025
    assert panel.reference_month == 12
    assert panel.period_start == "2025-11-01"
    assert panel.period_end == "2025-12-01"
    assert [(row.store_id, row.year, row.month, row.tts) for row in panel.rows] == [
        (10, 2025, 12, 4.2),
        (20, 2025, 11, 3.9),
        (20, 2025, 12, 3.8),
    ]


def test_repeated_alerts_become_one_cell_and_out_of_range_scores_drop():
    panel = rows_to_panel(
        [
            {"StoreID_external": 10, "year": 2025, "month": 12, "KPI_Score": 4.0},
            {"StoreID_external": 10, "year": 2025, "month": 12, "KPI_Score": 4.4},
            {"StoreID_external": 10, "year": 2025, "month": 12, "KPI_Score": None},
            {"StoreID_external": 10, "year": 2025, "month": 11, "KPI_Score": 45.0},
            {"StoreID_external": 20, "year": 2025, "month": 12, "KPI_Score": 3.8},
        ]
    )
    assert [(row.store_id, row.year, row.month, row.tts) for row in panel.rows] == [
        (10, 2025, 12, 4.2),
        (20, 2025, 12, 3.8),
    ]
    assert panel.reference_month == 12
    assert panel.period_start == "2025-12-01"


def test_synthetic_source_does_not_open_a_database(monkeypatch):
    monkeypatch.setenv("TTS_KPI_SOURCE", "synthetic")

    def boom(*_args, **_kwargs):
        raise AssertionError("database engine should stay closed")

    monkeypatch.setattr("backend.tts_kpi_ap.create_engine", boom)
    with pytest.raises(TtsKpiSourceError) as caught:
        load_ap_tts_kpi_panel()
    assert caught.value.status_code == 503


def test_sql_source_reads_only_tts_minutes(tmp_path, monkeypatch):
    database = tmp_path / "ap.sqlite"
    engine = create_engine(f"sqlite:///{database.as_posix()}")
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                CREATE TABLE kpi_alerts (
                    StoreID_external INTEGER,
                    year INTEGER,
                    month INTEGER,
                    KPI_Score REAL,
                    KPI TEXT,
                    GuestName TEXT
                )
                """
            )
        )
        conn.execute(
            text(
                """
                INSERT INTO kpi_alerts VALUES
                (10, 2025, 12, 4.2, 'avg_serve_time_minutes', 'hidden'),
                (20, 2025, 11, 3.9, 'avg_serve_time_minutes', 'hidden'),
                (20, 2025, 12, 3.8, 'avg_serve_time_minutes', 'hidden'),
                (500, 2025, 12, 9.0, 'avg_serve_time_minutes', 'hidden'),
                (30, 2025, 12, 1.0, 'other_kpi', 'hidden')
                """
            )
        )
    monkeypatch.setenv("TTS_KPI_SOURCE", "sql")
    monkeypatch.setenv("TTS_KPI_DATABASE_URL", f"sqlite:///{database.as_posix()}")
    monkeypatch.setenv("TTS_KPI_TABLE", "kpi_alerts")

    panel = load_ap_tts_kpi_panel()
    assert [(row.store_id, row.year, row.month, row.tts) for row in panel.rows] == [
        (10, 2025, 12, 4.2),
        (20, 2025, 11, 3.9),
        (20, 2025, 12, 3.8),
    ]
    assert panel.reference_month == 12
    with engine.connect() as conn:
        remaining = conn.execute(text("SELECT COUNT(*) FROM kpi_alerts")).scalar()
    assert remaining == 5


def test_dreamfactory_keeps_the_key_out_of_the_query(monkeypatch):
    captured: dict[str, object] = {}

    class _Response:
        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict[str, object]:
            return {
                "resource": [
                    {
                        "StoreID_external": 10,
                        "year": 2025,
                        "month": 12,
                        "KPI_Score": 4.2,
                        "GuestName": "hidden",
                        "KPI": "avg_serve_time_minutes",
                    }
                ]
            }

    class _Client:
        def __init__(self, *_args, **_kwargs) -> None:
            return None

        def __enter__(self) -> "_Client":
            return self

        def __exit__(self, *_args) -> None:
            return None

        def get(self, url: str, *, params: dict[str, str], headers: dict[str, str]) -> _Response:
            captured["url"] = url
            captured["params"] = params
            captured["headers"] = headers
            return _Response()

    monkeypatch.setenv("TTS_KPI_SOURCE", "dreamfactory")
    monkeypatch.setenv("TTS_KPI_API_URL", "https://df.example/api/v2/ap/_table/T_KPITrendAlerts")
    monkeypatch.setenv("TTS_KPI_API_KEY", "secret-key")
    monkeypatch.setattr("backend.tts_kpi_ap.httpx.Client", _Client)

    panel = load_ap_tts_kpi_panel()
    assert panel.rows[0].tts == 4.2
    params = captured["params"]
    assert params == dreamfactory_query()
    assert "secret-key" not in str(params)
    assert "secret-key" not in str(captured["url"])
    assert captured["headers"]["X-DreamFactory-Api-Key"] == "secret-key"


def test_ap_endpoint_stays_off_on_the_synthetic_source(monkeypatch):
    monkeypatch.setenv("TTS_KPI_SOURCE", "synthetic")
    client = TestClient(create_app())
    response = client.get("/api/v1/tts-kpi/ap")
    assert response.status_code == 503
    assert "hidden" not in response.text
    assert "KPI_Score" not in response.text


def test_ap_endpoint_returns_minutes_for_the_sql_source(tmp_path, monkeypatch):
    database = tmp_path / "ap.sqlite"
    engine = create_engine(f"sqlite:///{database.as_posix()}")
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                CREATE TABLE kpi_alerts (
                    StoreID_external INTEGER,
                    year INTEGER,
                    month INTEGER,
                    KPI_Score REAL,
                    KPI TEXT
                )
                """
            )
        )
        conn.execute(
            text(
                """
                INSERT INTO kpi_alerts VALUES
                (10, 2025, 12, 4.2, 'avg_serve_time_minutes'),
                (20, 2025, 12, 3.8, 'avg_serve_time_minutes')
                """
            )
        )
    monkeypatch.setenv("TTS_KPI_SOURCE", "sql")
    monkeypatch.setenv("TTS_KPI_DATABASE_URL", f"sqlite:///{database.as_posix()}")
    monkeypatch.setenv("TTS_KPI_TABLE", "kpi_alerts")

    client = TestClient(create_app())
    response = client.get("/api/v1/tts-kpi/ap")
    assert response.status_code == 200
    body = response.json()
    assert body["preset"] == "ap"
    assert body["source"] == "ap"
    assert body["reference_year"] == 2025
    assert body["reference_month"] == 12
    assert set(body["rows"][0]) == {"store_id", "year", "month", "tts"}
    assert {row["store_id"]: row["tts"] for row in body["rows"]} == {10: 4.2, 20: 3.8}
