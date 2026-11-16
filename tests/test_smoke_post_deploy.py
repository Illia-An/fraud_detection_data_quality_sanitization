"""Wave 5 — post-deploy smoke against FastAPI TestClient (SM-10…14 core)."""

from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.ci_fixtures import build_q10012, build_tts_kpi
from backend.main import create_app


@pytest.fixture()
def fixture_env(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    q = tmp_path / "q10012_snapshot.sqlite"
    t = tmp_path / "tts_kpi_snapshot.sqlite"
    build_q10012(q)
    build_tts_kpi(t)
    monkeypatch.setenv("SANITIZATION_SOURCE", "snapshot")
    monkeypatch.setenv("SNAPSHOT_URL", f"sqlite:///{q.as_posix()}")
    monkeypatch.setenv("TTS_KPI_SOURCE", "snapshot")
    monkeypatch.setenv("TTS_KPI_SNAPSHOT_URL", f"sqlite:///{t.as_posix()}")
    monkeypatch.setenv("SNAPSHOT_MAX_AGE_DAYS", "36500")
    return tmp_path


def test_smoke_endpoints_via_testclient(fixture_env: Path) -> None:
    client = TestClient(create_app())

    health = client.get("/health")
    assert health.status_code == 200
    assert health.json()["status"] == "ok"

    ready = client.get("/ready")
    assert ready.status_code == 200, ready.text
    assert ready.json()["status"] == "ready"

    process = client.post(
        "/api/v1/process",
        json={
            "source": "db",
            "from_date": "2026-01-01",
            "to_date": "2026-01-31",
            "config": {},
            "rows": [],
        },
    )
    assert process.status_code == 200, process.text
    assert process.json()["meta"]["sanitization_source"] == "snapshot"

    tts = client.get("/api/v1/tts-kpi/ap")
    assert tts.status_code == 200, tts.text
    assert len(tts.json().get("rows") or []) >= 1
