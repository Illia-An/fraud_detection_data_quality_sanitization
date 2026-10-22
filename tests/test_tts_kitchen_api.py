"""GET /api/v1/tts-kitchen/before-after. The view is not opened in these tests."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from backend.main import create_app
from backend.tts_kitchen_queries import KitchenReadError
from backend.tts_kitchen_schemas import KitchenBeforeAfterResponse
from tts_kitchen.report import KitchenMonthCell


def _cells() -> tuple[KitchenMonthCell, ...]:
    return (
        KitchenMonthCell(
            store_id=1,
            meit_number=10,
            year=2026,
            month=9,
            rows_in=2,
            rows_dropped=1,
            sum_before_sec=59,
            sum_after_sec=30,
            rows_after=1,
        ),
        KitchenMonthCell(
            store_id=1,
            meit_number=10,
            year=2026,
            month=10,
            rows_in=1,
            rows_dropped=0,
            sum_before_sec=90,
            sum_after_sec=90,
            rows_after=1,
        ),
    )


def test_get_before_after_uses_the_fixed_window(monkeypatch: pytest.MonkeyPatch) -> None:
    seen: dict[str, int] = {}

    def load(min_sec: int = 30) -> tuple[tuple[KitchenMonthCell, ...], float]:
        seen["min_sec"] = min_sec
        return _cells(), 1.0

    monkeypatch.setattr(
        "backend.tts_kitchen_service.load_tts_kitchen_month_cells_from_settings",
        load,
    )
    client = TestClient(create_app())
    res = client.get("/api/v1/tts-kitchen/before-after?from_date=1999-01-01&min_sec=45")
    assert res.status_code == 200, res.text
    body = res.json()
    parsed = KitchenBeforeAfterResponse.model_validate(body)
    assert parsed.period_start.isoformat() == "2026-09-01"
    assert parsed.period_end.isoformat() == "2026-10-20"
    assert parsed.tts_min_sec == 45
    assert seen["min_sec"] == 45
    assert parsed.network.rows_in == 3
    assert parsed.network.rows_dropped == 1
    assert parsed.network.delta_sec == round(
        (parsed.network.mean_after_sec or 0) - (parsed.network.mean_before_sec or 0),
        4,
    )
    assert parsed.by_store[0].store_id == 1
    assert [(m.year, m.month) for m in parsed.by_store[0].months] == [(2026, 9), (2026, 10)]
    assert parsed.by_meit[0].meit_number == 10


def test_get_before_after_rejects_a_negative_cut() -> None:
    client = TestClient(create_app())
    res = client.get("/api/v1/tts-kitchen/before-after?min_sec=-1")
    assert res.status_code == 422


def test_get_before_after_returns_read_error(monkeypatch: pytest.MonkeyPatch) -> None:
    def fail(min_sec: int = 30) -> tuple[tuple[KitchenMonthCell, ...], float]:
        del min_sec
        raise KitchenReadError("Kitchen before/after read failed")

    monkeypatch.setattr(
        "backend.tts_kitchen_service.load_tts_kitchen_month_cells_from_settings",
        fail,
    )
    client = TestClient(create_app())
    res = client.get("/api/v1/tts-kitchen/before-after")
    assert res.status_code == 503
    assert res.json()["detail"] == "Kitchen before/after read failed"
