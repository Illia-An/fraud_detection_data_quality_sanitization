"""Wave 6 security regression suite (S-14 / S-02 / S-10 / S-04)."""

from __future__ import annotations

from datetime import date
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text

from backend.ci_fixtures import build_q10012
from backend.main import create_app
from backend.snapshot import SCHEMA_VERSION, read_meta
from backend.snapshot_refresh import write_snapshot_from_rows
from fraud_guard.pii import hash_pii_value


def test_health_and_ready_open_without_api_key(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.delenv("API_KEY", raising=False)
    q = tmp_path / "q.sqlite"
    build_q10012(q)
    monkeypatch.setenv("SNAPSHOT_URL", f"sqlite:///{q.as_posix()}")
    monkeypatch.setenv("SNAPSHOT_MAX_AGE_DAYS", "36500")
    client = TestClient(create_app())
    assert client.get("/health").status_code == 200
    assert client.get("/ready").status_code == 200


def test_api_requires_key_when_configured(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("API_KEY", "wave6-secret")
    monkeypatch.setenv("ENABLE_DOCS", "0")
    q = tmp_path / "q.sqlite"
    build_q10012(q)
    monkeypatch.setenv("SNAPSHOT_URL", f"sqlite:///{q.as_posix()}")
    monkeypatch.setenv("SNAPSHOT_MAX_AGE_DAYS", "36500")
    client = TestClient(create_app())

    assert client.get("/health").status_code == 200
    denied = client.get("/api/v1/sample/small")
    assert denied.status_code == 401

    ok = client.get(
        "/api/v1/sample/small",
        headers={"X-API-Key": "wave6-secret"},
    )
    assert ok.status_code == 200

    bearer = client.get(
        "/api/v1/sample/small",
        headers={"Authorization": "Bearer wave6-secret"},
    )
    assert bearer.status_code == 200


def test_docs_disabled_when_enable_docs_false(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("API_KEY", raising=False)
    monkeypatch.setenv("ENABLE_DOCS", "0")
    client = TestClient(create_app())
    assert client.get("/docs").status_code == 404
    assert client.get("/openapi.json").status_code == 404


def test_validation_errors_omit_input(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("API_KEY", raising=False)
    client = TestClient(create_app())
    # Invalid body: rows must be list; send wrong type to trigger validation.
    res = client.post("/api/v1/process", json={"source": "inline", "rows": "nope"})
    assert res.status_code == 422
    detail = res.json()["detail"]
    assert isinstance(detail, list)
    for err in detail:
        assert "input" not in err


def test_refresh_hashes_pii_at_rest(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("PII_HMAC_KEY", "fixture-pepper")
    out = tmp_path / "hashed.sqlite"
    raw_contact = "secret-user@example.test"
    write_snapshot_from_rows(
        out_path=out,
        rows=[
            {
                "ParticipateNumber": "1",
                "Question_ID": 10012,
                "Answer_Value": 5,
                "BlackList": None,
                "UserContact": raw_contact,
                "PhoneFromLog": "0500000000",
                "ext_user_id": None,
                "PrintStore": 10,
                "AnswerTime": "2026-01-05 10:00:00",
                "Year": 2026,
                "Month": 1,
            }
        ],
        from_date=date(2026, 1, 1),
    )
    engine = create_engine(f"sqlite:///{out.as_posix()}")
    meta = read_meta(engine)
    assert meta.pii_hashed_at_rest is True
    assert meta.schema_version == SCHEMA_VERSION
    stored = engine.connect().execute(
        text("SELECT UserContact, PhoneFromLog FROM answers LIMIT 1")
    ).one()
    assert stored[0] == hash_pii_value(raw_contact)
    assert stored[0] != raw_contact
    assert stored[1] == hash_pii_value("0500000000")
    assert raw_contact not in str(stored)


def test_pii_marker_not_in_process_logs(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    """Acceptance for OB-08 / S-14: synthetic PII marker must not appear in logs."""
    import logging

    marker = "PII_MARKER_WAVE6_UNIQUE_ZZZ"
    monkeypatch.delenv("API_KEY", raising=False)
    monkeypatch.setenv("SANITIZATION_SOURCE", "snapshot")
    q = tmp_path / "q.sqlite"
    build_q10012(q)
    monkeypatch.setenv("SNAPSHOT_URL", f"sqlite:///{q.as_posix()}")
    monkeypatch.setenv("SNAPSHOT_MAX_AGE_DAYS", "36500")

    client = TestClient(create_app())
    with caplog.at_level(logging.DEBUG):
        client.post(
            "/api/v1/process",
            json={
                "source": "inline",
                "config": {},
                "rows": [
                    {
                        "ParticipateNumber": "1",
                        "Question_ID": 10012,
                        "Answer_Value": 5,
                        "UserContact": marker,
                        "PrintStore": 1,
                        "AnswerTime": "2026-01-01T00:00:00",
                        "Year": 2026,
                        "Month": 1,
                    }
                ],
            },
        )
    joined = " ".join(r.getMessage() for r in caplog.records)
    assert marker not in joined
