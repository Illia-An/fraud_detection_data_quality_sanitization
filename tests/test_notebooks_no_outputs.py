"""Wave 3 / S-01 — tracked notebooks must not ship cell outputs (PII risk)."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NOTEBOOKS = ROOT / "notebooks"


def test_tracked_notebooks_have_empty_outputs() -> None:
    paths = sorted(NOTEBOOKS.glob("[0-9]*.ipynb"))
    # Numbered notebooks may live only in the offline archive; if any are
    # re-added under notebooks/, they must still ship with empty outputs.
    for path in paths:
        nb = json.loads(path.read_text(encoding="utf-8"))
        for i, cell in enumerate(nb.get("cells", [])):
            outputs = cell.get("outputs") or []
            assert outputs == [], f"{path.name} cell {i} still has outputs"
            assert cell.get("execution_count") in (None, 0)
