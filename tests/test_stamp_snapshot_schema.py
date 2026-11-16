"""Migration helper: stamp schema_version on pre-Wave-2 snapshots."""

from __future__ import annotations

from pathlib import Path

from sqlalchemy import create_engine, text

from backend.ci_fixtures import build_q10012
from backend.snapshot import SCHEMA_VERSION, read_meta
from backend.snapshot_migrate import stamp_schema_version


def test_stamp_adds_schema_version(tmp_path: Path) -> None:
    path = tmp_path / "old.sqlite"
    build_q10012(path)
    engine = create_engine(f"sqlite:///{path.as_posix()}")
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM snapshot_meta WHERE key = 'schema_version'"))
    engine.dispose()

    assert read_meta(create_engine(f"sqlite:///{path.as_posix()}")).schema_version is None
    assert stamp_schema_version(path) == 0
    assert (
        read_meta(create_engine(f"sqlite:///{path.as_posix()}")).schema_version
        == SCHEMA_VERSION
    )


def test_stamp_is_idempotent(tmp_path: Path) -> None:
    path = tmp_path / "ok.sqlite"
    build_q10012(path)
    assert stamp_schema_version(path) == 0
    assert stamp_schema_version(path) == 0
