"""Module layout: shims, deprecation, and first-party import guard."""

from __future__ import annotations

import ast
import importlib
import sys
from pathlib import Path

import pytest
from fraud_guard import (
    pipeline_row_rules,
    pipeline_steps,
    pipeline_store_month,
    research_isolation_forest,
)

ROOT = Path(__file__).resolve().parents[1]
FRAUD_GUARD_DIR = ROOT / "src" / "fraud_guard"
BACKEND_DIR = ROOT / "backend"
SHIM_FILES = frozenset({"tier1.py", "tier2.py", "tier3.py"})
FORBIDDEN = frozenset(
    {"fraud_guard.tier1", "fraud_guard.tier2", "fraud_guard.tier3"}
)
_SHIM_TO_REPLACEMENT = {
    "fraud_guard.tier1": "fraud_guard.pipeline_row_rules",
    "fraud_guard.tier2": "fraud_guard.pipeline_store_month",
    "fraud_guard.tier3": "fraud_guard.research_isolation_forest",
}


def _package_parts_for(path: Path) -> list[str]:
    rel = path.resolve().relative_to(ROOT)
    if rel.parts[0] == "src":
        return list(rel.parts[1:-1])
    return list(rel.parts[:-1])


def _imported_modules(node: ast.AST, *, package_parts: list[str]) -> set[str]:
    found: set[str] = set()
    for child in ast.walk(node):
        if isinstance(child, ast.Import):
            found.update(alias.name for alias in child.names)
        elif isinstance(child, ast.ImportFrom):
            if child.level:
                if child.level > len(package_parts):
                    continue
                base = package_parts[: len(package_parts) - child.level + 1]
                if child.module:
                    base = [*base, *child.module.split(".")]
                module = ".".join(base)
            else:
                module = child.module or ""
            found.add(module)
            found.update(f"{module}.{alias.name}" for alias in child.names)
    return found


def _forbidden_hits(imported: set[str]) -> set[str]:
    hits: set[str] = set()
    for name in imported:
        if name in FORBIDDEN:
            hits.add(name)
            continue
        for forbidden in FORBIDDEN:
            if name.startswith(forbidden + "."):
                hits.add(forbidden)
    return hits


def _iter_guard_paths() -> list[Path]:
    paths = sorted(BACKEND_DIR.rglob("*.py"))
    paths.extend(
        sorted(
            p
            for p in FRAUD_GUARD_DIR.glob("*.py")
            if p.name not in SHIM_FILES
        )
    )
    return paths


@pytest.mark.filterwarnings("ignore:fraud_guard\\.tier[123] is deprecated:DeprecationWarning")
def test_tier1_shim_matches_pipeline_row_rules() -> None:
    from fraud_guard import tier1

    assert tier1.Tier1Config is pipeline_row_rules.Tier1Config
    assert tier1.apply_tier1 is pipeline_row_rules.apply_tier1
    assert tier1.apply_blacklist_tier is pipeline_row_rules.apply_blacklist_tier
    assert tier1.FLAG_COL is pipeline_row_rules.FLAG_COL


@pytest.mark.filterwarnings("ignore:fraud_guard\\.tier[123] is deprecated:DeprecationWarning")
def test_tier2_shim_matches_pipeline_store_month() -> None:
    from fraud_guard import tier2

    assert tier2.Tier2Config is pipeline_store_month.Tier2Config
    assert tier2.apply_tier2 is pipeline_store_month.apply_tier2
    assert tier2.FLAG_COL is pipeline_store_month.FLAG_COL


@pytest.mark.filterwarnings("ignore:fraud_guard\\.tier[123] is deprecated:DeprecationWarning")
def test_tier3_shim_matches_research_isolation_forest() -> None:
    from fraud_guard import tier3

    assert tier3.Tier3Config is research_isolation_forest.Tier3Config
    assert tier3.apply_tier3 is research_isolation_forest.apply_tier3
    assert tier3.FLAG_COL is research_isolation_forest.FLAG_COL


def test_pipeline_steps_resolve_to_row_and_store_month_callables() -> None:
    assert (
        pipeline_steps.apply_pipeline_tier1
        is pipeline_row_rules.apply_blacklist_tier
    )
    assert pipeline_steps.apply_pipeline_tier2 is pipeline_row_rules.apply_freq_tier
    assert (
        pipeline_steps.apply_pipeline_tier3
        is pipeline_row_rules.apply_always_topbox_tier
    )
    assert (
        pipeline_steps.apply_pipeline_tier4 is pipeline_store_month.apply_tier2
    )


@pytest.mark.filterwarnings("ignore:fraud_guard\\.tier[123] is deprecated:DeprecationWarning")
def test_shim_modules_list_expected_public_names() -> None:
    from fraud_guard import tier1, tier2, tier3

    assert "Tier1Config" in tier1.__all__
    assert "apply_tier2" in tier2.__all__
    assert "apply_tier3" in tier3.__all__


@pytest.mark.filterwarnings("ignore:fraud_guard\\.tier[123] is deprecated:DeprecationWarning")
def test_old_tier_import_paths_still_work() -> None:
    """Shims remain for compatibility; intentional old-path smoke check."""
    from fraud_guard.tier1 import apply_blacklist_tier
    from fraud_guard.tier2 import apply_tier2
    from fraud_guard.tier3 import apply_tier3

    assert apply_blacklist_tier is pipeline_row_rules.apply_blacklist_tier
    assert apply_tier2 is pipeline_store_month.apply_tier2
    assert apply_tier3 is research_isolation_forest.apply_tier3


@pytest.mark.parametrize(
    ("module_name", "replacement"),
    sorted(_SHIM_TO_REPLACEMENT.items()),
)
def test_shim_import_emits_deprecation(module_name: str, replacement: str) -> None:
    sys.modules.pop(module_name, None)
    with pytest.warns(DeprecationWarning, match=replacement.rsplit(".", maxsplit=1)[-1]):
        importlib.import_module(module_name)


@pytest.mark.parametrize("path", _iter_guard_paths(), ids=lambda p: str(p.relative_to(ROOT)))
def test_first_party_does_not_import_deprecated_tier_modules(path: Path) -> None:
    tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
    imported = _imported_modules(tree, package_parts=_package_parts_for(path))
    hits = _forbidden_hits(imported)
    assert not hits, f"{path.relative_to(ROOT)} imports deprecated {sorted(hits)}"
