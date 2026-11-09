# Contract: HTTP API v1 — Plan versions & Simulation

**Status:** Draft (Phase 0)  
**Spec:** [SPEC-P001](../SPEC-P001-target-simulation-planning.md)  
**Domain:** [domain-model.md](./domain-model.md)  
**Base path:** `/api/v1`  
**Auth:** same as current Planner APIs (none in MVP Compose demo unless later SEC work adds it)

These endpoints are **additive**. Existing `POST /api/v1/plans` (legacy TASK-15) stays until cutover.

---

## 1. Overview

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/plan-versions` | Save a new frozen Baseline Plan version |
| `GET` | `/plan-versions` | List version metadata (newest first) |
| `GET` | `/plan-versions/{id}` | Full version payload |
| `POST` | `/simulation` | Live Simulation (+ optional active baseline id) |
| `POST` | `/simulation/adjust` | Re-sim with limited store implied-target overrides (no Save) |

Storage: SQLite app-store (`PLAN_STORE_PATH`). Simulation responses are not written to DB.

---

## 2. Shared JSON shapes

Field names mirror [domain-model.md](./domain-model.md) in `snake_case`.

```json
{
  "year": 2026,
  "month": 3,
  "score": 72.5
}
```

Errors: FastAPI/`HTTPException` style — `422` validation, `404` missing version, `409` optional conflict if needed later.

---

## 3. `POST /api/v1/plan-versions`

### Request

Caller supplies either:

- **A)** precomputed store monthly targets (from FE after local engine — not preferred long-term), or  
- **B)** facts + params and asks server to compute then persist (preferred for Phase 2).

**Preferred (B):**

```json
{
  "label": "2026 baseline v1",
  "network_target": 75.0,
  "as_of": { "year": 2026, "month": 3 },
  "planning_year": 2026,
  "cumulative_start": { "year": 2025, "month": 1 },
  "solver": "cumulative_slope",
  "params": {
    "history_cap_mode": "max_mom",
    "plateau_ahead_pp": 2.0
  },
  "facts": [
    { "store_id": 10, "year": 2025, "month": 1, "five_percent": 68.0 }
  ]
}
```

### Response `201`

Full `PlanVersion` (meta + stores + network series).  
`meta.id` and `meta.created_at` assigned by server.

### Rules

- Creates a **new** immutable version every call (D-07).
- Does not modify prior versions.
- Reject `solver: "legacy"` for this endpoint (`422`) — legacy uses `/plans` only.

---

## 4. `GET /api/v1/plan-versions`

### Query

| Param | Default | Meaning |
|-------|---------|---------|
| `limit` | 50 | Max rows |
| `metric_id` | `five_percent` | Filter |

### Response `200`

```json
{
  "items": [
    {
      "id": "…",
      "created_at": "2026-11-09T10:00:00Z",
      "label": "2026 baseline v1",
      "network_target": 75.0,
      "as_of": { "year": 2026, "month": 3 },
      "planning_year": 2026,
      "solver": "cumulative_slope",
      "network_mean_at_save": 71.2,
      "store_count": 42
    }
  ]
}
```

---

## 5. `GET /api/v1/plan-versions/{id}`

### Response `200`

Full `PlanVersion`.

### Response `404`

Unknown id.

---

## 6. `POST /api/v1/simulation`

Live recompute (D-08). Blue series loaded only if `active_plan_version_id` is set and found.

### Request

```json
{
  "network_target": 75.0,
  "as_of": { "year": 2026, "month": 3 },
  "planning_year": 2026,
  "cumulative_start": { "year": 2025, "month": 1 },
  "solver": "cumulative_slope",
  "params": {
    "history_cap_mode": "max_mom",
    "plateau_ahead_pp": 2.0
  },
  "active_plan_version_id": "…",
  "facts": [
    { "store_id": 10, "year": 2025, "month": 1, "five_percent": 68.0 }
  ]
}
```

`active_plan_version_id` may be `null` / omitted → simulation + actuals only (no frozen blue).

### Response `200`

`SimulationResult` (network summary, per-store curves, `unreachable[]`).

### Rules

- Always uses latest `facts` in the request body (client sends current panel).
- If version id set: monthly_target / cumulative_planned from DB; sim path still from facts + engine.
- Applies history/100% cap; fills `unreachable` + `suggested_implied_target` (D-05/D-06).
- Monotone / no-clawback (D-04).

### Response `404`

`active_plan_version_id` provided but missing.

---

## 7. `POST /api/v1/simulation/adjust`

### Request

Same as `/simulation`, plus:

```json
{
  "adjustments": [
    { "store_id": 10, "new_implied_target": 73.0 }
  ]
}
```

### Response `200`

`SimulationResult` after applying limited overrides. **Does not** create a plan version.

To freeze: client calls `POST /plan-versions` with accepted curves/params.

---

## 8. Excel (existing + extension)

Current: `POST` Excel report endpoint consumes sanitization + plan scores (thin workbook).

Phase 4 extends request document to carry:

- per-store M1..M12 metric rows (see domain Excel mapping),
- `plan_version` meta for context sheet/header.

Exact path may remain the existing report route or a dedicated `/api/v1/plan-excel`; choose in Phase 4 without breaking current Summary/Sanitization/Plan sheets until FE switches.

---

## 9. FE wiring notes (non-normative)

| UI action | API |
|-----------|-----|
| Open Planner / new panel facts | `POST /simulation` |
| Save Plan | `POST /plan-versions` then set active id |
| Load prior blue | `GET /plan-versions` → `GET …/{id}` + sim with that id |
| Apply recommendation | `POST /simulation/adjust` |
| Export Excel | Extended report endpoint (Phase 4) |

SessionStorage may remember `active_plan_version_id`; server SQLite is source of truth for blue.

---

## 10. Acceptance (contract)

- [x] Endpoints listed with request/response intent.
- [x] Immutability of versions stated.
- [x] Simulation not persisted.
- [x] Legacy `/plans` coexistence stated.
- [ ] Implemented in Phase 2 with OpenAPI parity tests.
