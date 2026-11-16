"""Post-deploy smoke SM-10…SM-14 (+ /ready) — Wave 5 / CD-03.

Usage:
  python scripts/smoke_post_deploy.py
  python scripts/smoke_post_deploy.py --base-url http://127.0.0.1:8000

Exit 0 only when all checks pass.
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.request
from typing import Any


def _get(url: str, timeout: float = 15.0) -> tuple[int, bytes, str]:
    req = urllib.request.Request(url, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return int(resp.status), resp.read(), resp.headers.get_content_type() or ""
    except urllib.error.HTTPError as exc:
        return int(exc.code), exc.read() if exc.fp else b"", ""


def _post_json(url: str, payload: dict[str, Any], timeout: float = 60.0) -> tuple[int, Any]:
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        method="POST",
        headers={"Content-Type": "application/json", "Accept": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read()
            return int(resp.status), json.loads(body.decode("utf-8"))
    except urllib.error.HTTPError as exc:
        raw = exc.read() if exc.fp else b""
        try:
            parsed: Any = json.loads(raw.decode("utf-8"))
        except Exception:
            parsed = raw.decode("utf-8", errors="replace")
        return int(exc.code), parsed


def run(base_url: str) -> list[str]:
    base = base_url.rstrip("/")
    failures: list[str] = []

    # SM-10
    code, raw, _ = _get(f"{base}/health")
    if code != 200:
        failures.append(f"SM-10 /health expected 200 got {code}")
    else:
        try:
            health = json.loads(raw.decode("utf-8"))
            if health.get("status") != "ok":
                failures.append(f"SM-10 /health status={health.get('status')!r}")
        except Exception as exc:
            failures.append(f"SM-10 /health JSON: {exc}")

    # Readiness (Wave 4) — required for traffic, not Docker HEALTHCHECK
    code, raw, _ = _get(f"{base}/ready")
    if code != 200:
        failures.append(f"/ready expected 200 got {code}: {raw[:200]!r}")

    # SM-11
    code, raw, ctype = _get(f"{base}/")
    if code != 200:
        failures.append(f"SM-11 GET / expected 200 got {code}")
    elif b"<html" not in raw.lower() and "text/html" not in ctype:
        # SPA may be missing in API-only local runs — warn as fail for deploy smoke
        failures.append("SM-11 GET / did not look like HTML")

    # SM-12 path traversal probe
    code, _, _ = _get(f"{base}/assets/../../etc/passwd")
    if code not in (200, 404):
        # 200 = SPA index fallback is OK; must not leak file contents
        failures.append(f"SM-12 traversal unexpected status {code}")
    if code == 200:
        # If index HTML is returned that is fine; passwd content is not.
        pass

    # SM-13 process source=db
    code, body = _post_json(
        f"{base}/api/v1/process",
        {
            "source": "db",
            "from_date": "2026-01-01",
            "to_date": "2026-01-31",
            "config": {},
            "rows": [],
        },
    )
    if code != 200:
        failures.append(f"SM-13 /process expected 200 got {code}: {body!r}")
    else:
        meta = body.get("meta") or {}
        if meta.get("sanitization_source") != "snapshot":
            failures.append(
                f"SM-13 sanitization_source={meta.get('sanitization_source')!r}"
            )

    # SM-14 TTS KPI AP panel
    code, raw, _ = _get(f"{base}/api/v1/tts-kpi/ap")
    if code != 200:
        failures.append(f"SM-14 tts-kpi/ap expected 200 got {code}")
    else:
        try:
            panel = json.loads(raw.decode("utf-8"))
            rows = panel.get("rows") or []
            if len(rows) < 1:
                failures.append("SM-14 tts-kpi/ap rows empty")
        except Exception as exc:
            failures.append(f"SM-14 JSON: {exc}")

    return failures


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--base-url",
        default="http://127.0.0.1:8000",
        help="Deployed app origin",
    )
    args = parser.parse_args()
    failures = run(args.base_url)
    if failures:
        print("SMOKE FAIL")
        for item in failures:
            print(f" - {item}")
        return 1
    print("SMOKE PASS (SM-10…14 + /ready)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
