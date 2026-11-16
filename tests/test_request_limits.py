"""Wave 3 / S-06 + Wave 9 / P-02 P-05 — body size and inline row caps."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from backend.main import create_app
from backend.request_limits import (
    DEFAULT_MAX_BODY_BYTES,
    DEFAULT_MAX_PROCESS_ROWS,
    max_body_bytes,
    max_process_rows,
)
from backend.schemas import ProcessRequest, SurveyAnswerRow


def test_max_body_bytes_default() -> None:
    assert max_body_bytes() == DEFAULT_MAX_BODY_BYTES
    assert DEFAULT_MAX_BODY_BYTES == 8 * 1024 * 1024


def test_max_process_rows_default() -> None:
    assert max_process_rows() == DEFAULT_MAX_PROCESS_ROWS
    assert DEFAULT_MAX_PROCESS_ROWS == 15_000


def test_body_size_middleware_rejects_large_content_length(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("PROCESS_MAX_BODY_BYTES", "100")
    client = TestClient(create_app())
    res = client.post(
        "/api/v1/process",
        content=b"x" * 10,
        headers={"content-length": "500", "content-type": "application/json"},
    )
    assert res.status_code == 413
    assert "too large" in res.json()["detail"].lower()


def test_process_request_rejects_over_default_row_cap() -> None:
    rows = [
        SurveyAnswerRow(
            ParticipateNumber=str(i),
            Answer_Value=5,
            PrintStore=1,
            Year=2026,
            Month=1,
        )
        for i in range(DEFAULT_MAX_PROCESS_ROWS + 1)
    ]
    with pytest.raises(ValidationError):
        ProcessRequest(source="inline", rows=rows)


def test_process_request_respects_process_max_rows_env(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("PROCESS_MAX_ROWS", "3")
    rows = [
        SurveyAnswerRow(
            ParticipateNumber=str(i),
            Answer_Value=5,
            PrintStore=1,
            Year=2026,
            Month=1,
        )
        for i in range(4)
    ]
    with pytest.raises(ValidationError):
        ProcessRequest(source="inline", rows=rows)


def test_inline_disabled_via_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("PROCESS_ALLOW_INLINE", "0")
    with pytest.raises(ValidationError, match="inline source is disabled"):
        ProcessRequest(
            source="inline",
            rows=[
                SurveyAnswerRow(
                    ParticipateNumber="1",
                    Answer_Value=5,
                    PrintStore=1,
                    Year=2026,
                    Month=1,
                )
            ],
        )


def test_survey_answer_row_ignores_unknown_fields() -> None:
    row = SurveyAnswerRow.model_validate(
        {
            "ParticipateNumber": "1",
            "Answer_Value": 5,
            "PrintStore": 1,
            "Year": 2026,
            "Month": 1,
            "hostile_extra": "x" * 1000,
        }
    )
    dumped = row.model_dump()
    assert "hostile_extra" not in dumped


def test_body_size_middleware_allows_under_limit(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("PROCESS_MAX_BODY_BYTES", "10000")
    client = TestClient(create_app())
    res = client.get("/health")
    assert res.status_code == 200
