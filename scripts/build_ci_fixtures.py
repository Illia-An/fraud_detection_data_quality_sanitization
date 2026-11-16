"""CLI: build synthetic SQLite fixtures under testdata/fixtures/ (Wave 5)."""

from __future__ import annotations

import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))
if str(_ROOT / "src") not in sys.path:
    sys.path.insert(0, str(_ROOT / "src"))

from backend.ci_fixtures import (  # noqa: E402
    DEFAULT_Q10012_PATH,
    DEFAULT_TTS_PATH,
    build_default_fixtures,
)


def main() -> int:
    q, t = build_default_fixtures()
    print(f"wrote {q}")
    print(f"wrote {t}")
    print(f"defaults: {DEFAULT_Q10012_PATH.name}, {DEFAULT_TTS_PATH.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
