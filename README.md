# Fraud Detection — Data Quality / Sanitization

Batch data-quality pipeline for Q10012 survey responses (5% KPI). Pure rules in `src/fraud_guard/`, FastAPI backend, React what-if demo UI.

## Layout

```text
backend/             FastAPI PoC API (port 8001)
web/                 React 19 + Vite UI (port 5173)
src/fraud_guard/     Pure fraud filter logic (Tier 1/2/3)
notebooks/           EDA → promote rules into fraud_guard
scripts/             One-off read-only DB helpers
tests/               pytest (no live DB in CI)
db/                  SQLAlchemy config / engine (future SQL Server reads)
api/                 Legacy/alternate FastAPI entry (port 8000)
```

Angular PoC is preserved on git tag `poc/angular-concept` (`frontend/`).

## Environment

1. Copy the template: `copy .env.example .env` (PowerShell / cmd from repo root).
2. Edit **`.env` only locally** — set `DB_SERVER`, `DB_DATABASE`, and `DATABASE_URL` for your SQL Server when using SQL features.
3. **Read-only:** this project uses `SELECT` only; do not write to the source database.
4. **Never commit `.env`** — it is gitignored; only `.env.example` with placeholders belongs in the repo.

For the React UI, set `API_CORS_ORIGINS=http://localhost:5173` (default in `.env.example`).

## Quick start — React UI + backend (PoC demo)

```powershell
# Terminal 1 — backend (repo root)
uv sync --extra dev --system-certs
uv run uvicorn backend.main:app --reload --host 127.0.0.1 --port 8001

# Terminal 2 — frontend
cd web
npm install
npm run dev
```

- UI: http://localhost:5173
- API health: http://127.0.0.1:8001/health
- API docs: http://127.0.0.1:8001/docs

```powershell
# Backend tests
uv run pytest tests/ -v

# Frontend unit tests
cd web
npm run test:run

# E2E (starts backend + Vite automatically)
npm run test:e2e
```

CI runs the same checks on push/PR via `.github/workflows/ci.yml` (pytest, web lint/unit/build, Playwright e2e). No live SQL Server in CI.

## Quick start — legacy API (port 8000)

```powershell
copy .env.example .env
uv sync --extra dev --system-certs
uv run uvicorn api.main:app --reload --host 127.0.0.1 --port 8000
```

- Health: http://127.0.0.1:8000/api/v1/health
- Docs: http://127.0.0.1:8000/docs

Notebooks (from repo root):

```powershell
uv run jupyter notebook notebooks/
```

## Docker (LAN monolith — UI + API)

Same pattern as store-score-allocation: **one container**, one port. FastAPI serves
`/api/v1/*` and the built React SPA. Data default: **SQLite snapshot** (no Windows
SQL Trusted Connection).

Prerequisites:

1. Docker Desktop running.
2. Local snapshot file (gitignored): `data/q10012_snapshot.sqlite`  
   Refresh when you have DB access: `uv run python scripts/refresh_q10012_snapshot.py`
3. Optional: `copy .env.docker.example .env.docker`

```powershell
copy .env.docker.example .env.docker
docker compose build
docker compose up -d
```

Or without compose:

```powershell
docker build -t fraud-dq-sanitization:local .
docker rm -f fraud-dq 2>$null
docker run -d --name fraud-dq -p 8000:8000 --env-file .env.docker `
  -v "${PWD}/data/q10012_snapshot.sqlite:/app/data/q10012_snapshot.sqlite:ro" `
  fraud-dq-sanitization:local
```

- UI: http://localhost:8000
- API docs: http://localhost:8000/docs
- Health: http://localhost:8000/health
- Logs: `docker compose logs -f app` (or `docker logs -f fraud-dq`)
- Stop: `docker compose down` (or `docker rm -f fraud-dq`)

In the UI use **Data source: db** (reads the mounted snapshot) or synthetic
**small / medium / stress**. Rebuild the image after code changes (no hot-reload).

Synthetic presets work even if the snapshot file is missing; **db** requires the volume.

## Stack (React v2)

| Layer    | Technology |
|----------|------------|
| Backend  | FastAPI + Pydantic v2 + pandas (`backend/`) |
| Frontend | React 19, Vite, MUI, TanStack Query/Table, Zustand, Plotly (`web/`) |
| Logic    | `src/fraud_guard/tier{1,2,3}.py` |

See `web/README.md` and `backend/ARCHITECTURE.md` for API contract and UI structure.
