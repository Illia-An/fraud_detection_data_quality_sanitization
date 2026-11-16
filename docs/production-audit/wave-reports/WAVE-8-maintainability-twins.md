# Wave 8 report — Maintainability / product twins

| Field | Value |
|-------|--------|
| **Branch** | `feat/prod-source-truth` |
| **Date** | 2026-11-16 |
| **Audit IDs** | M-01–M-16 (subset), A-06, A-11, C-03 |

## Goal

One UX/rule change is one edit path; CI lint gates on.

## What we did

| # | Work | Result |
|---|------|--------|
| 8.1 | Shared planner shell | **Done** — `plannerShell.ts` rail constants; both planner pages + eslint deps fixed |
| 8.2 | Direction-aware allocator | **Done** — `planner.allocate`; thin `plan_five_percent` / `plan_tts`; floor&lt;ceiling aligned |
| 8.3 | TTS bounds one backend source | **Done** — `planner.tts_bounds` + `GET /api/v1/plans-tts/bounds`; FE schemas mirror |
| 8.4 | Shared tier-step table | **Done** — `RowTierStepSpec` / `_row_tier_step_specs` in `service.py` |
| 8.5 | Shared snapshot base | **Done** — `backend/snapshot_base.py` used by q10012 + tts_kpi |
| 8.6 | Tier naming aliases | **Done** — `fraud_guard.pipeline_steps` |
| 8.7 | Hash PII once at entry | **Done** — skip re-hash when `ENTITY_COL` present |
| 8.8 | Dates/config | **Done** — kitchen window via env; `ytd_2026` → current-year YTD |
| 8.9 | ruff/mypy + eslint `--max-warnings 0` | **Done** — CI steps + package script |
| 8.10 | Remove legacy `api/` | **Done** — package deleted; README updated (no consumers) |

## What changed (highlights)

| Path | Change |
|------|--------|
| `src/planner/allocate.py` | **Added** — shared allocator |
| `src/planner/tts_bounds.py` | **Added** — single TTS bounds source |
| `backend/snapshot_base.py` | **Added** — sqlite path/engine helpers |
| `backend/service.py` | Shared row-tier step table |
| `backend/routers/plans.py` | `GET /plans-tts/bounds` |
| `src/fraud_guard/pipeline_steps.py` | Step-name aliases |
| `src/fraud_guard/tier1.py` / `pii.py` | Hash-once semantics |
| `web/src/components/planner/plannerShell.ts` | Shared rail geometry |
| `web/package.json` / `eslint.config.js` | `--max-warnings 0`; refresh rule off |
| `.github/workflows/ci.yml` | ruff + mypy planner |
| `api/` | **Removed** |
| `tests/test_wave8_maintainability.py` | **Added** |

## Verification

```text
.\.venv\Scripts\python.exe -m pytest tests -q
→ 211 passed

.\.venv\Scripts\python.exe -m ruff check src backend db tests
→ All checks passed

.\.venv\Scripts\python.exe -m mypy src/planner
→ Success: no issues found in 17 source files

cd web; npm run lint   # --max-warnings 0
cd web; npm run test:run
→ 322 passed
```

## Done-when checklist

| Criterion | Result |
|-----------|--------|
| One UX/rule change → one edit path (allocator / bounds / tier steps) | **Yes** (core paths) |
| CI lint gates on | **Yes** (ruff, mypy planner, eslint max-warnings 0) |

## Follow-ups

- Deeper FE shell extract (shared rail JSX component) if planner UX work continues
- Expand mypy beyond `src/planner`
- Expand ruff rule select beyond syntax/undefined-name set
- Wave 9 performance / scale (metrics-driven)
