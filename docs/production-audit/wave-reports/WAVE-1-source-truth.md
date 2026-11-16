# Wave 1 report — Source of truth & KPI correctness

| Field | Value |
|-------|--------|
| **Branch** | `feat/prod-source-truth` |
| **Date** | 2026-11-11 |
| **Decisions used** | G-1 / W1-SRC signed; W1-MID **(A)** month normalize; W1-VIEW **(B)** allow + UI flag |
| **Register** | [`../decisions/WAVE-0-DECISIONS.md`](../decisions/WAVE-0-DECISIONS.md) |

## Goal

One meaning of “Sanitized 5%”: single source resolution per request; no silent mid-month Query A/B skew; VIEW cannot pretend tiers 2–3 ran.

## What we did

| # | Work | Result |
|---|------|--------|
| 1.1 | `resolve_process_source()` → `(engine, dialect, query_b_mode, sanitization_source)` | **Done** — `backend/db_sample.py`; `/process` resolves once and passes engine to Query A/B |
| 1.2 | VIEW + tiers 2/3 → explicit flag + UI | **Done** — meta `tiers_23_skipped` / `tiers_23_skip_reason`; Alert in `PipelineRunPanel` |
| 1.3 | Snapshot mid-month → month bounds + parity test | **Done** — `normalize_snapshot_period`; meta records requested vs effective |
| 1.4 | Prod default snapshot; warn outside Docker on VIEW | **Done** — default `SANITIZATION_SOURCE=snapshot`; `view_source_dev_warning` at startup + meta |
| 1.5 | VIEW-guard + mid-month tests | **Done** — see Verification |

## What changed (files)

| Path | Change |
|------|--------|
| `backend/db_sample.py` | `ProcessSource`, `resolve_process_source()`; `_process_engine` wraps it |
| `backend/period_bounds.py` | **Added** — calendar month snap (W1-MID A) |
| `backend/snapshot.py` | Default source `snapshot`; Docker/VIEW warning helpers |
| `backend/queries.py` | Loaders accept `engine`/`dialect`; `process_source_meta_extra(source)` |
| `backend/service.py` | Pushdown meta: `tiers_23_applied` / skipped flags |
| `backend/main.py` | One resolve; month normalize on snapshot; period meta |
| `web/src/components/PipelineRunPanel.tsx` | Warning Alert when `meta.tiers_23_skipped` |
| `web/src/i18n/messages/en.ts`, `he.ts` | `sanitization.tiers23Skipped` |
| `tests/test_period_bounds.py` | **Added** |
| `tests/test_snapshot.py` | Default source; mid-month process parity |
| `tests/test_query_b.py` | VIEW guard meta (T-06) |
| `web/.../PipelineRunPanel.test.tsx` | UI warning case |
| `docs/production-audit/decisions/WAVE-0-DECISIONS.md` | Sign-off recorded |
| `docs/production-audit/wave-reports/WAVE-0-decisions.md` | Blockers marked signed |

## Verification

```text
.venv\Scripts\python.exe -m pytest tests/test_period_bounds.py tests/test_snapshot.py tests/test_query_b.py tests/test_query_b_phase2.py tests/test_process_api.py -v
→ 30 passed

cd web && npm test -- --run src/components/PipelineRunPanel.test.tsx src/i18n/locale.test.ts
→ 9 passed
```

(`uv run` hit a transient PyPI TLS failure in this environment; tests ran against the existing `.venv`.)

## Done-when checklist (plan)

| Criterion | Result |
|-----------|--------|
| Mid-month custom range cannot silently wrong KPI | **Yes** — normalized to month bounds |
| VIEW + tiers cannot silently wrong “Sanitized 5%” | **Yes** — meta + UI warning |
| One engine resolution path per request | **Yes** — `resolve_process_source()` once in `/process` |

## Out of scope (preserved)

- Wave 2+ atomic refresh / `schema_version` / `/ready` / auth / routers / Celery
- Engine lifespan dispose (A-03) — deferred under G-1 snapshot-only
- Hard 422 for VIEW+tiers (owner chose flag path)

## Follow-ups

- Ops Wave 0 placeholders still `PENDING` (freshness SLA, network lock, PII, alerts, registry, RPO/RTO)
- Commit when owner asks
