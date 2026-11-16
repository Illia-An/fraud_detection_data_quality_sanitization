"""Optional React SPA serving for monolith / Docker LAN deploys."""

from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse


def resolve_frontend_dist() -> Path | None:
    """Return Vite dist dir with index.html, or None if UI is not bundled."""
    override = os.environ.get("FRONTEND_DIST_DIR", "").strip()
    if override:
        path = Path(override)
        if (path / "index.html").is_file():
            return path.resolve()
        return None

    root = Path(__file__).resolve().parents[1]
    for path in (root / "web" / "dist", root / "frontend" / "dist"):
        if (path / "index.html").is_file():
            return path.resolve()
    return None


def safe_dist_file(root: Path, full_path: str) -> Path | None:
    """Resolve a path under ``root`` or return None (Wave 3 / S-03).

    Rejects absolute-style segments, ``..`` escapes, and anything outside dist.
    """
    if not full_path:
        return None
    # Hard-reject absolute / drive / UNC style inputs before join.
    if full_path.startswith(("/", "\\")) or (len(full_path) >= 2 and full_path[1] == ":"):
        return None
    parts = Path(full_path).parts
    if any(p == ".." or p == "" for p in parts):
        # Empty segments from leading separators already rejected; still block `..`.
        if ".." in parts:
            return None

    root_resolved = root.resolve()
    candidate = (root_resolved / full_path).resolve()
    try:
        candidate.relative_to(root_resolved)
    except ValueError:
        return None
    if candidate.is_file():
        return candidate
    return None


def mount_frontend(app: FastAPI, dist: Path | None = None) -> bool:
    """Serve built SPA files and fallback to index.html. Returns True if mounted.

    Register after API routes so ``/api/v1``, ``/health``, ``/docs`` win.
    """
    root = dist if dist is not None else resolve_frontend_dist()
    if root is None:
        return False
    root = root.resolve()

    @app.get("/{full_path:path}")
    async def spa_fallback(full_path: str) -> FileResponse:
        if full_path:
            candidate = safe_dist_file(root, full_path)
            if candidate is not None:
                return FileResponse(candidate)
        return FileResponse(root / "index.html")

    return True
