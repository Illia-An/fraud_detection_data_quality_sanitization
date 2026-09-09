# PoC Architecture Contract

## Stack

| Layer    | Technology                          |
|----------|-------------------------------------|
| Backend  | FastAPI + Pydantic v2 + pandas      |
| Frontend | React 19 + Vite + MUI (`web/`)      |
| Logic    | `src/fraud_guard/tier{1,2,3}.py`    |

Angular 17 PoC reference: git tag `poc/angular-concept` (`frontend/`).

## Endpoints

| Method | Path               | Request            | Response          |
|--------|--------------------|--------------------|-------------------|
| GET    | `/health`          | —                  | `HealthResponse`  |
| GET    | `/api/v1/sample/{preset}` | preset: small/medium/stress | `SampleResponse` |
| GET    | `/api/v1/sample/db` | optional `store`/`year`/`month` | `SampleResponse` meta only; `AnswerTime >= 2026-01-01` through latest |
| POST   | `/api/v1/process`  | `ProcessRequest` (`source=inline` + `rows`, or `source=db`) | `ProcessResponse` |

UI: on start, `GET /sample/db` (period counts) then auto `POST /process` with `source=db` (server loads the period). If the DB is unavailable, fall back to synthetic `small`. Preset buttons still call `GET /sample/{preset}` then `POST /process` with rows.

CORS: `http://localhost:5173` (React v2; override via `API_CORS_ORIGINS`).

Default API port: **8001** (`API_PORT` in `.env`).

```powershell
uv run uvicorn backend.main:app --reload --host 127.0.0.1 --port 8001
```

- Health: http://127.0.0.1:8001/health
- Docs: http://127.0.0.1:8001/docs

```text
React form → ProcessRequest (JSON)
  → backend/service.run_pipeline()
    → filter Q10012 answered rows
    → Tier1 flags (blacklist, freq≥3/store/day, optional always-5)
    → Tier2 flags (store-month z>2 or five_pct≥90)
  → ProcessResponse → KPI cards / tables / Plotly chart
```

PoC UI runs **Tier 1 + Tier 2** only. `src/fraud_guard/tier3.py` remains for research / notebooks.
## Type parity

- Python: `backend/schemas.py`
- TypeScript: `web/src/schemas/api.ts` (Zod mirror)

Field names and nesting MUST match 1:1 at the JSON boundary (PascalCase for survey row columns).

## Security

- No PII in logs or responses beyond hashed entity keys for Tier 1.
- `GET /api/v1/sample/db` returns period metadata only (no survey row payload).
- `POST /process` with `source=db` hashes `UserContact` / `PhoneFromLog` on the server; never selects name columns.
- Do not commit `.env` or raw survey exports.
- Read-only `SELECT` against `dbo.TargetsByMetrics_RateGetAnswers` only.
