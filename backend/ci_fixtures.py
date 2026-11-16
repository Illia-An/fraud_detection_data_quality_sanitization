"""Synthetic SQLite fixtures for CI / smoke / E2E (Wave 5)."""

from __future__ import annotations

from pathlib import Path

from sqlalchemy import create_engine, text

from backend.snapshot import (
    ANSWERS_TABLE,
    SCHEMA_VERSION,
    STORE_MONTH_TABLE,
    init_snapshot_schema,
    set_meta,
    utc_now_iso,
)
from backend.tts_kpi_snapshot import (
    KPI_ROWS_TABLE,
    init_tts_kpi_snapshot_schema,
    set_tts_kpi_meta,
)

_PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_FIXTURES_DIR = _PROJECT_ROOT / "testdata" / "fixtures"
DEFAULT_Q10012_PATH = DEFAULT_FIXTURES_DIR / "q10012_snapshot.sqlite"
DEFAULT_TTS_PATH = DEFAULT_FIXTURES_DIR / "tts_kpi_snapshot.sqlite"


def build_q10012(path: Path) -> None:
    if path.exists():
        path.unlink()
    path.parent.mkdir(parents=True, exist_ok=True)
    engine = create_engine(f"sqlite:///{path.as_posix()}")
    init_snapshot_schema(engine)
    loaded = utc_now_iso()
    rows = [
        ("1", 5, None, "fixture-a@example.test", 10, "2026-01-05 10:00:00", 2026, 1),
        ("2", 4, None, "fixture-b@example.test", 10, "2026-01-06 11:00:00", 2026, 1),
        ("3", 5, "עובד", "fixture-c@example.test", 10, "2026-01-07 12:00:00", 2026, 1),
        ("4", 5, None, "fixture-d@example.test", 20, "2026-02-02 09:00:00", 2026, 2),
        ("5", 3, None, "fixture-e@example.test", 20, "2026-02-03 09:30:00", 2026, 2),
    ]
    with engine.begin() as conn:
        for pid, answer, bl, contact, store, at, year, month in rows:
            conn.execute(
                text(
                    f"""
INSERT INTO {ANSWERS_TABLE} (
    ParticipateNumber, Question_ID, Answer_Value, BlackList,
    UserContact, PhoneFromLog, ext_user_id, PrintStore,
    AnswerTime, Year, Month, LoadedAt
) VALUES (
    :pid, 10012, :answer, :bl, :contact, NULL, NULL, :store,
    :at, :year, :month, :loaded
)
"""
                ),
                {
                    "pid": pid,
                    "answer": answer,
                    "bl": bl,
                    "contact": contact,
                    "store": store,
                    "at": at,
                    "year": year,
                    "month": month,
                    "loaded": loaded,
                },
            )
        conn.execute(
            text(
                f"""
INSERT INTO {STORE_MONTH_TABLE}
    (PrintStore, Year, Month, total_count, top_box_count)
VALUES
    (10, 2026, 1, 3, 2),
    (20, 2026, 2, 2, 1)
"""
            )
        )
    set_meta(
        engine,
        {
            "loaded_at": loaded,
            "row_count": str(len(rows)),
            "store_month_count": "2",
            "source_view": "ci_fixture",
            "from_date": "2026-01-01",
            "schema_version": SCHEMA_VERSION,
        },
    )
    engine.dispose()


def build_tts_kpi(path: Path) -> None:
    if path.exists():
        path.unlink()
    path.parent.mkdir(parents=True, exist_ok=True)
    engine = create_engine(f"sqlite:///{path.as_posix()}")
    init_tts_kpi_snapshot_schema(engine)
    loaded = utc_now_iso()
    rows = [
        (10, 2026, 1, 4.2),
        (10, 2026, 2, 4.0),
        (20, 2026, 1, 3.8),
        (20, 2026, 2, 3.9),
    ]
    with engine.begin() as conn:
        for store_id, year, month, score in rows:
            conn.execute(
                text(
                    f"""
INSERT INTO {KPI_ROWS_TABLE}
    (StoreID_external, year, month, KPI_Score)
VALUES (:s, :y, :m, :v)
"""
                ),
                {"s": store_id, "y": year, "m": month, "v": score},
            )
    set_tts_kpi_meta(
        engine,
        {
            "loaded_at": loaded,
            "row_count": str(len(rows)),
            "source_table": "ci_fixture",
            "from_date": "2026-01-01",
        },
    )
    engine.dispose()


def build_default_fixtures() -> tuple[Path, Path]:
    build_q10012(DEFAULT_Q10012_PATH)
    build_tts_kpi(DEFAULT_TTS_PATH)
    return DEFAULT_Q10012_PATH, DEFAULT_TTS_PATH
