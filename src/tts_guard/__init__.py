"""Pure TTS sanitization rules (SPEC-tts Stage 2). No I/O."""

from tts_guard.pipeline import run_tts_sanitize
from tts_guard.synthetic import TTS_PRESETS, generate_tts_preset

__all__ = ["run_tts_sanitize", "TTS_PRESETS", "generate_tts_preset"]
