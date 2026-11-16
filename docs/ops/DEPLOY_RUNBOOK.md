# Deploy / rollback runbook (Wave 5)

| Field | Value |
|-------|--------|
| **Registry (PROPOSED)** | `ghcr.io/illia-an/fraud-dq-sanitization` (Wave 0 **REG**) |
| **Image tags** | `vX.Y.Z` (git tag) and `sha-<shortsha>` |
| **Host** | Wave 0 **HOST** still PENDING — fill when known |

## Production host (pull only)

Do **not** `docker compose build` on the user-facing host.

```powershell
$env:IMAGE_REPO = "ghcr.io/illia-an/fraud-dq-sanitization"
$env:IMAGE_TAG = "v1.x.y"          # or sha-...
$env:APP_VERSION = $env:IMAGE_TAG
$env:PULL_POLICY = "always"

docker compose pull app
docker compose up -d app
python scripts/smoke_post_deploy.py --base-url http://127.0.0.1:8000
```

On smoke failure → rollback immediately.

## Rollback

```powershell
.\scripts\rollback_deploy.ps1 -PreviousTag v1.x.(y-1)
# optional data rollback:
.\scripts\rollback_deploy.ps1 -PreviousTag v1.x.(y-1) -RestoreSnapshotPrev
```

Linux:

```bash
IMAGE_TAG=v1.x.(y-1) ./scripts/rollback_deploy.sh
RESTORE_SNAPSHOT_PREV=1 IMAGE_TAG=v1.x.(y-1) ./scripts/rollback_deploy.sh
```

## Local / CI

```powershell
docker compose build
# or CI-built tag:
$env:IMAGE_TAG = "local"
docker compose up -d
```

## Branch protection (G-05)

GitHub Settings → Branches → Protect `main`:

- Require PR before merge
- Require status checks: Backend, Frontend, E2E, Image (when enabled)
- No force-push; no direct commits from the deploy host

This is an **org setting**, not enforced by files in the repo.
