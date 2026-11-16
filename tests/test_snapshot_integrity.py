"""Wave 2 — snapshot gates, atomic publish, schema_version (D-01…D-05, D-13)."""

from __future__ import annotations

from datetime import date
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text

from backend.db_sample import DbSampleError
from backend.main import create_app
from backend.snapshot import (
    ANSWERS_TABLE,
    SCHEMA_VERSION,
    STORE_MONTH_TABLE,
    get_snapshot_engine_at,
    init_snapshot_schema,
    read_meta,
    require_snapshot_engine,
    set_meta,
    utc_now_iso,
)
from backend.snapshot_gates import SnapshotGateError, validate_snapshot_gates
from backend.snapshot_publish import (
    publish_snapshot_atomic,
    snapshot_prev_path,
    snapshot_tmp_path,
)
from backend.snapshot_refresh import write_snapshot_from_rows


def _answer(
    *,
    pn: str,
    store: float,
    year: int,
    month: int,
    value: int = 5,
    answer_time: str = "2026-02-05 10:00:00",
) -> dict:
    return {
        "ParticipateNumber": pn,
        "Question_ID": 10012,
        "Answer_Value": value,
        "BlackList": None,
        "UserContact": f"{pn}@x",
        "PhoneFromLog": None,
        "ext_user_id": None,
        "PrintStore": store,
        "AnswerTime": answer_time,
        "Year": year,
        "Month": month,
    }


def test_validate_snapshot_gates_ok(tmp_path: Path) -> None:
    path = tmp_path / "ok.sqlite"
    write_snapshot_from_rows(
        out_path=path,
        rows=[
            _answer(pn="1", store=10, year=2026, month=2),
            _answer(pn="2", store=10, year=2026, month=2, value=4),
        ],
        from_date=date(2026, 2, 1),
    )
    engine = get_snapshot_engine_at(path)
    try:
        result = validate_snapshot_gates(engine, previous_row_count=2, min_rows=1)
        assert result.row_count == 2
        assert result.store_month_sum == 2
        assert result.answers_keyed_count == 2
        assert result.duplicate_participate_count == 0
    finally:
        engine.dispose()


def test_validate_snapshot_gates_rejects_empty(tmp_path: Path) -> None:
    path = tmp_path / "empty.sqlite"
    write_snapshot_from_rows(out_path=path, rows=[], from_date=date(2026, 1, 1))
    engine = get_snapshot_engine_at(path)
    try:
        with pytest.raises(SnapshotGateError, match="row floor"):
            validate_snapshot_gates(engine, min_rows=1)
    finally:
        engine.dispose()


def test_validate_snapshot_gates_rejects_shrinkage(tmp_path: Path) -> None:
    path = tmp_path / "small.sqlite"
    write_snapshot_from_rows(
        out_path=path,
        rows=[_answer(pn="1", store=10, year=2026, month=1)],
        from_date=date(2026, 1, 1),
    )
    engine = get_snapshot_engine_at(path)
    try:
        with pytest.raises(SnapshotGateError, match="vs-previous"):
            validate_snapshot_gates(
                engine, previous_row_count=100, min_rows=1, min_ratio=0.5
            )
    finally:
        engine.dispose()


def test_validate_snapshot_gates_rejects_store_month_parity(tmp_path: Path) -> None:
    path = tmp_path / "bad_parity.sqlite"
    write_snapshot_from_rows(
        out_path=path,
        rows=[_answer(pn="1", store=10, year=2026, month=1)],
        from_date=date(2026, 1, 1),
    )
    engine = get_snapshot_engine_at(path)
    try:
        with engine.begin() as conn:
            conn.execute(
                text(
                    f"""
UPDATE {STORE_MONTH_TABLE}
SET total_count = 99
WHERE PrintStore = 10 AND Year = 2026 AND Month = 1
"""
                )
            )
        with pytest.raises(SnapshotGateError, match="parity"):
            validate_snapshot_gates(engine, min_rows=1)
    finally:
        engine.dispose()


def test_validate_snapshot_gates_rejects_dupes_when_capped(tmp_path: Path) -> None:
    path = tmp_path / "dupes.sqlite"
    write_snapshot_from_rows(
        out_path=path,
        rows=[
            _answer(pn="same", store=10, year=2026, month=1),
            _answer(
                pn="same",
                store=10,
                year=2026,
                month=1,
                value=4,
                answer_time="2026-01-06 11:00:00",
            ),
        ],
        from_date=date(2026, 1, 1),
    )
    engine = get_snapshot_engine_at(path)
    try:
        # Metric-only by default.
        result = validate_snapshot_gates(engine, min_rows=1)
        assert result.duplicate_participate_count == 1
        with pytest.raises(SnapshotGateError, match="duplicate"):
            validate_snapshot_gates(engine, min_rows=1, max_dup_participate=0)
    finally:
        engine.dispose()


def test_publish_snapshot_atomic_keeps_prev(tmp_path: Path) -> None:
    dest = tmp_path / "q10012_snapshot.sqlite"
    first = tmp_path / "first.sqlite"
    second_tmp = snapshot_tmp_path(dest)

    write_snapshot_from_rows(
        out_path=first,
        rows=[_answer(pn="1", store=10, year=2026, month=1)],
        from_date=date(2026, 1, 1),
        loaded_at="2026-01-01T00:00:00+00:00",
    )
    # Seed dest as the "live" file.
    first.replace(dest)

    write_snapshot_from_rows(
        out_path=second_tmp,
        rows=[
            _answer(pn="1", store=10, year=2026, month=1),
            _answer(pn="2", store=10, year=2026, month=1, value=4),
        ],
        from_date=date(2026, 1, 1),
        loaded_at="2026-02-01T00:00:00+00:00",
    )

    publish_snapshot_atomic(second_tmp, dest, keep_prev=1)

    assert dest.is_file()
    assert not second_tmp.exists()
    prev = snapshot_prev_path(dest, 0)
    assert prev.is_file()
    dest_eng = get_snapshot_engine_at(dest)
    prev_eng = get_snapshot_engine_at(prev)
    try:
        assert read_meta(dest_eng).row_count == 2
        assert read_meta(prev_eng).row_count == 1
    finally:
        dest_eng.dispose()
        prev_eng.dispose()


def test_publish_does_not_replace_when_tmp_missing(tmp_path: Path) -> None:
    dest = tmp_path / "live.sqlite"
    dest.write_bytes(b"keep-me")
    with pytest.raises(FileNotFoundError):
        publish_snapshot_atomic(tmp_path / "missing.sqlite.tmp", dest, keep_prev=1)
    assert dest.read_bytes() == b"keep-me"


def test_require_snapshot_engine_schema_mismatch(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    path = tmp_path / "old.sqlite"
    write_snapshot_from_rows(
        out_path=path,
        rows=[_answer(pn="1", store=10, year=2026, month=1)],
        from_date=date(2026, 1, 1),
    )
    engine = get_snapshot_engine_at(path)
    try:
        set_meta(engine, {"schema_version": "0"})
    finally:
        engine.dispose()

    monkeypatch.setenv("SANITIZATION_SOURCE", "snapshot")
    monkeypatch.setenv("SNAPSHOT_URL", f"sqlite:///{path.as_posix()}")
    with pytest.raises(DbSampleError, match="schema_version"):
        require_snapshot_engine()


def test_process_returns_503_on_schema_mismatch(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    path = tmp_path / "mismatch.sqlite"
    write_snapshot_from_rows(
        out_path=path,
        rows=[_answer(pn="1", store=10, year=2026, month=1)],
        from_date=date(2026, 1, 1),
    )
    engine = get_snapshot_engine_at(path)
    try:
        set_meta(engine, {"schema_version": "999"})
    finally:
        engine.dispose()

    monkeypatch.setenv("SANITIZATION_SOURCE", "snapshot")
    monkeypatch.setenv("SNAPSHOT_URL", f"sqlite:///{path.as_posix()}")
    client = TestClient(create_app())
    resp = client.post("/api/v1/process", json={"source": "db", "config": {}})
    assert resp.status_code == 503
    assert "schema_version" in resp.json()["detail"]


def test_write_snapshot_embeds_schema_version(tmp_path: Path) -> None:
    path = tmp_path / "ver.sqlite"
    write_snapshot_from_rows(
        out_path=path,
        rows=[_answer(pn="1", store=10, year=2026, month=1)],
        from_date=date(2026, 1, 1),
    )
    meta = read_meta(get_snapshot_engine_at(path))
    assert meta.schema_version == SCHEMA_VERSION


def test_empty_answers_table_without_meta_rows_fails_require(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    path = tmp_path / "blank.sqlite"
    engine = create_engine(f"sqlite:///{path.as_posix()}")
    init_snapshot_schema(engine)
    set_meta(
        engine,
        {
            "loaded_at": utc_now_iso(),
            "row_count": "0",
            "store_month_count": "0",
            "schema_version": SCHEMA_VERSION,
        },
    )
    engine.dispose()

    monkeypatch.setenv("SANITIZATION_SOURCE", "snapshot")
    monkeypatch.setenv("SNAPSHOT_URL", f"sqlite:///{path.as_posix()}")
    with pytest.raises(DbSampleError, match="no answer rows"):
        require_snapshot_engine()
