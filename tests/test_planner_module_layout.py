"""Module layout: old import paths resolve to the same objects as the new modules."""

from __future__ import annotations

import ast
from pathlib import Path

import pytest
from planner import allocate, five_percent, plan_types, schedule, tts

PLANNER_DIR = Path(allocate.__file__).resolve().parent


def _imported_modules(node: ast.AST) -> set[str]:
    """Absolute module names imported anywhere under ``node``.

    Covers ``import x``, ``from x import y`` (also ``from planner import y``,
    reported as ``planner.y``) and relative forms (``from . import y``).
    """
    found: set[str] = set()
    for child in ast.walk(node):
        if isinstance(child, ast.Import):
            found.update(alias.name for alias in child.names)
        elif isinstance(child, ast.ImportFrom):
            if child.level:
                # Modules checked here live directly in the ``planner`` package.
                base = ["planner", *([child.module] if child.module else [])]
            else:
                base = [child.module or ""]
            module = ".".join(base)
            found.add(module)
            found.update(f"{module}.{alias.name}" for alias in child.names)
    return found


def _parse(module_name: str) -> ast.Module:
    path = PLANNER_DIR / f"{module_name}.py"
    return ast.parse(path.read_text(encoding="utf-8"), filename=str(path))


def _function_body_imports(tree: ast.Module) -> set[str]:
    found: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef | ast.AsyncFunctionDef):
            found |= _imported_modules(node)
    return found


@pytest.mark.parametrize("module_name", ["allocate", "plan_types", "schedule"])
def test_core_and_leaves_do_not_import_callers(module_name: str) -> None:
    imported = _imported_modules(_parse(module_name))
    assert "planner.five_percent" not in imported
    assert "planner.tts" not in imported


@pytest.mark.parametrize("module_name", ["plan_types", "schedule"])
def test_leaf_modules_do_not_import_allocate(module_name: str) -> None:
    assert "planner.allocate" not in _imported_modules(_parse(module_name))


@pytest.mark.parametrize("module_name", ["five_percent", "tts"])
def test_callers_import_allocate_at_top_level_only(module_name: str) -> None:
    tree = _parse(module_name)
    assert "planner.allocate" in _imported_modules(tree)
    assert "planner.allocate" not in _function_body_imports(tree)


def test_five_percent_reexports_plan_types() -> None:
    assert five_percent.MonthScore is plan_types.MonthScore
    assert five_percent.StoreProjection is plan_types.StoreProjection


def test_tts_reexports_plan_types() -> None:
    assert tts.MonthScore is plan_types.MonthScore
    assert tts.StoreProjection is plan_types.StoreProjection


def test_five_percent_reexports_schedule_helpers() -> None:
    assert five_percent.trajectory_weights is schedule.trajectory_weights
    assert five_percent.add_calendar_months is schedule.add_calendar_months


def test_allocate_direction_is_plan_types_direction() -> None:
    assert allocate.Direction is plan_types.Direction


def test_five_percent_all_lists_old_public_names() -> None:
    expected = {
        "FivePercentPlanResult",
        "MonthScore",
        "StoreProjection",
        "add_calendar_months",
        "plan_five_percent",
        "trajectory_weights",
    }
    assert expected <= set(five_percent.__all__)
    for name in expected:
        assert hasattr(five_percent, name)
