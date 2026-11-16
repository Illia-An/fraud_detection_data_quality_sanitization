#!/usr/bin/env bash
# Rollback to previous image tag (+ optional snapshot .prev). Wave 5 / CD-02.
# Usage:
#   IMAGE_TAG=v1.2.3 ./scripts/rollback_deploy.sh
#   RESTORE_SNAPSHOT_PREV=1 IMAGE_TAG=v1.2.3 ./scripts/rollback_deploy.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

IMAGE_REPO="${IMAGE_REPO:-ghcr.io/illia-an/fraud-dq-sanitization}"
IMAGE_TAG="${IMAGE_TAG:?set IMAGE_TAG to previous tag (e.g. v1.2.3)}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
SNAPSHOT_PATH="${SNAPSHOT_PATH:-data/q10012_snapshot.sqlite}"
BASE_URL="${BASE_URL:-http://127.0.0.1:8000}"

if [[ "${RESTORE_SNAPSHOT_PREV:-0}" == "1" ]]; then
  if [[ ! -f "${SNAPSHOT_PATH}.prev" ]]; then
    echo "missing ${SNAPSHOT_PATH}.prev"
    exit 1
  fi
  cp -f "${SNAPSHOT_PATH}.prev" "$SNAPSHOT_PATH"
  echo "restored snapshot from .prev"
fi

export IMAGE_REPO IMAGE_TAG
export APP_VERSION="$IMAGE_TAG"

docker compose -f "$COMPOSE_FILE" pull app
docker compose -f "$COMPOSE_FILE" up -d app

for i in $(seq 1 30); do
  if curl -fsS "$BASE_URL/health" >/dev/null; then
    break
  fi
  sleep 1
done

python3 "$ROOT/scripts/smoke_post_deploy.py" --base-url "$BASE_URL"
echo "ROLLBACK OK → ${IMAGE_REPO}:${IMAGE_TAG}"
