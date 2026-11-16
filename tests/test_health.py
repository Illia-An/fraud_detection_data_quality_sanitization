"""Backend liveness /health (Wave 4 / T-05 — not legacy api.main)."""

from fastapi.testclient import TestClient

from backend.main import create_app


def test_health() -> None:
    client = TestClient(create_app())
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert "version" in body
    assert response.headers.get("x-request-id")
