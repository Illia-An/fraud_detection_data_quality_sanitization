# Fraud Detection — Data Quality / Sanitization

Baseline: FastAPI + SQL Server (Trusted Connection) + guard layer stubs.
Angular UI after the prepared source table is chosen.

## Layout

```text
api/                 FastAPI (health now; read endpoints later)
db/                  SQLAlchemy config / engine
src/fraud_guard/     Pure fraud filter logic (no UI coupling)
notebooks/           EDA → then promote rules into fraud_guard
scripts/             One-off read-only DB helpers
tests/               pytest (no live DB in CI)
frontend/            Angular (pending source choice)

```
## Environment

1. Copy the template: `copy .env.example .env` (PowerShell / cmd from repo root).
2. Edit **`.env` only locally** — set `DB_SERVER`, `DB_DATABASE`, and `DATABASE_URL` for your SQL Server.
3. **Read-only:** this project uses `SELECT` only; do not write to the source database.
4. **Never commit `.env`** — it is gitignored; only `.env.example` with placeholders belongs in the repo.

Example local values (not for git): internal server host, experiment database name, Trusted Connection.


## Quick start (backend)

```bash
copy .env.example .env
uv sync --extra dev --system-certs
uv run uvicorn api.main:app --reload --host 127.0.0.1 --port 8000
```

- Health: http://127.0.0.1:8000/api/v1/health
- Docs: http://127.0.0.1:8000/docs

```bash
uv run pytest tests/ -v
```

Notebooks (from repo root):

```bash
uv run jupyter notebook notebooks/
```

## Docker (API)

Linux containers cannot use Windows **Trusted Connection**. For Docker, use SQL auth
(see `.env.docker.example`) and point `SERVER` to a host reachable from the container
(often `host.docker.internal` on Docker Desktop).

```bash
copy .env.docker.example .env
# edit DATABASE_URL / DB_* for SQL auth

docker compose build
docker compose up -d
```

- Health: http://127.0.0.1:8000/api/v1/health
- Logs: `docker compose logs -f api`
- Stop: `docker compose down`

Build image only:

```bash
docker build -t fraud-dq-sanitization-api:latest .
```
