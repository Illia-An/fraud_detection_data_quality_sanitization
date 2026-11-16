"""Single-source app version (Wave 7 / M-12, A005).

Resolution order:
1. ``APP_VERSION`` env (deploy / compose injection)
2. Installed distribution metadata (``pyproject.toml`` ``[project].name``)
3. ``version = "..."`` line in repo ``pyproject.toml`` (editable / source checkout)
"""

from __future__ import annotations

import os
import re
from functools import lru_cache
from importlib.metadata import PackageNotFoundError, version as pkg_version
from pathlib import Path

_DIST_NAME = "fraud-detection-data-quality-sanitization"
_PROJECT_ROOT = Path(__file__).resolve().parents[1]
_VERSION_RE = re.compile(r'(?m)^version\s*=\s*"([^"]+)"')


def _version_from_pyproject() -> str | None:
    path = _PROJECT_ROOT / "pyproject.toml"
    if not path.is_file():
        return None
    match = _VERSION_RE.search(path.read_text(encoding="utf-8"))
    return match.group(1) if match else None


@lru_cache
def package_version() -> str:
    """Version from package metadata or ``pyproject.toml`` (no env override)."""
    try:
        return pkg_version(_DIST_NAME)
    except PackageNotFoundError:
        pass
    from_file = _version_from_pyproject()
    if from_file:
        return from_file
    raise RuntimeError(
        f"Cannot resolve package version for {_DIST_NAME!r}; "
        "set APP_VERSION or ensure pyproject.toml is readable"
    )


def app_version() -> str:
    """Runtime identity: env wins, else package / pyproject version."""
    raw = os.environ.get("APP_VERSION", "").strip()
    if raw:
        return raw
    return package_version()
