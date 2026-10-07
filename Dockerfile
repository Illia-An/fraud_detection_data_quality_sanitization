# Monolith image: React (Vite static) + FastAPI/uvicorn.
# Snapshot demo (LAN) — no Windows SQL auth required:
#   docker build -t fraud-dq-sanitization:local .
#   docker run -d --name fraud-dq -p 8000:8000 --env-file .env.docker ^
#     -v "%CD%/data/q10012_snapshot.sqlite:/app/data/q10012_snapshot.sqlite:ro" ^
#     fraud-dq-sanitization:local
# Open http://localhost:8000  (UI + /api/v1 + /docs)
#
# Builder uses official python + uv binary (same pattern as store-score-allocation),
# avoiding the full ghcr.io/astral-sh/uv:python* image which often 403s on GHCR.

# ---- frontend build ----
FROM node:20-bookworm-slim AS frontend
WORKDIR /web
# node:* images often default NODE_ENV=production → npm ci skips devDeps (no tsc/vite).
ENV NODE_ENV=development
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
# Same-origin API calls inside the monolith (web/.env.docker → empty VITE_API_BASE_URL).
RUN npm run build -- --mode docker

# ---- runtime ----
FROM python:3.12-slim-bookworm AS runtime
WORKDIR /app

COPY --from=ghcr.io/astral-sh/uv:0.6.14 /uv /usr/local/bin/uv

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    PYTHONPATH=/app:/app/src \
    FRONTEND_DIST_DIR=/app/web/dist \
    SANITIZATION_SOURCE=snapshot \
    SNAPSHOT_URL=sqlite:///data/q10012_snapshot.sqlite \
    API_CORS_ORIGINS=http://localhost:8000 \
    PORT=8000

COPY pyproject.toml uv.lock README.md ./
COPY src ./src
COPY backend ./backend
COPY db ./db
RUN uv sync --frozen --no-dev

COPY --from=frontend /web/dist ./web/dist
RUN mkdir -p /app/data

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health')" || exit 1

# Use the venv baked by `uv sync` — do not `uv run` at start (avoids PyPI/SSL
# re-resolve for hatchling on corporate networks).
CMD ["/app/.venv/bin/uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
