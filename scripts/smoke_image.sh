#!/usr/bin/env bash
# Image smoke SM-01/02 + /ready + non-root (Wave 5 / T-07).
# Usage: IMAGE_REF=fraud-dq-sanitization:sha-abc ./scripts/smoke_image.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IMAGE_REF="${IMAGE_REF:?set IMAGE_REF to the image to smoke}"
NAME="${SMOKE_NAME:-fraud-dq-smoke}"
PORT="${SMOKE_PORT:-18000}"
FIXTURES="${FIXTURES_DIR:-$ROOT/testdata/fixtures}"

cleanup() {
  docker rm -f "$NAME" >/dev/null 2>&1 || true
}
trap cleanup EXIT

cleanup

docker run -d --name "$NAME" \
  -p "${PORT}:8000" \
  -e SANITIZATION_SOURCE=snapshot \
  -e SNAPSHOT_URL=sqlite:///data/q10012_snapshot.sqlite \
  -e TTS_KPI_SOURCE=snapshot \
  -e TTS_KPI_SNAPSHOT_URL=sqlite:///data/tts_kpi_snapshot.sqlite \
  -e SNAPSHOT_MAX_AGE_DAYS="${SNAPSHOT_MAX_AGE_DAYS:-36500}" \
  -e APP_VERSION="${APP_VERSION:-smoke}" \
  -e ENABLE_DOCS=0 \
  ${API_KEY:+-e API_KEY="$API_KEY"} \
  -v "${FIXTURES}:/app/data:ro" \
  "$IMAGE_REF"

# SM-02: non-root
uid="$(docker exec "$NAME" id -u)"
if [[ "$uid" == "0" ]]; then
  echo "FAIL: container running as root (uid=0)"
  exit 1
fi
echo "OK non-root uid=$uid"

# Wait for /health
for i in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:${PORT}/health" >/dev/null; then
    break
  fi
  sleep 1
done

curl -fsS "http://127.0.0.1:${PORT}/health" | grep -q '"status"'
echo "OK /health"

code="$(curl -s -o /tmp/ready.json -w '%{http_code}' "http://127.0.0.1:${PORT}/ready")"
if [[ "$code" != "200" ]]; then
  echo "FAIL: /ready HTTP $code"
  cat /tmp/ready.json || true
  exit 1
fi
echo "OK /ready"

python3 "$ROOT/scripts/smoke_post_deploy.py" --base-url "http://127.0.0.1:${PORT}"
echo "IMAGE SMOKE PASS"
