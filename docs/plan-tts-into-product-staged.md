# Plan: TTS into product (staged)

**Status:** active roadmap (product integration)  
**Research pack:** `docs/research/tts_research_result/`  
**Source:** `MC.dbo.TargetsByMetrics_McKitiBump`  
**Git model:** trunk (`main`) + short-lived `exp/tts-<stage>` → PR → merge → delete branch + release tags on meaningful `main` snapshots  
**Do not:** long-lived “full TTS integration” branch; big-bang release; touch 5% / Pressure / onboarding unless a stage explicitly needs shared shell and is scoped.

Use this doc to restore context when continuing TTS work stage-by-stage.

---

## Locked from research (v1 truth)

| Element | Decision |
|---------|----------|
| TTS clock | Monitor dwell only: `UpDatetime` → `BumpDateTime`, **seconds** |
| Out of data | Payment → screen latency (not in view) |
| Sanitization v1 | Keep **TTS ≥ 30** (~9% drop; network/store means rise; negatives gone) |
| Grain note | One row = KVS **bump**, not full order |
| Order key (when used) | `StoreIndex` + day(`SaleDate`) + `WeborderID` |

**One-liner:** *TTS = monitor only; v1 clean = ≥30s; pre-KVS out of scope.*

### Research refs

- `docs/research/tts_research_result/report_general_tts_research.md`
- `docs/research/tts_research_result/report_exploration_00.md`
- `docs/research/tts_research_result/report_clean_01_ge30.md`
- `docs/research/tts_research_result/report_clean_02_order_level.md`
- `docs/research/tts_research_result/schema_TargetsByMetrics_McKitiBump.md`

---

## Product rules: filter vs order collapse

These are **two layers**, not alternatives:

1. **≥ 30 seconds** — sanitization (required in v1). Drops impossible short durations.
2. **Order aggregation (MAX / AVG)** — optional collapse of many bumps into one order TTS **after** (or before) cleaning.
   - **MAX** = stricter picture (worst station/segment of the order).
   - **AVG** = softer (~9% lower than MAX in research).
   - Neither replaces ≥30.

### v1 defaults

| Layer | v1 | Later |
|-------|----|--------|
| Filter | `TTS ≥ 30` locked | Configurable threshold in UI (backlog) |
| Primary KPI grain | **Bump rows** + ge30 (`order_agg = none`) | Enable order panel when product asks |
| Config enum | `order_agg: "none" \| "avg" \| "max"` in contract from Stage 0 | UI toggle; default can stay `none` or move to `avg` |
| MAX | In contract as option; UI hidden/disabled until needed | Stricter service view |
| AVG | Same | Typical-per-bump view |

**Open (non-blocking):** filter bumps ≥30 then MAX vs filter on order max only; KVS 21/31; long-tail cap; why view ⊂ base table.

---

## Delivery philosophy

- Customer wants the capability **in the product** — integrate **gradually on trunk**, not a separate full-integration edition.
- After each stage: manual verify on merged `main`, then next branch.
- Early UI may feel crowded (extra nav/page). That is acceptable. After stages 4–6 (or once sanitize + panel are stable), a short `exp/tts-ux-compose` pass can rearrange: metric switch, tabs, separate sections — **without reopening** TTS math/API.
- Prefer **separate API** (`/process-tts`) and **own config/response** so 5% stays intact and UX can be recomposed later.

**Suggested tags (examples, after merge to main):** `v1.x.x-tts-spec`, `…-tts-api`, `…-tts-ui`, `…-tts-panel` — tag meaningful slices; do not wait for all six stages.

---

## Stage map (app logic)

```text
Research (done)
    ↓
0. Spec + contract
1. DB read (Query A/B-like)
2. Pure sanitize engine (≥30; order_agg stub)
3. API /process-tts
4. Sanitization UI (TTS)
5. Cleansed panel handoff
6. Planner-like TTS (epic; sub-branches)
```

---

## Stage 0 — Spec & contract

**Branch:** `exp/tts-spec-contract`  
**Status:** done (docs on branch; merge when reviewed)

**Goal:** Lock product definition and API/panel shapes before code.

**Deliverables**

- [x] `SPEC-tts.md` — invariants, clock, ≥30, layers filter vs `order_agg`, out of scope
- [x] `docs/contracts/tts_process_handoff.md` — request/response/panel draft; `tts_min_sec` + `order_agg`
- [x] Research pack pointer + backlog + open questions in SPEC
- [x] Cross-link from `SPEC.md` → TTS track

**DoD**

- Spec review-ready; 5% unchanged; open questions explicit

**Out of scope:** SQL, UI, planner

**Next:** Stage 1 — `exp/tts-db-read` (from updated `main` after this PR merges)

---

## Stage 1 — Data access (read-only)

**Branch:** `exp/tts-db-read`  
**Status:** done (on branch; merge when reviewed)

**Goal:** Read McKitiBump with same discipline as 5% Query A (no `SELECT *`).

**Deliverables**

- [x] Config: optional `TTS_DATABASE_URL` + `TTS_VIEW` (`.env.example`, `db/config.py`, `get_tts_engine`)
- [x] `backend/tts_queries.py` — Query A store×month aggregates; bump-row SELECT builder (audit cols)
- [x] Period on `SaleDate` (inclusive); `BumpDateTime IS NOT NULL`; `query_time_ms` on baseline
- [x] Tests: `tests/test_tts_queries.py` (builders/mocks; no live SQL in CI)

**DoD**

- Baseline aggregates callable; timing on baseline; 5% path unchanged

**Depends on:** Stage 0 field names / grain

**Next:** Stage 2 — `exp/tts-engine-ge30`

---

## Stage 2 — Pure sanitization engine

**Branch:** `exp/tts-engine-ge30`  
**Status:** done (on branch; merge when reviewed)

**Goal:** Pure logic in `src/` (parallel to `fraud_guard`), no FastAPI/UI.

**Deliverables**

- [x] `src/tts_guard/` — clock + `run_tts_sanitize` (actual → ge30)
- [x] `src/schemas/tts.py` — `TtsPipelineConfig` / result contracts
- [x] `order_agg`: `none` | `avg` | `max` (ge30 on bumps **then** collapse; echoed in meta)
- [x] `tests/test_tts_guard.py` — shorts/negatives, mean rises, MAX > AVG

**DoD**

- pytest green; I/O-free pure module; qualitative match to research

**Depends on:** Stage 0; Stage 1 preferred for integration later

**Next:** Stage 3 — `exp/tts-api-process`

---

## Stage 3 — API endpoint

**Branch:** `exp/tts-api-process`  
**Status:** done (on branch; merge when reviewed)

**Goal:** Separate TTS process path (avoid breaking 5% `/process`).

**Deliverables**

- [x] `POST /api/v1/process-tts` (`backend/tts_service.py`, `tts_schemas.py`)
- [x] `source=inline|db`; bump-row fetch via `load_tts_bump_rows_from_settings`
- [x] Profiling meta + `db_tts_rows_time_ms`; echo_config
- [x] `tests/test_tts_process_api.py`
- [x] Synthetic presets (`tts_guard.synthetic`) + `GET /api/v1/sample/tts/{small|medium|stress}` (demo without MC)

**DoD**

- Documented OpenAPI; 5% `/process` behavior unchanged; `source=db` for TTS

**Backlog:** TTS sqlite snapshot fast-path (like Q10012)

**Next:** Stage 4 done on `exp/tts-ui-sanitize` → Stage 5 panel handoff

---

## Stage 4 — Sanitization UI (TTS)

**Branch:** `exp/tts-ui-sanitize`  
**Status:** done (this branch)

**Goal:** What-if surface like Sanitization, **no** planner. UX polish / compose can wait.

**Deliverables**

- [x] Route/nav for TTS sanitization (`/tts`, nav item) — isolated from Q10012
- [x] Period + Run; threshold default 30; synthetic presets + optional db
- [x] Network/store before→after charts (seconds); i18n EN/HE
- [x] `order_agg` control: disabled in v1 (default `none`)

**DoD**

- [x] Successful Run shows delta; empty/error states; unit tests; 5% onboarding anchors untouched

**Next:** Stage 5 — `exp/tts-panel-handoff`

---

## Stage 5 — Cleansed panel handoff

**Branch:** `exp/tts-panel-handoff`  
**Status:** pending

**Goal:** Store×month cleansed TTS panel (mirror of 5% `sanitizedPanel`).

**Deliverables**

- Panel schema: `store_id, year, month, tts_sec, volume` (+ echo/meta)
- Derive from process result (client and/or API)
- Optional CSV export
- `docs/contracts/tts_sanitized_panel_handoff.md`

**DoD**

- After successful TTS Run, panel ready for planner gate

**Depends on:** Stages 3–4

---

## Stage 6 — Planner-like TTS (epic)

**Branches:** `exp/tts-planner-shell` → `exp/tts-planner-engine` → `exp/tts-planner-hero` (example split)  
**Status:** pending (start only after Stage 5 + target clarity)

**Goal:** Planning on cleansed TTS; **do not** copy 5% Pressure/YTD without separate product rules (seconds ≠ %).

**Substages (example)**

- **6a** Shell: page + block Run without TTS sanitization baseline
- **6b** Plan engine: targets/trajectory for seconds
- **6c** Hero / evaluation; Pressure-analogue only after explicit decision

**DoD**

- Run on TTS panel; 5% Planner untouched

---

## Optional later — UX compose

**Branch (example):** `exp/tts-ux-compose`

After TTS sanitize (+ panel/planner) exists on trunk: rethink placement (metric switch, tabs, separate product areas). No change to locked TTS math unless product revisits definitions.

---

## Explicit backlog (not v1 stage blockers)

- Configurable threshold in UI
- UI for MAX / AVG order collapse
- KVSGroup 21 vs 31 inclusion
- Long-tail cap (>30–60 min)
- TTS snapshot / Docker data path
- Reconcile vs official TTS report
- Onboarding / analytics for TTS

---

## Cadence

```powershell
git checkout main
git pull origin main
git checkout -b exp/tts-spec-contract
# … work, verify, PR → merge …
# repeat: exp/tts-db-read, exp/tts-engine-ge30, …
```

After each merge: short note — what landed, how to verify, what’s still open → next stage.

---

## Immediate next step

**Stages 0–4 done on trunk path (Stage 4 on `exp/tts-ui-sanitize`).** Next: **Stage 5** — `exp/tts-panel-handoff`.
