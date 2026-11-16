# Wave 2 report — Snapshot integrity

| Field | Value |
|-------|--------|
| **Branch** | `feat/prod-source-truth` (all waves on one branch) |
| **Date** | 2026-11-16 |
| **Audit IDs** | D-01, D-02, D-03, D-04, D-05, D-08, D-09, D-13, T-01, T-03 |

## Goal

Refresh cannot silently destroy a good snapshot: atomic publish, gates, `schema_version`, directory mount, `.prev` retention.

## What we did

| # | Work | Result |
|---|------|--------|
| 2.1 | `schema_version` in meta + `require_*` | **Done** — `SCHEMA_VERSION="1"`; mismatch / missing → 503 |
| 2.2 | Refresh → `*.tmp` → gates → meta in tmp → `os.replace` | **Done** — `snapshot_refresh` + `snapshot_publish` |
| 2.3 | Gates: row floor, vs previous, `store_month` ↔ answers | **Done** — `snapshot_gates`; dupes as metric (+ optional fail) |
| 2.4 | Compose mount `data/` | **Done** — `./data:/app/data:ro` + plan_store rw overlay |
| 2.5 | Keep `.prev` / N copies | **Done** — `SNAPSHOT_PREV_KEEP` (default 1) |
| 2.6 | Tests crash / empty / schema mismatch | **Done** — `tests/test_snapshot_integrity.py` |

## What changed (files)

| Path | Change |
|------|--------|
| `backend/snapshot.py` | `SCHEMA_VERSION`, `set_meta_conn`, `get_snapshot_engine_at`, require checks |
| `backend/snapshot_gates.py` | **Added** — floor / ratio / parity / dupes |
| `backend/snapshot_publish.py` | **Added** — atomic publish + `.prev` rotation |
| `backend/snapshot_refresh.py` | **Added** — write candidate DB + meta in one txn |
| `scripts/refresh_q10012_snapshot.py` | Pull → tmp → gates → publish (no in-place DELETE) |
| `docker-compose.yml` | Mount `data/` directory (D-02) |
| `.gitignore` | `*.sqlite.tmp` / `*.sqlite.prev*` |
| `tests/test_snapshot_integrity.py` | **Added** |
| `tests/test_snapshot.py`, `test_query_b_phase2.py` | Seeds include `schema_version` |

## Env knobs

| Var | Default | Role |
|-----|---------|------|
| `SNAPSHOT_MIN_ROWS` | `1` | Reject empty / tiny pulls |
| `SNAPSHOT_MIN_RATIO` | `0.5` | vs previous row_count |
| `SNAPSHOT_MAX_DUP_PARTICIPATE` | unset | If set, fail when dupe extras exceed |
| `SNAPSHOT_PREV_KEEP` | `1` | Number of `.prev` files to keep |

## Verification

```text
.venv\Scripts\python.exe -m pytest tests/test_snapshot_integrity.py tests/test_snapshot.py tests/test_query_b_phase2.py tests/test_query_b.py -v
→ 34 passed
```

## Done-when checklist

| Criterion | Result |
|-----------|--------|
| Empty pull does not replace prod | **Yes** — gate fails; tmp deleted; live untouched |
| Schema mismatch → 503 | **Yes** — `require_snapshot_engine` + `/process` |
| Atomic swap verified | **Yes** — unit test keeps `.prev` |

## Ops note

Existing host snapshots **without** `schema_version` will 503 until one successful refresh after this change.

## Out of scope

- Wave 3+ security / `/ready` / auth
- TTS KPI snapshot atomic path (same pattern later if needed)
- Freshness SLA (still Wave 0 `PENDING` → Wave 4 `/ready`)
