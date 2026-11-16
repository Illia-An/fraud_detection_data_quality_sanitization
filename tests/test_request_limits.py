"""Wave 3 / S-06 — body size and inline row caps."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from backend.main import create_app
from backend.request_limits import max_body_bytes
from backend.schemas import ProcessRequest, SurveyAnswerRow


def test_max_body_bytes_default() -> None:
    assert max_body_bytes() == 32 * 1024 * 1024


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


def test_process_request_rejects_over_50000_rows() -> None:
    rows = [
        SurveyAnswerRow(
            ParticipateNumber=str(i),
            Answer_Value=5,
            PrintStore=1,
            Year=2026,
            Month=1,
        )
        for i in range(50_001)
    ]
    with pytest.raises(ValidationError):
        ProcessRequest(source="inline", rows=rows)


def test_body_size_middleware_allows_under_limit(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("PROCESS_MAX_BODY_BYTES", "10000")
    client = TestClient(create_app())
    res = client.get("/health")
    assert res.status_code == 200
