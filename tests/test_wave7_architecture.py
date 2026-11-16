"""Wave 7 architecture cleanup — routers, data_access, version, lazy tier3."""

from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

from backend.main import create_app
from backend.version import app_version, package_version


def test_package_version_matches_pyproject() -> None:
    text = Path("pyproject.toml").read_text(encoding="utf-8")
    assert f'version = "{package_version()}"' in text


def test_app_version_env_override(monkeypatch) -> None:
    monkeypatch.setenv("APP_VERSION", "wave7-test")
    assert app_version() == "wave7-test"


def test_health_version_not_hardcoded_default() -> None:
    client = TestClient(create_app())
    body = client.get("/health").json()
    assert body["status"] == "ok"
    assert body["version"] == app_version()
    assert body["version"]  # non-empty


def test_openapi_process_path_preserved() -> None:
    client = TestClient(create_app())
    schema = client.get("/openapi.json").json()
    assert "/api/v1/process" in schema["paths"]
    assert "/api/v1/sample/db" in schema["paths"]
    assert "/health" in schema["paths"]
    assert "/ready" in schema["paths"]


def test_sample_db_registered_before_preset_param() -> None:
    """Route order: /sample/db must not be captured by /sample/{preset}."""
    client = TestClient(create_app())
    # Without a live DB/snapshot this may 503, but must not be 404 (unknown preset).
    res = client.get("/api/v1/sample/db")
    assert res.status_code != 404


def test_fraud_guard_init_has_no_eager_tier3_import() -> None:
    """A-10 / M-11: package ``__init__`` must not import tier3/sklearn eagerly."""
    text = Path("src/fraud_guard/__init__.py").read_text(encoding="utf-8")
    assert "from fraud_guard.tier3 import" not in text
    assert "import sklearn" not in text
    assert "__getattr__" in text


def test_fraud_guard_tier3_lazy_getattr() -> None:
    import fraud_guard as fg

    # Force attribute miss so package ``__getattr__`` runs.
    fg.__dict__.pop("Tier3Config", None)
    cfg = fg.Tier3Config
    assert cfg is not None
    assert getattr(cfg, "__name__", None) == "Tier3Config" or cfg.__name__ == "Tier3Config"


def test_data_access_public_exports() -> None:
    from backend import data_access

    assert callable(data_access.period_params)
    assert callable(data_access.engine_from_settings)
    assert callable(data_access.process_engine)
    assert callable(data_access.resolve_process_source)
    assert callable(data_access.dispose_engines)
    assert callable(data_access.get_cached_engine)


def test_run_process_inline_without_http() -> None:
    from backend.schemas import ProcessRequest, SurveyAnswerRow
    from backend.service import run_process
    from fraud_guard.synthetic import generate_preset

    rows = [SurveyAnswerRow.model_validate(r) for r in generate_preset("small")]
    outcome = run_process(ProcessRequest(source="inline", rows=rows, config={}))
    assert outcome.rows_scanned == len(rows)
    assert outcome.result.echo_config is not None
    assert "execution_time_ms" in outcome.meta_extra


def test_pyproject_has_no_stale_tts_packages() -> None:
    text = Path("pyproject.toml").read_text(encoding="utf-8")
    assert "tts_guard" not in text
    assert "tts_order_bump" not in text
