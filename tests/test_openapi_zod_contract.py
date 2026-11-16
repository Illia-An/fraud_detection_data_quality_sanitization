"""Wave 10 / C-01 — OpenAPI critical keys stay aligned with FE Zod mirrors."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
CONTRACT = ROOT / "contracts" / "critical-response-keys.json"


@pytest.fixture()
def openapi_spec(monkeypatch: pytest.MonkeyPatch) -> dict:
    monkeypatch.setenv("ENABLE_DOCS", "1")
    from backend.main import create_app
    from backend.settings import clear_app_settings_cache

    clear_app_settings_cache()
    app = create_app()
    return app.openapi()


def test_critical_contract_file_loads() -> None:
    data = json.loads(CONTRACT.read_text(encoding="utf-8"))
    assert isinstance(data["checks"], list)
    assert len(data["checks"]) >= 4


def test_openapi_paths_and_critical_keys(openapi_spec: dict) -> None:
    checks = json.loads(CONTRACT.read_text(encoding="utf-8"))["checks"]
    paths = openapi_spec["paths"]
    schemas = openapi_spec["components"]["schemas"]

    for check in checks:
        path = check["path"]
        method = check["method"].lower()
        schema_name = check["schema"]
        critical = check["critical_keys"]

        assert path in paths, f"OpenAPI missing path {path}"
        assert method in paths[path], f"OpenAPI missing {method.upper()} {path}"

        assert schema_name in schemas, f"OpenAPI missing schema {schema_name}"
        props = schemas[schema_name].get("properties") or {}
        missing = [key for key in critical if key not in props]
        assert missing == [], f"{schema_name} missing properties: {missing}"

        # Response $ref (when present) must point at the expected schema.
        responses = paths[path][method].get("responses") or {}
        ok = responses.get("200") or responses.get("201")
        if ok and "content" in ok:
            ref = (
                ok["content"]
                .get("application/json", {})
                .get("schema", {})
                .get("$ref", "")
            )
            if ref:
                assert ref.endswith(f"/{schema_name}"), (
                    f"{method.upper()} {path} 200 $ref={ref!r}, expected {schema_name}"
                )
