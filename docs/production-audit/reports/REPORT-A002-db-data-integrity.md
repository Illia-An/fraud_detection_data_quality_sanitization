# REPORT-A002 — DB & Data Integrity: Schema, Refresh Safety, Query Hotspots

| Field | Value |
|-------|--------|
| **Spec** | [SPEC-A002](../specs/SPEC-A002-db-data-integrity.md) |
| **Branch** | `audit/production-readiness` |
| **Date** | 2026-11-04 |
| **Method** | Static review: code, `git`, filesystem. Tests, Docker, EXPLAIN and load timing were **not** run. |
| **Status** | Report ready (G-1 from A001 pending; freshness SLA open) |

> **Reality check.** There is no app OLTP database and no Alembic. “Critical migrations before release”
> means snapshot schema / meta / refresh / index changes without which an internal launch risks
> silent corruption, a partial snapshot being served, or wrong KPI from source/window bugs.
> Cross-links: [REPORT-A001](./REPORT-A001-architecture-coupling.md) (A-01/A-02/A-03, G-1). Do not
> re-derive architecture here.

> **Method note.** Paths were verified with `Test-Path` / `git ls-files`. Do not trust a stale
> Cursor search index for deleted files.

---

## 1. Storage inventory

| Store | Writer | Reader | Mode |
|-------|--------|--------|------|
| `data/q10012_snapshot.sqlite` (~190 MB, mtime 2026-09-22) | `scripts/refresh_q10012_snapshot.py` (manual, host with SQL access) | `/process`, `/sample/db` when `SANITIZATION_SOURCE=snapshot` | Docker bind-mounts the **file** `:ro` (`docker-compose.yml`) |
| `data/tts_kpi_snapshot.sqlite` (~216 KB, mtime 2026-11-02) | `scripts/refresh_tts_kpi_snapshot.py` → `backend/tts_kpi_snapshot.refresh_tts_kpi_snapshot` | `/tts-kpi/ap` when `TTS_KPI_SOURCE=snapshot` | Same, file `:ro` |
| MSSQL VIEW `dbo.TargetsByMetrics_RateGetAnswers` | External (read-only) | `/process` when `SANITIZATION_SOURCE=view` | Engine per request (`db/connection.py`) |
| AP SQL / DreamFactory | External (read-only) | `/tts-kpi/ap` when `sql` / `dreamfactory` | Engine create+dispose per call; DreamFactory `httpx` timeout 30s |
| Kitchen MSSQL `TTS_VIEW` | External (read-only) | `/tts-kitchen/before-after` | One aggregate SELECT; no timeout |

- Writable store for the product = the two SQLite files only. Container mounts them read-only;
  refresh always runs on a host that can reach the source, then the file is replaced under
  the mount (ops concern — see D-02).
- `.gitignore` covers `data/*.sqlite` and `data/*.sqlite-*`. No backup/version retention
  of snapshot files (INFRA-05 confirmed).

Sources in product reality: `synthetic` | `snapshot` | MSSQL VIEW | AP SQL/DreamFactory | kitchen MSSQL.

---

## 2. Schemas and indexes

### Q10012 (`backend/snapshot.py`)

**`answers`** — denormalized VIEW copy. No PK / UNIQUE / FK. Notable types: `PrintStore REAL`,
`AnswerTime TEXT` (ISO). Indexes:

- `ix_answers_answer_time (AnswerTime)`
- `ix_answers_blacklist_time (BlackList, AnswerTime)`
- `ix_answers_store_ym (PrintStore, Year, Month)`

**`store_month`** — PK `(PrintStore, Year, Month)`; pre-aggregate for Query A.

**`snapshot_meta`** — key/value. Keys written by refresh: `loaded_at`, `row_count`,
`store_month_count`, `source_view`, `from_date`. **No `schema_version`.**

### TTS KPI (`backend/tts_kpi_snapshot.py`)

**`kpi_rows`** — `(StoreID_external, year, month, KPI_Score)`; no PK. Index
`ix_kpi_rows_store_ym (StoreID_external, year, month)`. File is small; indexes are not a hotspot.

**`snapshot_meta`** — same pattern; keys: `loaded_at`, `row_count`, `source_table`, `from_date`
(+ optional `to_date`). No `schema_version`.

### Why no FK / constraints

Snapshots are flat copies of source views, not an OLTP model. Surrogate integrity must be
**refresh gates** (row counts, `store_month` vs `answers`, null/dupe metrics) — currently absent.

### Gaps vs query patterns

| Query path | Snapshot behaviour | Index fit |
|------------|--------------------|-----------|
| Query A | Reads `store_month` with Year/Month OR bounds | PK leads with `PrintStore`; period filter does not use a covering index. Table ~10k cells — not a release concern. |
| Query B phase 2 | CTE `base` over period + `GROUP BY entity_key, PrintStore, day`; `date(AnswerTime)` + CASE entity key per row | `ix_answers_answer_time` may cover the range, then temp b-tree for groups. Timing not measured. |
| `/sample/db` meta | `COUNT` / `COUNT(DISTINCT …)` on `answers` | Full range scan of the period. |
| Blacklist predicate | `BlackList IS NULL OR BlackList <> :customer_bl` | `ix_answers_blacklist_time` likely unused under OR/inequality (needs EXPLAIN). |

**Index plan (priority):** measure first; no index change is a release blocker on evidence so far.
See §5.

---

## 3. Data-risk registry

| ID | Finding | Theme | Evidence | Verdict | Class | Sev | Effort | Action before release |
|----|---------|-------|----------|---------|-------|-----|--------|------------------------|
| **D-01** | Refresh writes **in-place** into the live file: `DELETE` + insert in one transaction. No write-to-temp / atomic swap; no previous-file retention. | txn | `scripts/refresh_q10012_snapshot.py:147-149`; `backend/tts_kpi_snapshot.py:262-263` | Confirmed | **Release blocker** | High | M | Build into `*.tmp`, validate, `os.replace`; keep N previous files |
| **D-02** | Docker mounts a **single file** `:ro`. A hard kill mid-refresh can leave a hot journal next to the host file that the container may not see; Windows file-share locking across host writer + container readers is unreliable. | txn / ops | `docker-compose.yml` volumes for both snapshots | Potential (not exercised on Windows Docker Desktop) | **Release blocker** (with D-01) | High | S | Mount `data/` directory; publish via atomic rename inside that dir |
| **D-03** | `set_meta` / `set_tts_kpi_meta` runs in a **separate transaction after** the data commit. Crash between them → new rows + stale `loaded_at` / `row_count`. | txn | `refresh_q10012_snapshot.py:208-216`; `tts_kpi_snapshot.py:300` | Confirmed | **Release blocker** (fixed with D-01) | Med | S | Write meta inside the tmp DB before swap |
| **D-04** | No validation gate: empty / partial pull (0 rows) silently replaces a good snapshot. `require_snapshot_engine` only does `SELECT 1 … LIMIT 1` — empty table does not fail. | txn / freshness | `snapshot.py:195-217`; refresh has no min-row check | Confirmed | **Release blocker** | High | S–M | Row-count floor + vs previous snapshot; `store_month` sanity before swap |
| **D-05** | No `schema_version`. `CREATE TABLE IF NOT EXISTS` will not add columns to an existing file; mismatch surfaces at query time. | schema | Grep `schema_version` in `*.py` → 0 hits | Confirmed | **Release blocker** | Med | S | Write key; check in `require_*_snapshot_engine`; mismatch → 503 with clear message |
| **D-06** | No freshness enforcement. Q10012 snapshot mtime 2026-09-22 vs audit date 2026-11-04 (~43 days). `snapshot_loaded_at` is in API meta; UI does not read it. `/health` is static `ok`. | freshness | `snapshot.py:184`; Dockerfile `HEALTHCHECK` → `/health` | Confirmed | **Release blocker** (needs SLA — O-1) | High | S | `/ready` with age + rows + schema_version; healthcheck uses it; alert above threshold |
| **D-07** | No `PRAGMA` (`journal_mode`, `busy_timeout`). Default rollback journal; large writer may lock readers (`database is locked`). | txn / ops | Grep `PRAGMA` / `busy_timeout` → 0 | Potential | **Defer** (mitigated by D-01) | Low–Med | S | After atomic swap, writer and reader processes do not share one file mid-write |
| **D-08** | Query A population ≠ Query B base: `store_month` build excludes NULL `PrintStore`/`Year`/`Month`; Query B filters by `AnswerTime` (NULL AnswerTime out). No reconciliation gate. Related to A001 **A-02** (month vs date grain on custom ranges). | constraint | `refresh_q10012_snapshot.py:195-199`; `_period_params` | Potential (NULL rates not measured) | **Release blocker** as refresh gate | Med | S | Gate: `sum(store_month.total_count)` = `COUNT(answers WHERE PrintStore,Year,Month NOT NULL)`; log NULL counts in meta |
| **D-09** | No UNIQUE on `ParticipateNumber` in `answers`. VIEW duplicates would double Query A cells. | constraint | schema | Potential | **Defer** (metric in gate) | Med | S | Count dupes on refresh; log / fail above threshold |
| **D-10** | TTS refresh: `KPI_Score NOT NULL`. NULL from AP → IntegrityError caught as generic “Could not read … from AP”; data rolls back correctly, message is wrong. | constraint | `tts_kpi_snapshot.py:261-290` | Confirmed | **Defer** | Low | S | Filter NULLs or raise a distinct error |
| **D-11** | **N+1 not found.** `/process` = Query A + Query B (2 statements). Kitchen = 1 GROUP BY SELECT. TTS KPI = 1 SELECT (snapshot / sql) or 1 HTTP. No per-row `execute` loops. | query | `queries.py`; `tts_kitchen_queries.py:154-157`; `tts_kpi_ap.py` | **Confirmed absent** (assessment correct) | — | — | — | — |
| **D-12** | Extra engines per `/process` on snapshot: `_process_engine` twice + `process_source_meta_extra` → up to 3 `create_engine` calls, no dispose. Extra file descriptors under SQLite; VIEW path = A001 **A-03**. | query / ops | `queries.py:250,484,502` | Confirmed | **Defer** if G-1 = snapshot-only; else A-03 blocker | Low–Med | S–M | One engine per URL; dispose in lifespan |
| **D-13** | No refresh crash / empty-pull / meta-mismatch tests. One TTS happy-path refresh test only. | txn | `tests/test_tts_kpi_snapshot.py:108-144` | Confirmed | **Release blocker** as acceptance for D-01…D-05 | Med | S | Unit tests for gates + atomic swap + schema_version |
| **D-14** | `ix_answers_blacklist_time` likely unused; Query B phase 2 cost unknown without timing. | query | §2 | Potential | **Defer** | Low | S | `EXPLAIN QUERY PLAN` + `db_query_b_time_ms` before adding indexes |
| **D-15** | VIEW path: no query timeout; Query B unbounded into memory; kitchen no timeout. | query | `queries.py:440-448`; `tts_kitchen_queries.py:155` | Confirmed (A001 A-03 / PERF-03) | **Blocker\*** only if VIEW is production (G-1) | Med–High | S–M | Decide G-1 → timeouts / caps |
| **D-16** | No persistence of plans / runs (DATA-05). Plans live in browser `sessionStorage`. | schema | assessment DATA-05 | Confirmed; likely by design | **Defer** (product G-4) | — | L | Out of A002 design scope |
| **D-17** | PII (`UserContact`, `PhoneFromLog`) stored plaintext in SQLite; hashed on read. Integrity/ops only: file loss = PII exposure. Remediation → A003. | schema | `snapshot.py:38-42`; `db_sample.redact_row` | Confirmed | Hand off to A003 | — | — | Note only |

---

## 4. Refresh crash scenarios

| Failure point | Q10012 | TTS KPI | Outcome |
|---------------|--------|---------|---------|
| Source error (SQL / network) before or during pull | `with src.connect(), snap.begin()` → rollback; old data intact | Same + `TtsKpiSourceError(503)` | Safe |
| Insert error (e.g. IntegrityError) | Full rollback | Full rollback | Safe (D-10: message wrong) |
| Mid-delete / mid-insert, process killed | SQLite rolls back on reopen **if journal is visible** | Same | Safe on host; **unsafe under single-file Docker mount** (D-02) |
| Between data commit and `set_meta` | New rows, stale meta | Same | **D-03** |
| Source returns 0 rows | DELETE commits; empty snapshot served | Empty → 404 on read (loud) | **D-04** silent for Q10012 |
| Concurrent refresh | Serialized by SQLite lock | Same | Acceptable |

Assessment DATA-01 said “one transaction — good” for delete+insert. That holds for mid-write of **data**. It does **not** cover meta (D-03), empty success (D-04), or container file-mount ops (D-02).

---

## 5. Index optimization plan

| Priority | Change | Store | Why | Risk | Class |
|----------|--------|-------|-----|------|-------|
| 1 | Measure Query B with `EXPLAIN QUERY PLAN` + `db_query_b_time_ms` before adding anything | q10012 | No proven bottleneck | Low | Defer until evidence |
| 2 | Optional: precompute `entity_key` + `day` on refresh; index `(entity_key, PrintStore, day)` | q10012 | Speeds phase 2 CTEs if timed slow | Schema bump → needs D-05 | Defer |
| 3 | Drop `ix_answers_blacklist_time` if EXPLAIN shows unused | q10012 | Smaller file / faster refresh | Verify EXPLAIN | Defer |
| 4 | No change to `store_month` PK order | q10012 | ~10k rows | — | Defer |
| 5 | No change to `kpi_rows` indexes | tts_kpi | Tiny file | — | Defer |

---

## 6. Critical migrations / refresh changes before release (ordered)

1. **Decide G-1 and freshness SLA** (O-1, O-3) — classification of D-12 / D-15 depends on this.
2. **`schema_version`** in both snapshot metas + check in `require_*` (D-05).
3. **Refresh to `*.tmp`** next to the target; meta written inside tmp before swap (D-01, D-03).
4. **Validation gates** before swap (D-04, D-08, D-09): row floor + ≥ N% of previous; `store_month` reconciles with `answers`; null/dupe counts logged (and fail above threshold if policy says so).
5. **Atomic `os.replace`**; keep previous as `*.prev` / N copies (INFRA-05).
6. **Compose**: mount `data/` directory, not individual files (D-02). Verify rename with open readers on the target OS.
7. **`/ready`**: file present, `loaded_at` age, rows, `schema_version`; Docker healthcheck points here (D-06).
8. **Tests** covering items 2–5 (D-13).

Until Approved, **no application code changes** from this SPEC.

---

## 7. Defer list (and why safe for now)

| ID | Why defer is acceptable |
|----|-------------------------|
| D-07 | Atomic swap removes shared mid-write locking between refresh and API |
| D-09 | Covered as metric inside refresh gate; UNIQUE is optional |
| D-10 | Rollback already correct; message polish only |
| D-12 | Under G-1 = snapshot-only, SQLite FD churn is ops noise, not KPI wrongness |
| D-14 | No timing evidence of Query B hotspot |
| D-16 | Product decision (G-4), not a schema/refresh integrity bug |
| D-17 | Security track (A003); note for integrity of the writable store only |

---

## 8. Open questions

- **O-1.** Snapshot freshness SLA (daily / weekly / other)? Sets D-06 threshold.
- **O-2.** Who runs refresh, on which host, under which service account? (INFRA-01 / G-3)
- **O-3.** A001 **G-1**: production = snapshot only, or is VIEW allowed? Affects D-12 / D-15 class.
- **O-4.** Real NULL rates for `PrintStore` / `Year` / `Month` / `AnswerTime`, and `ParticipateNumber` dupes? Needs a read-only query against the existing snapshot (out of scope for this first pass).
- **O-5.** Runtime host for the container: Windows Docker Desktop vs Linux? Severity of D-02 depends on it.

---

## 9. Re-verification of assessment DATA-* / related

| Seed ID | Verdict | Note |
|---------|---------|------|
| DATA-01 | **Confirmed, strengthened** | In-place refresh yes; plus D-02 (file mount) and D-03 (meta outside txn) |
| DATA-02 | **Confirmed** | No `schema_version` → D-05 |
| DATA-03 | **Confirmed potential** | Index gap for Query B phase 2 → D-14; defer without timing |
| DATA-04 | **Confirmed** | No freshness enforcement → D-06; live file ~43 days old |
| DATA-05 | **Confirmed; by design** | → D-16 Defer |
| N+1 “not found” | **Confirmed** | → D-11 |
| PERF-03 / ARCH-04 (data path) | **Confirmed** | → D-15 / D-12; class gated by G-1 |
| INFRA-01 | **Confirmed** | Manual snapshot path; container cannot reach SQL Server |
| INFRA-05 | **Confirmed** | No backup/version of snapshots |
| ARCH-02 (data path) | **Cross-link** | Month vs date grain → A001 A-02; population skew → D-08 |

---

## 10. Limitations

- No EXPLAIN QUERY PLAN against live SQLite.
- No measurement of NULL / duplicate rates on the 190 MB snapshot.
- No Docker / Windows rename-with-open-handles experiment for D-02.
- No tests executed in this pass.
- Architecture findings only cross-linked; full redesign stays in A001.

---

## Acceptance check (SPEC-A002 §7)

- [x] REPORT-A002 created at the path from the spec.
- [x] N+1 explicitly confirmed or denied with evidence (denied — D-11).
- [x] Refresh path crash scenarios (mid-delete / mid-insert / meta write) covered (§4).
- [x] Index plan and pre-release migration/refresh checklist present (§5–§6).
- [x] Every blocker has a concrete pre-release action.
- [x] README index: A002 → Spec + Report + status.
