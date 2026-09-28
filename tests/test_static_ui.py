"""Tests for optional SPA static mount (Docker monolith)."""

from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.static_ui import mount_frontend, resolve_frontend_dist


def test_resolve_frontend_dist_missing_override(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setenv("FRONTEND_DIST_DIR", str(tmp_path / "nope"))
    assert resolve_frontend_dist() is None


def test_resolve_frontend_dist_override(monkeypatch, tmp_path: Path) -> None:
    dist = tmp_path / "dist"
    dist.mkdir()
    (dist / "index.html").write_text("<html/>", encoding="utf-8")
    monkeypatch.setenv("FRONTEND_DIST_DIR", str(dist))
    assert resolve_frontend_dist() == dist.resolve()


def test_mount_frontend_serves_index(tmp_path: Path) -> None:
    dist = tmp_path / "dist"
    dist.mkdir()
    (dist / "index.html").write_text("<html>ok</html>", encoding="utf-8")
    (dist / "asset.txt").write_text("a", encoding="utf-8")

    app = FastAPI()

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    assert mount_frontend(app, dist) is True
    client = TestClient(app)

    assert client.get("/health").json() == {"status": "ok"}
    assert client.get("/").text == "<html>ok</html>"
    assert client.get("/asset.txt").text == "a"
    assert client.get("/planner").text == "<html>ok</html>"
