"""CLI: stamp ``schema_version`` on an existing Q10012 snapshot.

Use when the file predates Wave 2 meta and a full refresh is not possible yet.

  uv run python scripts/stamp_snapshot_schema.py
"""

from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))
if str(_ROOT / "src") not in sys.path:
    sys.path.insert(0, str(_ROOT / "src"))

from backend.snapshot import resolve_snapshot_path  # noqa: E402
from backend.snapshot_migrate import stamp_schema_version  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--path",
        type=Path,
        default=None,
        help="Snapshot SQLite path (default: resolve_snapshot_path())",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Overwrite an unexpected existing schema_version",
    )
    args = parser.parse_args()
    path = (args.path or resolve_snapshot_path()).resolve()
    return stamp_schema_version(path, force=bool(args.force))


if __name__ == "__main__":
    raise SystemExit(main())
