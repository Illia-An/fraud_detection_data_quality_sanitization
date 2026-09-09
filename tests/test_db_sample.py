"""DB sample loader tests — no live SQL Server."""

from __future__ import annotations

from datetime import datetime
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from backend.db_sample import (
    DEFAULT_FROM_DATE,
    DbSampleError,
    DbSampleQuery,
    fetch_db_sample,
    fetch_db_sample_meta,
    hash_pii_value,
    redact_row,
    _build_meta_sql,
    _build_sql,
)
from backend.main import create_app
from backend.schemas import SamplePresetMeta, SampleResponse, SurveyAnswerRow


def test_hash_pii_stable_and_empty() -> None:
    assert hash_pii_value(None) is None
    assert hash_pii_value("  ") is None
    a = hash_pii_value("050-1111111")
    b = hash_pii_value("050-1111111")
    assert a == b
    assert a is not None
    assert len(a) == 32
    assert a != "050-1111111"


def test_redact_row_hashes_contacts() -> None:
    row = {
        "UserContact": "secret@example.com",
        "PhoneFromLog": "050-999",
        "PrintStore": 1,
    }
    out = redact_row(row)
    assert out["UserContact"] == hash_pii_value("secret@example.com")
    assert out["PhoneFromLog"] == hash_pii_value("050-999")
    assert out["PrintStore"] == 1


def test_build_sql_period_filters_without_top() -> None:
    sql, params = _build_sql(
        DbSampleQuery(store=82, year=2026, month=3, from_date=DEFAULT_FROM_DATE)
    )
    assert "TOP" not in sql.upper()
    assert "AnswerTime >=" in sql
    assert "PrintStore = :store" in sql
    assert "[Year] = :year" in sql
    assert "[Month] = :month" in sql
    assert params["store"] == 82
    assert params["year"] == 2026
    assert params["month"] == 3


def test_build_meta_sql_counts_period() -> None:
    sql, params = _build_meta_sql(DbSampleQuery(from_date=DEFAULT_FROM_DATE))
    assert "COUNT(*)" in sql
    assert "COUNT(DISTINCT PrintStore)" in sql
    assert "TOP" not in sql.upper()
    assert params["question_id"] == 10012


def _fake_engine(rows: list[dict]) -> MagicMock:
    result = MagicMock()
    result.mappings.return_value = rows
    conn = MagicMock()
    conn.__enter__.return_value = conn
    conn.__exit__.return_value = None
    conn.execute.return_value = result
    engine = MagicMock()
    engine.connect.return_value = conn
    return engine


def _fake_meta_engine(*, row_count: int, store_count: int, month_count: int) -> MagicMock:
    mappings = MagicMock()
    mappings.first.return_value = {
        "row_count": row_count,
        "store_count": store_count,
        "month_count": month_count,
    }
    result = MagicMock()
    result.mappings.return_value = mappings
    conn = MagicMock()
    conn.__enter__.return_value = conn
    conn.__exit__.return_value = None
    conn.execute.return_value = result
    engine = MagicMock()
    engine.connect.return_value = conn
    return engine


def test_fetch_db_sample_redacts_and_shapes() -> None:
    engine = _fake_engine(
        [
            {
                "ParticipateNumber": "p1",
                "Question_ID": 10012,
                "Answer_Value": 5,
                "BlackList": "לא",
                "UserContact": "050-1234567",
                "PhoneFromLog": None,
                "ext_user_id": 1,
                "PrintStore": 82,
                "AnswerTime": datetime(2026, 2, 1, 10, 0),
                "PrintDateTime": datetime(2026, 2, 1, 9, 0),
                "Year": 2026,
                "Month": 2,
                "ContactType": "SMS",
            }
        ]
    )
    sample = fetch_db_sample(engine, DbSampleQuery())
    assert sample.preset == "db"
    assert sample.meta.row_count == 1
    assert sample.meta.store_count == 1
    assert sample.rows[0].UserContact == hash_pii_value("050-1234567")
    assert sample.rows[0].PhoneFromLog is None
    assert "PII hashed" in sample.meta.description
    assert "limit=" not in sample.meta.description


def test_fetch_db_sample_meta_has_no_rows() -> None:
    engine = _fake_meta_engine(row_count=1200, store_count=40, month_count=8)
    sample = fetch_db_sample_meta(engine, DbSampleQuery())
    assert sample.rows == []
    assert sample.meta.row_count == 1200
    assert sample.meta.store_count == 40
    assert sample.meta.month_count == 8


def test_sample_db_endpoint_ok(monkeypatch: pytest.MonkeyPatch) -> None:
    fake = SampleResponse(
        preset="db",
        rows=[],
        meta=SamplePresetMeta(
            preset="db",
            row_count=1200,
            store_count=40,
            month_count=8,
            description="empty",
        ),
    )

    monkeypatch.setattr(
        "backend.main.load_db_sample_meta_from_settings",
        lambda query: fake,
    )
    client = TestClient(create_app())
    res = client.get("/api/v1/sample/db")
    assert res.status_code == 200
    body = res.json()
    assert body["preset"] == "db"
    assert body["rows"] == []
    assert body["meta"]["row_count"] == 1200


def test_sample_db_endpoint_503(monkeypatch: pytest.MonkeyPatch) -> None:
    def _boom(_query):
        raise DbSampleError("DATABASE_URL is not set in .env")

    monkeypatch.setattr("backend.main.load_db_sample_meta_from_settings", _boom)
    client = TestClient(create_app())
    res = client.get("/api/v1/sample/db")
    assert res.status_code == 503
    assert "DATABASE_URL" in res.json()["detail"]


def test_process_db_source_runs_on_server(monkeypatch: pytest.MonkeyPatch) -> None:
    fake = SampleResponse(
        preset="db",
        rows=[
            SurveyAnswerRow(
                ParticipateNumber="p1",
                Question_ID=10012,
                Answer_Value=5,
                BlackList="לא",
                UserContact="hashed",
                PrintStore=1,
                AnswerTime="2026-02-01T10:00:00",
                Year=2026,
                Month=2,
            )
        ],
        meta=SamplePresetMeta(
            preset="db",
            row_count=1,
            store_count=1,
            month_count=1,
            description="from db",
        ),
    )
    monkeypatch.setattr("backend.main.load_db_sample_from_settings", lambda query: fake)
    client = TestClient(create_app())
    res = client.post("/api/v1/process", json={"source": "db", "config": {}})
    assert res.status_code == 200
    body = res.json()
    assert body["meta"]["source"] == "db"
    assert body["meta"]["sample"]["row_count"] == 1
    assert body["baseline_top_box_pct"] is not None


def test_process_db_source_empty_period(monkeypatch: pytest.MonkeyPatch) -> None:
    fake = SampleResponse(
        preset="db",
        rows=[],
        meta=SamplePresetMeta(
            preset="db",
            row_count=0,
            store_count=0,
            month_count=0,
            description="empty",
        ),
    )
    monkeypatch.setattr("backend.main.load_db_sample_from_settings", lambda query: fake)
    client = TestClient(create_app())
    res = client.post("/api/v1/process", json={"source": "db", "config": {}})
    assert res.status_code == 422


def test_synthetic_sample_still_works() -> None:
    client = TestClient(create_app())
    res = client.get("/api/v1/sample/small")
    assert res.status_code == 200
    assert res.json()["preset"] == "small"
    assert res.json()["meta"]["row_count"] > 0
