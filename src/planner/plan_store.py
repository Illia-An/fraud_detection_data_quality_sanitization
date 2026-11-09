"""SQLite app-store for immutable Baseline Plan versions (SPEC-P001 Phase 2)."""

from __future__ import annotations

import json
import os
import sqlite3
from pathlib import Path

from planner.cumulative_slope.plan_version import (
    PlanVersion,
    PlanVersionListItem,
    plan_version_from_dict,
    plan_version_to_dict,
)
from planner.cumulative_slope.types import YearMonth

_DEFAULT_REL = Path("data") / "plan_store.sqlite"


def default_plan_store_path(project_root: Path | None = None) -> Path:
    raw = os.environ.get("PLAN_STORE_PATH", "").strip()
    if raw:
        return Path(raw)
    root = project_root or Path(__file__).resolve().parents[2]
    return root / _DEFAULT_REL


class PlanStore:
    """Append-only plan version store. Rows are never updated in place."""

    def __init__(self, path: Path | str) -> None:
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._init_schema()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_schema(self) -> None:
        with self._connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS plan_versions (
                    id TEXT PRIMARY KEY,
                    created_at TEXT NOT NULL,
                    label TEXT,
                    metric_id TEXT NOT NULL,
                    network_target REAL NOT NULL,
                    planning_year INTEGER NOT NULL,
                    solver TEXT NOT NULL,
                    network_mean_at_save REAL NOT NULL,
                    store_count INTEGER NOT NULL,
                    as_of_year INTEGER NOT NULL,
                    as_of_month INTEGER NOT NULL,
                    payload TEXT NOT NULL
                )
                """
            )
            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_plan_versions_created
                ON plan_versions (created_at DESC)
                """
            )
            conn.commit()

    def insert(self, version: PlanVersion) -> PlanVersion:
        payload = json.dumps(plan_version_to_dict(version), separators=(",", ":"))
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO plan_versions (
                    id, created_at, label, metric_id, network_target, planning_year,
                    solver, network_mean_at_save, store_count, as_of_year, as_of_month, payload
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    version.meta.id,
                    version.meta.created_at,
                    version.meta.label,
                    version.meta.metric_id,
                    version.meta.network_target,
                    version.meta.planning_year,
                    version.meta.solver,
                    version.meta.network_mean_at_save,
                    len(version.stores),
                    version.meta.as_of.year,
                    version.meta.as_of.month,
                    payload,
                ),
            )
            conn.commit()
        return version

    def get(self, version_id: str) -> PlanVersion | None:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT payload FROM plan_versions WHERE id = ?",
                (version_id,),
            ).fetchone()
        if row is None:
            return None
        return plan_version_from_dict(json.loads(row["payload"]))

    def list_versions(
        self,
        *,
        limit: int = 50,
        metric_id: str = "five_percent",
    ) -> list[PlanVersionListItem]:
        if limit < 1:
            raise ValueError("limit must be >= 1")
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT id, created_at, label, network_target, planning_year, solver,
                       network_mean_at_save, store_count, as_of_year, as_of_month, metric_id
                FROM plan_versions
                WHERE metric_id = ?
                ORDER BY created_at DESC
                LIMIT ?
                """,
                (metric_id, limit),
            ).fetchall()
        return [
            PlanVersionListItem(
                id=r["id"],
                created_at=r["created_at"],
                label=r["label"],
                network_target=float(r["network_target"]),
                as_of=YearMonth(year=int(r["as_of_year"]), month=int(r["as_of_month"])),
                planning_year=int(r["planning_year"]),
                solver=r["solver"],
                network_mean_at_save=float(r["network_mean_at_save"]),
                store_count=int(r["store_count"]),
                metric_id=r["metric_id"],
            )
            for r in rows
        ]
