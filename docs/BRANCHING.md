# Branching strategy

| Branch | Status | UI | Notes |
|--------|--------|-----|-------|
| `main` | Stable research baseline | None | `src/fraud_guard`, notebooks, reports |
| `feat/poc-aggregate-pipeline` | **Frozen** | Angular (`frontend/`) | PoC reference; do not develop here |
| `feat/react-ui-v2` | **Active** | React (`web/`) | New UI on same FastAPI backend |

## Tags

| Tag | Points to |
|-----|-----------|
| `v1.0.0` | React UI v2 on FastAPI (synthetic presets, Dashboard shell, docs route) |
| `v0.1.1` | Research baseline hygiene (`.env.example` placeholders) |
| `v0.1.0` | Initial research baseline |
| `poc/angular-concept` | Full Angular PoC snapshot (backend + `frontend/`, ports 8001/4201) |

## Restore Angular PoC (read-only inspection)

```powershell
git checkout poc/angular-concept
# detached HEAD — to keep working, create a branch:
# git checkout -b my-poc-inspection
```

## Continue React development

```powershell
git checkout feat/react-ui-v2
```

## Copy a file from frozen PoC

```powershell
git show poc/angular-concept:frontend/src/app/services/api.service.ts
```

## Backend (shared)

- Entry point: `backend/main.py` (port **8001**)
- Logic: `src/fraud_guard/tier{1,2,3}.py` — do not duplicate rules in UI
- API contract: `backend/schemas.py`

## CORS (dev)

| UI stack | Dev URL | `API_CORS_ORIGINS` |
|----------|---------|-------------------|
| Angular PoC (tag) | http://localhost:4201 | `http://localhost:4201` |
| React v2 | http://localhost:5173 | `http://localhost:5173` |

## React v2 — run locally

```powershell
# Backend (repo root)
uv run uvicorn backend.main:app --reload --host 127.0.0.1 --port 8001

# Frontend
cd web
npm install
npm run dev
```

Quality checks:

```powershell
cd web
npm run lint
npm run test -- --run
```

See `web/README.md` for full script list.
