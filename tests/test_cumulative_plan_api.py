"""API tests for plan-versions and simulation (SPEC-P001 Phase 2)."""

from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

from backend.main import create_app


def _facts_payload() -> list[dict]:
    rows = []
    for month, score in [(1, 60.0), (2, 61.0), (3, 62.0)]:
        rows.append(
            {
                "store_id": 10,
                "year": 2025,
                "month": month,
                "five_percent": score,
            }
        )
        rows.append(
            {
                "store_id": 20,
                "year": 2025,
                "month": month,
                "five_percent": score + 10.0,
            }
        )
    return rows


def _base_body(**extra):
    body = {
        "network_target": 75.0,
        "as_of": {"year": 2025, "month": 3},
        "planning_year": 2025,
        "cumulative_start": {"year": 2025, "month": 1},
        "solver": "cumulative_slope",
        "facts": _facts_payload(),
    }
    body.update(extra)
    return body


def test_save_list_get_plan_version(tmp_path: Path, monkeypatch):
    monkeypatch.setenv("PLAN_STORE_PATH", str(tmp_path / "plans.sqlite"))
    client = TestClient(create_app())

    created = client.post("/api/v1/plan-versions", json=_base_body(label="baseline-a"))
    assert created.status_code == 201, created.text
    body = created.json()
    version_id = body["meta"]["id"]
    assert body["meta"]["label"] == "baseline-a"
    assert body["meta"]["solver"] == "cumulative_slope"
    assert len(body["stores"]) == 2
    frozen_targets = {
        s["store_id"]: [m["score"] for m in s["monthly_target"]] for s in body["stores"]
    }

    listed = client.get("/api/v1/plan-versions")
    assert listed.status_code == 200
    items = listed.json()["items"]
    assert len(items) == 1
    assert items[0]["id"] == version_id

    fetched = client.get(f"/api/v1/plan-versions/{version_id}")
    assert fetched.status_code == 200
    assert fetched.json()["meta"]["id"] == version_id
    assert {
        s["store_id"]: [m["score"] for m in s["monthly_target"]]
        for s in fetched.json()["stores"]
    } == frozen_targets

    missing = client.get("/api/v1/plan-versions/does-not-exist")
    assert missing.status_code == 404


def test_second_save_creates_new_immutable_version(tmp_path: Path, monkeypatch):
    monkeypatch.setenv("PLAN_STORE_PATH", str(tmp_path / "plans.sqlite"))
    client = TestClient(create_app())
    a = client.post("/api/v1/plan-versions", json=_base_body(label="a")).json()
    b = client.post("/api/v1/plan-versions", json=_base_body(label="b")).json()
    assert a["meta"]["id"] != b["meta"]["id"]
    listed = client.get("/api/v1/plan-versions").json()["items"]
    assert len(listed) == 2


def test_simulation_live_and_overlay(tmp_path: Path, monkeypatch):
    monkeypatch.setenv("PLAN_STORE_PATH", str(tmp_path / "plans.sqlite"))
    client = TestClient(create_app())

    saved = client.post("/api/v1/plan-versions", json=_base_body(label="freeze")).json()
    version_id = saved["meta"]["id"]
    frozen = {
        s["store_id"]: [m["score"] for m in s["monthly_target"]] for s in saved["stores"]
    }

    # Live sim without overlay
    live = client.post("/api/v1/simulation", json=_base_body())
    assert live.status_code == 200, live.text
    live_body = live.json()
    assert live_body["active_plan_version_id"] is None
    assert live_body["network"]["store_count"] == 2
    assert len(live_body["stores"][0]["simulation"]) >= 1

    # With overlay — monthly_target must match frozen version
    over = client.post(
        "/api/v1/simulation",
        json=_base_body(active_plan_version_id=version_id),
    )
    assert over.status_code == 200
    over_body = over.json()
    assert over_body["active_plan_version_id"] == version_id
    over_targets = {
        s["store_id"]: [m["score"] for m in s["monthly_target"]]
        for s in over_body["stores"]
    }
    assert over_targets == frozen
    # Simulation still present (live)
    assert len(over_body["stores"][0]["simulation"]) >= 1

    bad = client.post(
        "/api/v1/simulation",
        json=_base_body(active_plan_version_id="missing-id"),
    )
    assert bad.status_code == 404


def test_simulation_adjust(tmp_path: Path, monkeypatch):
    monkeypatch.setenv("PLAN_STORE_PATH", str(tmp_path / "plans.sqlite"))
    client = TestClient(create_app())
    response = client.post(
        "/api/v1/simulation/adjust",
        json={
            **_base_body(network_target=90.0),
            "adjustments": [{"store_id": 10, "new_implied_target": 72.0}],
        },
    )
    assert response.status_code == 200, response.text
    store10 = next(s for s in response.json()["stores"] if s["store_id"] == 10)
    assert store10["implied_target"] == 72.0


def test_phase5_smoke_save_survives_reopen(tmp_path: Path, monkeypatch):
    """Save → new client/store handle → frozen targets unchanged (ops restart simulation)."""
    db_path = tmp_path / "plan_store" / "plans.sqlite"
    monkeypatch.setenv("PLAN_STORE_PATH", str(db_path))
    client = TestClient(create_app())
    created = client.post("/api/v1/plan-versions", json=_base_body(label="phase5")).json()
    version_id = created["meta"]["id"]
    frozen = {
        s["store_id"]: [m["score"] for m in s["monthly_target"]] for s in created["stores"]
    }

    # Simulate process restart: new app + same PLAN_STORE_PATH
    client2 = TestClient(create_app())
    listed = client2.get("/api/v1/plan-versions").json()["items"]
    assert any(item["id"] == version_id for item in listed)
    fetched = client2.get(f"/api/v1/plan-versions/{version_id}").json()
    assert {
        s["store_id"]: [m["score"] for m in s["monthly_target"]] for s in fetched["stores"]
    } == frozen

    over = client2.post(
        "/api/v1/simulation",
        json=_base_body(active_plan_version_id=version_id),
    )
    assert over.status_code == 200
    assert {
        s["store_id"]: [m["score"] for m in s["monthly_target"]]
        for s in over.json()["stores"]
    } == frozen
