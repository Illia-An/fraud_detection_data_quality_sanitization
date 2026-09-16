# Branching strategy

**Model:** trunk (`main`) + short-lived feature branches + release tags.

| Ref | Role |
|-----|------|
| `main` | Trunk — FastAPI + React (`web/`) + research `src/fraud_guard` |
| `feat/*` / `experiment/*` | Short-lived topic branches → PR into `main` → delete |
| `v*.*.*` tags | Release snapshots on `main` |

Do not develop long-lived feature trunks. Open a branch from current `main`, merge via PR, delete the branch.

## Tags

| Tag | Points to |
|-----|-----------|
| `v1.1.0-snapshot-fastpath` | Q10012 SQLite daily snapshot + Query B phase 2 on snapshot (`SANITIZATION_SOURCE`) |
| `v1.0.0` | React UI v2 on FastAPI (synthetic presets, Dashboard shell, docs route) |
| `v0.1.1` | Research baseline hygiene (`.env.example` placeholders) |
| `v0.1.0` | Initial research baseline |
| `poc/angular-concept` | Full Angular PoC snapshot (backend + `frontend/`, ports 8001/4201) |

## Workflow

```powershell
git checkout main
git pull origin main
git checkout -b feat/<topic>
# ... work, push, PR into main, merge, delete branch ...
git checkout main
git pull origin main
git branch -d feat/<topic>
```

## Restore Angular PoC (read-only inspection)

```powershell
git checkout poc/angular-concept
# detached HEAD — to keep working, create a branch:
# git checkout -b my-poc-inspection
```

## Copy a file from frozen PoC

```powershell
git show poc/angular-concept:frontend/src/app/services/api.service.ts
```

## Backend (shared)

- Entry point: `backend/main.py` (port **8001**)
- Logic: `src/fraud_guard/tier{1,2,3}.py` — do not duplicate rules in UI
- API contract: `backend/schemas.py` / `src/schemas/pipeline.py`
- Fast path: `SANITIZATION_SOURCE=snapshot` + `scripts/refresh_q10012_snapshot.py`

## CORS (dev)

| UI stack | Dev URL | `API_CORS_ORIGINS` |
|----------|---------|-------------------|
| Angular PoC (tag) | http://localhost:4201 | `http://localhost:4201` |
| React | http://localhost:5173 | `http://localhost:5173` |

## React — run locally

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
