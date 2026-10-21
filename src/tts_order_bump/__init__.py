"""Synthetic TTS Order × Bump mart (PoC) — matches docs/tts_full_view_for_proj ТЗ."""

from tts_order_bump.engine import (
    DEFAULT_TTS_MIN_SEC,
    process_order_bump_rows,
)
from tts_order_bump.synthetic import (
    ORDER_BUMP_PRESETS,
    OrderBumpPresetName,
    generate_order_bump_preset,
    order_bump_preset_meta,
)

__all__ = [
    "DEFAULT_TTS_MIN_SEC",
    "ORDER_BUMP_PRESETS",
    "OrderBumpPresetName",
    "generate_order_bump_preset",
    "order_bump_preset_meta",
    "process_order_bump_rows",
]
