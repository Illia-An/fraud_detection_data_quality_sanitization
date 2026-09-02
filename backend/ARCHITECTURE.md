# PoC Architecture Contract (Agent 1)

## Stack

| Layer    | Technology                          |
|----------|-------------------------------------|
| Backend  | FastAPI + Pydantic v2 + pandas      |
| Frontend | Angular 17+ Standalone + Material   |
| Logic    | `src/fraud_guard/tier{1,2,3}.py`    |

## Endpoints

| Method | Path               | Request            | Response          |
|--------|--------------------|--------------------|-------------------|
| GET    | `/health`          | —                  | `HealthResponse`  |
| GET    | `/api/v1/sample/{preset}` | preset: small/medium/stress | `SampleResponse` |
| POST   | `/api/v1/process`  | `ProcessRequest`   | `ProcessResponse` |

CORS: `http://localhost:5173` (React v2; override via `API_CORS_ORIGINS`).

Default API port: **8001** (`API_PORT` in `.env`).

```powershell
uv run uvicorn backend.main:app --reload --host 127.0.0.1 --port 8001
```

- Health: http://127.0.0.1:8001/health
- Docs: http://127.0.0.1:8001/docs

```text
Angular form → ProcessRequest (JSON)
  → backend/service.run_pipeline()
    → filter Q10012 answered rows
    → Tier1 flags (blacklist, freq≥3/store/day, optional always-5)
    → Tier2 flags (store-month z>2 or five_pct≥90)
    → Tier3 flags (IsolationForest entity anomalies, optional)
  → ProcessResponse → Angular result cards / tables
```

## Type parity

- Python: `backend/schemas.py`
- TypeScript: `frontend/src/app/models/api.interface.ts`

Field names and nesting MUST match 1:1 (camelCase in TS for idiomatic Angular,
mapped at HTTP boundary via identical JSON keys — use PascalCase for row columns).

## Security

- No PII in logs or responses beyond what the client submits.
- Do not commit `.env` or raw survey exports.
