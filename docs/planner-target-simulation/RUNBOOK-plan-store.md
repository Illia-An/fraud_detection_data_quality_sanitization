# Runbook — Baseline Plan store (`PLAN_STORE_PATH`)

**Track:** SPEC-P001 Phase 5  
**Purpose:** Operate the SQLite app-store that holds **immutable** Baseline Plan versions (blue line). Simulation is **not** stored here.

---

## 1. Where the file lives

| Mode | Path |
|------|------|
| Local default | `data/plan_store.sqlite` (repo-relative; gitignored) |
| Override | Env `PLAN_STORE_PATH` (absolute or relative path) |
| Docker Compose | Host `./data/plan_store/plans.sqlite` → container `/app/data/plan_store/plans.sqlite` via `PLAN_STORE_PATH` |

Code: `src/planner/plan_store.py` (`PlanStore`, `default_plan_store_path`).

First write creates parent directories and the schema (`plan_versions` table).

---

## 2. Docker / Compose

`docker-compose.yml` mounts:

```text
./data/plan_store → /app/data/plan_store  (:rw)
PLAN_STORE_PATH=/app/data/plan_store/plans.sqlite
```

Sanitization snapshots stay **`:ro`** on separate binds. Do **not** put plan versions inside the Q10012 snapshot file.

Before first `up`, ensure the host folder exists:

```powershell
New-Item -ItemType Directory -Force -Path .\data\plan_store | Out-Null
```

---

## 3. Backup

Copy the SQLite file while the API is idle (or after a quiet window — writers are short inserts):

```powershell
Copy-Item .\data\plan_store\plans.sqlite .\data\plan_store\plans.backup-$(Get-Date -Format yyyyMMdd-HHmmss).sqlite
```

Restore = stop container / API, replace `plans.sqlite` with a backup copy, start again.

---

## 4. Rollback a “bad” baseline

Versions are **append-only**. There is no delete/update API in MVP.

1. `GET /api/v1/plan-versions` — pick the previous good `id`.
2. In the UI, re-run simulation with that id as active (or call `POST /simulation` with `active_plan_version_id`), then **Save Plan** only if you need a new frozen snapshot derived from current facts + accepted curves.
3. Or point the UI session at the older id (session `activePlanVersionId`) without saving.

Do not edit SQLite rows by hand unless recovering a corrupted file from backup.

---

## 5. Smoke checklist (ops)

1. `GET /health` → ok.  
2. Sanitization → Planner → **Run simulation**.  
3. Hero shows Plan / Actual / Simulation (`cumulative-slope-hero-chart`).  
4. **Save Plan** → success alert; `GET /api/v1/plan-versions` lists a new row.  
5. Restart API/container → list still contains the version; `GET …/{id}` returns the same monthly targets.  
6. **Export Excel** → workbook has `StoreMatrix` (+ `plan_version_*` on Summary when a version is active).

Automated coverage: `tests/test_cumulative_plan_api.py`, `tests/test_plan_store.py`, `tests/test_excel_report.py`.

---

## 6. Related

- [SPEC-P001](./SPEC-P001-target-simulation-planning.md)  
- [contracts/api-v1.md](./contracts/api-v1.md)  
- Panel handoff (cleansed facts still session/export; plan versions are separate): [sanitized_panel_handoff.md](../contracts/sanitized_panel_handoff.md)
