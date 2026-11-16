"""Single source of TTS planner working bounds (Wave 8 / M-02, C-03).

Product lock may replace these later; until then every consumer
(``plan_tts``, API schemas, FE via ``GET /plans-tts/bounds``) reads here.
"""

from __future__ import annotations

TTS_FLOOR_MIN = 0.0
TTS_CEILING_MIN = 30.0
TTS_DEFAULT_TARGET_MIN = 3.5
TTS_DEFAULT_MAX_MONTHLY_IMPROVE = 0.25
TTS_HORIZON_MIN = 1
TTS_HORIZON_MAX = 12


def tts_bounds_payload() -> dict[str, float | int]:
    """JSON-friendly bounds for the API / FE."""
    return {
        "floor": TTS_FLOOR_MIN,
        "ceiling": TTS_CEILING_MIN,
        "default_target": TTS_DEFAULT_TARGET_MIN,
        "default_max_monthly_improve": TTS_DEFAULT_MAX_MONTHLY_IMPROVE,
        "horizon_min": TTS_HORIZON_MIN,
        "horizon_max": TTS_HORIZON_MAX,
    }
