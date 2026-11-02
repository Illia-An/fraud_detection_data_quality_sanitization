"""Full-reload TTS KPI snapshot from AP into local SQLite.

Same period default as Q10012 (``DEFAULT_FROM_DATE`` = 2025-01-01).
Run on a host that can reach AP (Trusted Connection / VPN), then mount the
file in Docker. Never commit ``data/*.sqlite``.

Usage (repo root):
  uv run python scripts/refresh_tts_kpi_snapshot.py
  uv run python scripts/refresh_tts_kpi_snapshot.py --from-date 2025-01-01
  uv run python scripts/refresh_tts_kpi_snapshot.py --out data/tts_kpi_snapshot.sqlite

Requires ``TTS_KPI_DATABASE_URL`` (do not reuse ``DATABASE_URL``).
Optional ``TTS_KPI_TABLE`` (default ``AP.dbo.T_KPITrendAlerts``).
"""

from __future__ import annotations

import argparse
import logging
import sys
from datetime import date
from pathlib import Path

from dotenv import load_dotenv

from backend.db_sample import DEFAULT_FROM_DATE
from backend.tts_kpi_snapshot import (
    DEFAULT_TTS_KPI_SNAPSHOT_PATH,
    refresh_tts_kpi_snapshot,
    resolve_tts_kpi_snapshot_path,
)

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("refresh_tts_kpi_snapshot")


def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument(
        "--from-date",
        type=date.fromisoformat,
        default=DEFAULT_FROM_DATE,
        help=f"Inclusive year/month lower bound (default {DEFAULT_FROM_DATE})",
    )
    p.add_argument(
        "--to-date",
        type=date.fromisoformat,
        default=None,
        help="Inclusive year/month upper bound (e.g. 2026-10-01 for Oct 2026)",
    )
    p.add_argument(
        "--out",
        type=Path,
        default=None,
        help=f"SQLite file path (default {DEFAULT_TTS_KPI_SNAPSHOT_PATH})",
    )
    return p.parse_args()


def main() -> int:
    args = _parse_args()
    out = args.out or resolve_tts_kpi_snapshot_path()
    try:
        refresh_tts_kpi_snapshot(
            from_date=args.from_date,
            to_date=args.to_date,
            out_path=out,
        )
    except Exception:
        logger.exception("TTS KPI snapshot refresh failed")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
