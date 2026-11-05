# REPORT-A010 — API Contracts & Mocking: Decouple UI from Snapshots & Sources

| Field | Value |
|-------|--------|
| **Spec** | [SPEC-A010](../specs/SPEC-A010-api-contracts-mocking.md) |
| **Branch** | `audit/production-readiness` |
| **Date** | 2026-11-04 |
| **Method** | Static review of `web/src/api/*`, `web/src/schemas/*`, `backend/main.py` routes, `tests/test_process_api.py`, `web/package.json`, `web/tests`. OpenAPI was not fetched from a running server. |
| **Status** | Report ready (codegen / MSW / contract-CI owner open) |

> **Reality check.** The product already has FastAPI + React. “API-first” here means contract
> discipline as features grow, and isolation of screens from SQLite snapshot / VIEW / synthetic
> **behind an adapter** — not “the backend does not exist yet”.
> Synthetic presets stay a valid adapter path.
> Cross-links: [REPORT-A001](./REPORT-A001-architecture-coupling.md) (source switch is server env),
> [REPORT-A004](./REPORT-A004-testing-quality.md) (e2e hits a live uvicorn),
> [REPORT-A005](./REPORT-A005-observability.md) (UI does not read `snapshot_loaded_at`),
> [REPORT-A008](./REPORT-A008-maintainability.md) (M-02 / M-16 duplicated constants).

> **Method note.** The Cursor search index lists deleted `tests/test_tts_process_api.py` and
> `tests/test_tts_order_bump_api.py`. `Test-Path` = False. They are not cited below.

---

## 1. Checklist (brief)

| # | Item | Status | Evidence |
|---|------|--------|----------|
| 1 | **API-First:** OpenAPI / JSON schemas as the primary contract? | **Partial** | Server source of truth is Pydantic. OpenAPI (`/openapi.json`, `/docs`) is generated at runtime; no contract file is committed. Zod in `web/src/schemas/*` is hand-maintained. `backend/ARCHITECTURE.md` says the two must match 1:1; there is no automated check. The only live OpenAPI test is `tests/test_process_api.py:118-134`: `POST /process` 200 is `SanitizationResponse` (or its required fields). Historically `SPEC.md` + Pydantic came first, then the Zod mirror. |
| 2 | **API client:** no direct `fetch` / DB from UI components? | **Pass** | `fetch` exists only in `web/src/api/client.ts:53`. Pages and panels import `web/src/api/hooks.ts`. No `sqlite` usage under `web/src`. `DocumentationPage.tsx` reads `API_BASE_URL` only to link `/docs`. |
| 3 | **Mocking:** stubs with latency and 4xx/5xx? | **Fail** | No MSW (`web/package.json`). Vitest mocks hooks (`vi.mock('../api/hooks')`) and Plotly — canned data, no delay, no status catalog. `ApiError` can carry an HTTP status (`client.ts:38-45`) but there is no shared fault harness. Playwright does not intercept routes (no `page.route` under `web/tests`). E2E talks to a live uvicorn. |
| 4 | **Snapshot isolation:** switch backend via Base URL / adapter only? | **Partial** | UI host is `VITE_API_BASE_URL` (`config.ts:6-16`): empty → same-origin (Docker); unset → `http://127.0.0.1:8001`. Snapshot vs VIEW is server `SANITIZATION_SOURCE`; screens do not know it. The UI does not open the snapshot file. Dropping inline means editing `usePipelineRunner.ts` and `SampleDataPanel.tsx`, not every screen. Duplicates remain: kitchen window (`ttsKitchen.ts` and `tts_kitchen_queries.py`), TTS floor/ceiling on the page (A008 M-02), preset `ytd_2026`. |

**No Release blocker for this SPEC.** Screens are not wired to the snapshot file and do not need a rewrite to change host. The critical path validates responses with Zod inside `fetchJson`. The missing Pydantic ↔ Zod CI check is **Defer**.

---

## 2. Contract map

| Endpoint | Pydantic | Zod | Consumer |
|----------|----------|-----|----------|
| `GET /health` | `HealthResponse` | `healthResponseSchema` | `useHealth` → `ApiStatusChip` |
| `GET /api/v1/sample/{preset}` | `SampleResponse` | `sampleResponseSchema` | `useSample` → `SampleDataPanel` |
| `GET /api/v1/sample/db` | `SampleResponse` | same | `useSampleDb` → `SampleDataPanel` |
| `POST /api/v1/process` | `ProcessRequest` / `SanitizationResponse` | `processRequestSchema` / `processResponseSchema` | `useProcess` → `usePipelineRunner` |
| `POST /api/v1/plans` | `PlanRequest` / `PlanResponse` | `plan.ts` | `usePlan` → `PlannerPage` |
| `POST /api/v1/plans-tts` | `TtsPlanRequest` / `TtsPlanResponse` | `ttsPlan.ts` | `useTtsPlan` → `TtsPlannerPage` |
| `GET /api/v1/sample/tts-kpi/{preset}` | `TtsKpiPanelResponse` | `ttsKpiPanelSchema` | `useLoadTtsKpiPanel` (hook exists; no page calls it) |
| `GET /api/v1/tts-kpi/ap` | `TtsKpiApPanelResponse` | same schema | `useLoadTtsKpiFromAp` → `TtsPlannerPage` |
| `GET /api/v1/tts-kitchen/before-after` | `KitchenBeforeAfterResponse` | `kitchenBeforeAfterSchema` | `useKitchenBeforeAfter` → `TtsKitchenPage` |

Every client call goes through `fetchJson`, which `schema.parse`s the body and throws `ApiError` on non-2xx (`client.ts:48-86`).

---

## 3. Coupling hotspots

| Place | What breaks | Seam? |
|-------|-------------|-------|
| `usePipelineRunner.ts:38-61` | Builds `source: 'db' \| 'inline'` and sends `rows: []` for db. A new source mode is edited here, not in charts. | **Adapter** |
| `SampleDataPanel` | Knows preset names `small` / `medium` / `stress` / `db`. | Adapter (small) |
| `config.ts` | Host switch is one env var. | **Adapter** |
| Kitchen dates, TTS floor/ceiling, `ytd_2026` | Server constant changes are not picked up until the TS copies change (A008 M-02 / M-16). | Coupling |
| `meta.snapshot_loaded_at` | UI does not read it (A005). Good for file isolation; bad for freshness display. | Isolation (intentional) |

Switching snapshot ↔ VIEW does not require a screen rewrite. Switching API host does not either.

---

## 4. Mocking: as-is vs recommended

**As-is.** Unit tests replace hooks. There is no FE-without-backend mode: Vite calls `:8001`. `GET /sample/{preset}` is a real backend adapter, not a stub. Keep it.

**Recommended (not for this launch).** One MSW handler (or a shared test double) that can return 422, 503, and a delay. A CI check that Zod accepts the required keys of `POST /process`, `POST /plans`, and `GET /tts-kpi/ap` from `/openapi.json`. Do not generate a client from OpenAPI while that check is green and the schema set stays small.

---

## 5. Remediation backlog

| ID | Item | Class | Effort |
|----|------|-------|--------|
| **C-01** | CI: export `/openapi.json` and assert Zod accepts an example or the required keys of the critical responses | **Defer** | S |
| **C-02** | MSW or one shared test double: 422, 503, latency. Not per screen | **Defer** | S–M |
| **C-03** | Serve kitchen window and TTS bounds from the API; drop the TS copies (joins A008 M-02 / M-16) | **Defer** | S |
| **C-04** | Do not generate an OpenAPI client until C-01 is green | **Recommendation** | — |

---

## 6. Open questions

| ID | Question |
|----|----------|
| **O-1** | Is a frontend that runs without the backend required? If yes, C-02 moves up. |
| **O-2** | Who owns the Pydantic ↔ Zod check in CI? |

---

## Changelog

| Date | Change |
|------|--------|
| 2026-11-04 | Initial REPORT-A010 from SPEC execution (EN). |
