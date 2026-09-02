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

React 19, TypeScript, Vite, MUI, React Router, TanStack Query, Zustand, React Hook Form + Zod, TanStack Table, Plotly.

## E2E

Playwright uses `webServer` in `playwright.config.ts` to start Vite. For full flow tests (Phase 9), backend must also be on 8001.

```powershell
npx playwright install chromium
npm run test:e2e
```
