# REPORT-A012 — Integration & Transition Readiness: Snapshot → Live Data Cutover

| Field | Value |
|-------|--------|
| **Spec** | [SPEC-A012](../specs/SPEC-A012-integration-transition-cutover.md) |
| **Branch** | `audit/production-readiness` |
| **Date** | 2026-11-05 |
| **Method** | Static review of `web/src/api/client.ts`, `PipelineRunPanel.tsx`, source env defaults, plus gates from A001/A002/A004/A006/A007/A009/A010. No cutover was executed. |
| **Status** | Report ready (G-1 / row-count floor / freshness SLA / refresh-host owner open) |

> Data and source transition only. App probes stay in [REPORT-A009](./REPORT-A009-production-readiness-golive.md). Contract map stays in [REPORT-A010](./REPORT-A010-api-contracts-mocking.md).
> Cross-links: [REPORT-A001](./REPORT-A001-architecture-coupling.md) (A-01, G-1),
> [REPORT-A002](./REPORT-A002-db-data-integrity.md) (D-01/D-02/D-04/D-05),
> [REPORT-A004](./REPORT-A004-testing-quality.md) (SM-13/SM-14),
> [REPORT-A006](./REPORT-A006-cicd-release-dr.md) (image rollback, CD-05),
> [REPORT-A007](./REPORT-A007-performance-scalability.md) (P-03, P-04).

---

## 1. Checklist

| # | Item | Status | Evidence |
|---|------|--------|----------|
| 1 | Data validation on the way into the UI and the API | **Partial** | Every response goes through `schema.parse` in `fetchJson` (`client.ts:79-82`). A schema break becomes `ApiError` with `Invalid API response: …`. `PipelineRunPanel.tsx:128-130` shows `error.message`, not the previous successful result. `POST /process`, `/plans`, and `/plans-tts` are also Zod-parsed before send (`client.ts:117-136`). The server accepts bodies with Pydantic. Gaps: `meta` is a free dict. The UI does not read `query_b_mode` or `sanitization_source` (no matches under `web/src`). A source change does not break the schema and is not visible on screen. `SurveyAnswerRow` is `extra="allow"` on the server (A003 S-06). |
| 2 | Cutover plan documented | **Fail** | The repo has no signed “snapshot → live data” plan. The draft is in §4. Until it is accepted, this item is open. |
| ext | Target source decided | **Fail** | G-1 is open. Code default is `SANITIZATION_SOURCE=view` (`snapshot.py:85`). Docker sets `snapshot` (`docker-compose.yml`). TTS code default is `synthetic`; Docker sets `snapshot`. |
| ext | KPI meaning does not change silently | **Fail** | A001 A-01: VIEW applies blacklist only; snapshot applies tiers 1–3. `echo_config` still reports the tiers as enabled. The UI does not tell them apart. |
| ext | Refresh validated and atomic before traffic | **Fail** | A002 D-01/D-04: write goes into the live file, an empty pull is not rejected, there is no `schema_version`. |
| ext | Rollback of source and file | **Fail** as a procedure | The previous file is not kept (D-01). Image rollback is A006 and is not in place. Steps are in §5. |
| ext | Smoke after the switch | **Fail** | SM-13 (`source=db` → `sanitization_source=snapshot`) is described in A004 and is not a required promote step (A011). E2E runs on synthetic. |

**The internal-launch blocker on snapshot is not “no ODBC”.** It is that the source is not locked, refresh can replace the file with an empty one, and a VIEW flip would change the “5%” calculation with no signal in the UI. ODBC in the container, physical tables, and shadow traffic are **Defer** if v1 stays on snapshot.

---

## 2. Source matrix

| Flow | Without Docker | Docker | v1 target | Later |
|------|----------------|--------|-----------|-------|
| Sanitization | `view` (live MSSQL) | `snapshot` | **snapshot**, after G-1 | VIEW or physical tables |
| TTS KPI | `synthetic` | `snapshot` | **snapshot** | `sql` or DreamFactory, once network and a key exist |
| Kitchen | live MSSQL; image has no ODBC | endpoint exists; button off (`KITCHEN_RUN_ENABLED = false`) | **do not enable** | a separate decision on SQL access |
| Inline synthetic | UI presets | same presets | keep as a demo, not as the prod number | — |

Synthetic and snapshot are different populations. Their KPIs must not be compared for equality. The production oracle is a second run of the same snapshot and the same period, not the `small` preset.

---

## 3. Validation coverage

| Path | Check | Gap |
|------|-------|-----|
| UI responses | Zod on every `client.ts` call | `meta` does not catch a calculation-mode change |
| POST bodies | Zod before send, Pydantic on the server | extra survey-row fields are accepted |
| OpenAPI | generated from Pydantic; one test on `POST /process` | no Zod parity check (A010 C-01) |
| Snapshot | `SELECT 1 … LIMIT 1` | an empty table passes; no age check; no `schema_version` |

A contract break is visible in the UI. A change in KPI meaning is not.

---

## 4. Cutover plan (v1 = snapshot)

| Step | Action | Config / command | Verify | Abort if |
|------|--------|------------------|--------|----------|
| 0 | Lock G-1: prod = snapshot; VIEW is not this launch | a decision, not code | written in the change log | there is no decision |
| 1 | Copy the current `data/q10012_snapshot.sqlite` and `data/tts_kpi_snapshot.sqlite` | copy outside the container tree | file opens and has rows | there is no copy |
| 2 | Refresh on a host that can reach SQL, not inside the container | `uv run python scripts/refresh_q10012_snapshot.py` and the TTS equivalent | after A002: not empty, `schema_version` matches, `loaded_at` is new, row count is not below the floor | the floor fails — do not replace the file the container is already reading |
| 3 | Replace the file only by an atomic swap inside the mounted `data/` directory | as A002 D-01/D-02, not built yet | the container sees the new inode, not a directory stub | the mount is a single file |
| 4 | Host env | `SANITIZATION_SOURCE=snapshot`, `TTS_KPI_SOURCE=snapshot` | the container has the same values | someone set `view` |
| 5 | Start the tagged image | `IMAGE_TAG=vX docker compose up -d` (A011) | `/health` 200. After A009, `/ready` 200 as well | the image is not that tag |
| 6 | Drop the browser cache | full reload. There is no server result cache (A007 P-04). `sample/db` lives 5 minutes in React Query | a new run, not the old `processResult` in `uiStore` | the screen still shows the old period |
| 7 | Smoke | SM-13: `POST /process` `source=db` → 200 and `meta.sanitization_source=snapshot`. SM-14: TTS KPI panel is non-empty | both green | either is red |
| 8 | KPI meaning | response `meta.query_b_mode=tier1_full` | not `blacklist_only` | the mode is VIEW |

Kitchen is not in these steps: the button is off and the image has no ODBC.

---

## 5. Rollback

1. Put the previous snapshot files back from the step-1 copy.
2. Do not set `SANITIZATION_SOURCE=view` to “fix” an empty snapshot. That is a different calculation.
3. If the image is what broke, not the data, use the previous tag (A006).
4. Re-run SM-13. Until it is green, do not tell users the data is new.

---

## 6. Not in v1

- Do not add ODBC to the container for VIEW. That is a separate launch: timeouts, a row cap, and a tiers 2–3 guard (A001 A-03, A007 P-03).
- Do not promise the physical tables from SPEC §5.4. They do not exist.
- Do not enable kitchen or TTS `sql` / DreamFactory until there is network, a secret, and a PII decision.

---

## 7. Open questions

| ID | Question |
|----|----------|
| **O-1** | G-1: is v1 snapshot-only? |
| **O-2** | The floor “rows not below the previous copy”, and the allowed age of `loaded_at` (SLA from A002). |
| **O-3** | Where is the refresh host that can reach SQL, and who runs it (A006 CD-05)? |
| **O-4** | Will VIEW ever run in this same container? If yes, that is not this plan. |

---

## Changelog

| Date | Change |
|------|--------|
| 2026-11-05 | Initial REPORT-A012 from SPEC execution (EN). |
