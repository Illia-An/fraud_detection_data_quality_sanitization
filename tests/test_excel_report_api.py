"""POST /api/v1/reports/excel returns a workbook and rejects an empty body."""

from __future__ import annotations

from io import BytesIO

from fastapi.testclient import TestClient
from openpyxl import load_workbook

from backend.main import create_app


def _payload() -> dict:
    return {
        "method": "tier1",
        "period_start": "2025-01-01",
        "period_end": None,
        "target": 75,
        "current_chain": 64.3,
        "final_chain": 75,
        "feasible": True,
        "sanitization_rows": [
            {"store_id": 270, "year": 2025, "month": 12, "score": 64.3},
        ],
        "chain_months": [
            {"year": 2026, "month": 1, "score": 70},
            {"year": 2026, "month": 2, "score": 75},
        ],
        "store_plans": [
            {
                "store_id": 270,
                "months": [
                    {"year": 2026, "month": 1, "score": 68},
                    {"year": 2026, "month": 2, "score": 75},
                ],
            }
        ],
    }


def test_excel_report_downloads_workbook():
    client = TestClient(create_app())
    response = client.post("/api/v1/reports/excel", json=_payload())
    assert response.status_code == 200
    assert (
        response.headers["content-type"]
        == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
    book = load_workbook(BytesIO(response.content))
    assert book["Summary"]["B5"].value == 75


def test_excel_report_rejects_missing_plan():
    client = TestClient(create_app())
    body = _payload()
    body["store_plans"] = []
    response = client.post("/api/v1/reports/excel", json=body)
    assert response.status_code == 422
