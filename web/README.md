# Fraud Guard — React UI v2

What-if demo for survey sanitization (Tier 1/2/3) against the FastAPI backend.

## Prerequisites

- Node.js 20+
- Backend running on port **8001** (see repo root)

## Quick start

```powershell
# Terminal 1 — backend (repo root)
uv run uvicorn backend.main:app --reload --host 127.0.0.1 --port 8001

# Terminal 2 — frontend
cd web
npm install
npm run dev
```

- UI: http://localhost:5173
- API: http://127.0.0.1:8001/health

Set `API_CORS_ORIGINS=http://localhost:5173` in repo root `.env` (see `.env.example`).

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Vite dev server (port 5173) |
| `npm run build` | Typecheck + production build |
| `npm run lint` | ESLint (flat config) |
| `npm run format` | Prettier write |
| `npm run test` | Vitest (watch) |
| `npm run test -- --run` | Vitest single run |
| `npm run test:e2e` | Playwright (starts dev server) |

## Stack

React 19, TypeScript, Vite, MUI (dashboard template shell), React Router, TanStack Query/Table, Zustand, Plotly.

Layout is based on the [MUI dashboard template](https://mui.com/material-ui/getting-started/templates/dashboard/) — sidebar, header, light/dark toggle. Business components live in `src/components/`; shell in `src/dashboard/` and `src/shared-theme/`.

## E2E

Playwright starts **both** the FastAPI backend (port 8001) and Vite dev server via `webServer` in `playwright.config.ts`.

Scenarios in `tests/e2e/sanitization.spec.ts`:

- API health chip shows `ok`
- Small preset → Run pipeline → KPI cards + pipeline steps table
- Tier 2 off → re-run → network delta changes

```powershell
npx playwright install chromium
# Or use system Edge (default in playwright.config.ts: channel msedge)
npm run test:e2e
```

Ensure `uv` is on PATH (backend is started with `uv run uvicorn …` from repo root).
