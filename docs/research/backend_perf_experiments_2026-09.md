# Backend performance research archive (2026-09)

Branch purpose: keep as a personal investigation library / restore point.
Do **not** treat as required for trunk merge unless deliberately cherry-picked later.

Context: `SANITIZATION_SOURCE=snapshot`, local `data/q10012_snapshot.sqlite`,
default period `AnswerTime >= 2025-01-01`, `PROFILE_MEMORY=0` unless noted.
Endpoint: `POST /api/v1/process` with `{"source":"db"}`.

---

## Experiment 1 — PROFILE_MEMORY flag

Method: one Python process, `TestClient(create_app())`, set `os.environ["PROFILE_MEMORY"]`
before each request. One warmup (excluded), 3× flag=0, 3× flag=1.

| Mode | median execution_time_ms | peak_memory_mb |
|------|--------------------------|----------------|
| 0 | ~6643 (~6.64 s) | 0.0 |
| 1 | ~14813 (~14.8 s) | ~94 |

Delta: **+8.17 s**, ~**2.23×** slower with tracing.

KPI stable across all six runs:

- query_a_total_responses = 980076
- query_b_candidate_rows = 35500
- baseline_top_box_pct = 68.28
- final_top_box_pct = 66.5705
- network_delta_pp = -1.7095
- sanitization_source = snapshot, query_b_mode = tier1_full

Note: `profile_block()` wraps Query A + Query B + pipeline, so A/B timers also inflate under PROFILE_MEMORY=1. Not a SQL change.

Reproduce: same TestClient pattern as in chat / scripts; do not rely on unused uvicorn :8001 without the env var.

---

## Experiment 2 — `_drop_counts_by_cell` (measure only)

Production then used `iterrows`. Instrumented via runtime monkeypatch (no business change initially).

Per request (tiers 1+2; tier3 off by default):

- 2 calls
- rows: 20641 + 14516 = 35157
- median total function time ~**1484 ms**
- ~**22%** of full request (~6.7 s)
- ~**62%** of pipeline-only estimate (~2.4 s)

Script: `scripts/measure_drop_counts_by_cell.py`

---

## Experiment 2b — vectorized candidate equivalence

Candidate: `backend/drop_counts_candidates.py` → `drop_counts_by_cell_vectorized`  
Tests: `tests/test_drop_counts_by_cell_vectorized.py` (17 tests)

Contract preserved:

- empty → {}
- skip None PrintStore/Year/Month
- skip float NaN Year
- keep NaN PrintStore as `(nan, y, m)` keys
- top-box: `== 5` or numeric with `int(v)==5`; string `"5"` not top-box
- NaN Answer_Value / NaN Month raise via `int(nan)` like production
- nan-aware equality helper: `drop_counts_equal` (because `nan != nan`)

Real-frame speed (median of 5):

- Tier1: ~814 ms → ~30 ms
- Tier2: ~583 ms → ~22 ms
- Expected save ~**1.35 s/request**

---

## Experiment 2c — production wiring

`backend/service._drop_counts_by_cell` → calls `drop_counts_by_cell_vectorized`.  
Iterrows kept as `drop_counts_by_cell_iterrows` for regression/timing only.

Relevant suite: 73 passed.

Full request benchmark after wiring (PROFILE_MEMORY=0):

| | Before (Exp1) | After (2c) |
|--|---------------|------------|
| median execution_time_ms | **6643** | **5109** |
| delta | — | **−1.53 s** |

KPI unchanged (same numbers as Exp1).

---

## Experiment 3 — frequency CTE (Query B) investigation

No production/SQL/index/schema changes. Analysis only.

### Timings (SQL only)

| Path | median | rows |
|------|--------|------|
| freq off (blacklist) | ~388 ms | 20641 |
| freq on | ~3787 ms | 35500 |
| delta | ~**3400 ms** | |
| freq_groups aggregation alone | ~**2344 ms** | 4949 hot groups |

### Why ~3.5 s

EXPLAIN (freq on):

- `SEARCH answers USING INDEX ix_answers_answer_time` — **twice** (outer + freq co-routine)
- `USE TEMP B-TREE FOR GROUP BY` inside `freq_groups`
- bloom + automatic covering index on temp result for EXISTS

Counts:

- base answered rows ~980160
- freq input (non-null key/store/day) ~975512
- all groups ~942996
- hot groups (COUNT>=3) ~4949

`entity_key`: SQL CASE mirroring `build_entity_key` (c:/p:/u:). Defined once in SQL;
evaluated twice at runtime because `base` is scanned twice.

AnswerTime index **is used**; it does not help GROUP BY entity_key.

### Options ranked (conceptual only)

| ID | Idea | Benefit | Notes |
|----|------|---------|-------|
| C/E | Pre-agg freq (or candidates) at snapshot refresh | Highest query win | Stale until refresh; must match semantics |
| A | Persist entity_key column | Medium | Needed before useful indexes |
| B | Index on entity_key… | Medium after A | Alone weak for full-period GROUP BY |
| D | CTE rewrite / one pass | Medium (~1 s) | Leaves ~2.3 s GROUP BY |

Most promising: **C/E**, optionally with **A**.

Optional follow-up timing (temp prebuilt freq_groups) was **aborted** (hung process); not required for the conclusions above.

---

## Key files on this branch

- `backend/drop_counts_candidates.py` — vectorized + iterrows reference
- `backend/service.py` — production wires vectorized `_drop_counts_by_cell`
- `tests/test_drop_counts_by_cell_vectorized.py`
- `scripts/measure_drop_counts_by_cell.py`
- `backend/profiler.py` / PROFILE_MEMORY behaviour (Exp1)

---

## Baseline snapshot after Exp 2c

- Full request median ~**5.11 s**
- Query A ~30 ms
- Query B ~4.2 s (freq on)
- Candidates 35500
- KPI as above

---

## How to keep this branch as an archive (not merge to trunk)

1. Commit research + code on this branch.
2. Optionally `git push -u origin HEAD` as a personal remote backup (no PR required).
3. `git switch main` (commit or stash first if dirty).
4. Later restore: `git switch <this-branch-name>`.
5. Do not delete the branch if you want it as a restore library.
