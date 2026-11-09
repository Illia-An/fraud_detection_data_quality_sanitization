"""SQLite plan version store (immutable append)."""

from __future__ import annotations

from pathlib import Path

from planner.cumulative_slope import NetworkPlanParams, StoreMonthFact, YearMonth, simulate
from planner.cumulative_slope.plan_version import build_plan_version
from planner.plan_store import PlanStore


def _facts() -> list[StoreMonthFact]:
    rows: list[StoreMonthFact] = []
    for month, score in [(1, 60.0), (2, 61.0), (3, 62.0)]:
        rows.append(
            StoreMonthFact(store_id=10, year=2025, month=month, five_percent=score)
        )
        rows.append(
            StoreMonthFact(
                store_id=20, year=2025, month=month, five_percent=score + 10.0
            )
        )
    return rows


def test_insert_list_get_immutable(tmp_path: Path):
    store = PlanStore(tmp_path / "plans.sqlite")
    params = NetworkPlanParams()
    start = YearMonth(2025, 1)
    result = simulate(
        facts=_facts(),
        network_target=75.0,
        as_of=YearMonth(2025, 3),
        planning_year=2025,
        cumulative_start=start,
        params=params,
    )
    v1 = build_plan_version(result, cumulative_start=start, params=params, label="v1")
    store.insert(v1)
    v2 = build_plan_version(result, cumulative_start=start, params=params, label="v2")
    store.insert(v2)

    items = store.list_versions(limit=10)
    assert len(items) == 2
    assert {i.label for i in items} == {"v1", "v2"}

    loaded = store.get(v1.meta.id)
    assert loaded is not None
    assert loaded.meta.label == "v1"
    assert loaded.meta.id == v1.meta.id
    assert len(loaded.stores) == 2
    assert store.get("missing") is None
