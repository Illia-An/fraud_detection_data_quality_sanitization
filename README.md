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
