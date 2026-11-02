"""TTS KPI SQLite snapshot — Docker offline path mirroring Q10012."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text

from backend.main import create_app
from backend.tts_kpi_ap import load_ap_tts_kpi_panel
from backend.tts_kpi_snapshot import (
    KPI_ROWS_TABLE,
    get_tts_kpi_snapshot_engine,
    init_tts_kpi_snapshot_schema,
    set_tts_kpi_meta,
)
from planner.tts_kpi_ap import TtsKpiSourceError


def _seed_snapshot(path, rows: list[tuple[int, int, int, float]]) -> None:
    import os

    os.environ["TTS_KPI_SNAPSHOT_URL"] = f"sqlite:///{path.as_posix()}"
    engine = get_tts_kpi_snapshot_engine(create_schema=True)
    init_tts_kpi_snapshot_schema(engine)
    with engine.begin() as conn:
        conn.execute(text(f"DELETE FROM {KPI_ROWS_TABLE}"))
        for store_id, year, month, score in rows:
            conn.execute(
                text(
                    f"""
INSERT INTO {KPI_ROWS_TABLE}
(StoreID_external, year, month, KPI_Score)
VALUES (:s, :y, :m, :v)
"""
                ),
                {"s": store_id, "y": year, "m": month, "v": score},
            )
    set_tts_kpi_meta(
        engine,
        {
            "loaded_at": "2026-01-01T00:00:00+00:00",
            "row_count": str(len(rows)),
            "source_table": "AP.dbo.T_KPITrendAlerts",
            "from_date": "2025-01-01",
        },
    )
    engine.dispose()


def test_snapshot_source_reads_local_sqlite(tmp_path, monkeypatch):
    db = tmp_path / "tts_kpi_snapshot.sqlite"
    _seed_snapshot(
        db,
        [
            (10, 2025, 11, 4.4),
            (10, 2025, 12, 4.2),
            (20, 2025, 12, 3.8),
        ],
    )
    monkeypatch.setenv("TTS_KPI_SOURCE", "snapshot")
    monkeypatch.setenv("TTS_KPI_SNAPSHOT_URL", f"sqlite:///{db.as_posix()}")

    panel = load_ap_tts_kpi_panel()
    assert panel.reference_year == 2025
    assert panel.reference_month == 12
    assert panel.row_count == 3
    by_key = {(r.store_id, r.year, r.month): r.tts for r in panel.rows}
    assert by_key[(10, 2025, 12)] == 4.2
    assert by_key[(20, 2025, 12)] == 3.8


def test_snapshot_missing_file_is_503(tmp_path, monkeypatch):
    missing = tmp_path / "missing.sqlite"
    monkeypatch.setenv("TTS_KPI_SOURCE", "snapshot")
    monkeypatch.setenv("TTS_KPI_SNAPSHOT_URL", f"sqlite:///{missing.as_posix()}")
    with pytest.raises(TtsKpiSourceError) as caught:
        load_ap_tts_kpi_panel()
    assert caught.value.status_code == 503
    assert "refresh_tts_kpi_snapshot" in str(caught.value)


def test_ap_endpoint_serves_snapshot(tmp_path, monkeypatch):
    db = tmp_path / "tts_kpi_snapshot.sqlite"
    _seed_snapshot(
        db,
        [
            (10, 2025, 12, 4.2),
            (20, 2025, 12, 3.8),
        ],
    )
    monkeypatch.setenv("TTS_KPI_SOURCE", "snapshot")
    monkeypatch.setenv("TTS_KPI_SNAPSHOT_URL", f"sqlite:///{db.as_posix()}")

    client = TestClient(create_app())
    response = client.get("/api/v1/tts-kpi/ap")
    assert response.status_code == 200
    body = response.json()
    assert body["preset"] == "ap"
    assert body["source"] == "ap"
    assert {row["store_id"]: row["tts"] for row in body["rows"]} == {10: 4.2, 20: 3.8}


def test_refresh_pulls_into_sqlite(tmp_path, monkeypatch):
    """Refresh reads a stand-in AP SQLite via TTS_KPI_DATABASE_URL."""
    from datetime import date

    from backend.tts_kpi_snapshot import refresh_tts_kpi_snapshot

    ap = tmp_path / "ap.sqlite"
    engine = create_engine(f"sqlite:///{ap.as_posix()}")
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
                (10, 2024, 12, 9.9, 'avg_serve_time_minutes'),
                (10, 2025, 1, 4.5, 'avg_serve_time_minutes'),
                (10, 2025, 12, 4.2, 'avg_serve_time_minutes'),
                (20, 2025, 12, 3.8, 'avg_serve_time_minutes'),
                (30, 2025, 12, 1.0, 'other_kpi')
                """
            )
        )
    engine.dispose()

    out = tmp_path / "tts_kpi_snapshot.sqlite"
    monkeypatch.setenv("TTS_KPI_DATABASE_URL", f"sqlite:///{ap.as_posix()}")
    monkeypatch.setenv("TTS_KPI_TABLE", "kpi_alerts")

    summary = refresh_tts_kpi_snapshot(
        from_date=date(2025, 1, 1),
        to_date=date(2025, 12, 1),
        out_path=out,
    )
    assert summary["row_count"] == 3
    assert summary["to_date"] == "2025-12-01"
    assert out.is_file()

    monkeypatch.setenv("TTS_KPI_SOURCE", "snapshot")
    monkeypatch.setenv("TTS_KPI_SNAPSHOT_URL", f"sqlite:///{out.as_posix()}")
    panel = load_ap_tts_kpi_panel()
    assert panel.row_count == 3
    assert all(row.year >= 2025 for row in panel.rows)
