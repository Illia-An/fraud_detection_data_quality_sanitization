import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

_PROJECT_ROOT = Path(__file__).resolve().parents[1]

_DEFAULT_TTS_VIEW = "dbo.TargetsByMetrics_McKitiBump"


@dataclass(frozen=True)
class Settings:
    database_url: str
    cors_origins: str
    # Optional dedicated URL for MC / TTS view; empty → use database_url.
    tts_database_url: str
    tts_view: str


@lru_cache
def get_settings() -> Settings:
    load_dotenv(_PROJECT_ROOT / ".env")
    database_url = os.environ.get("DATABASE_URL", "").strip()
    if not database_url:
        raise ValueError("DATABASE_URL is not set in .env")
    tts_database_url = os.environ.get("TTS_DATABASE_URL", "").strip()
    tts_view = os.environ.get("TTS_VIEW", "").strip() or _DEFAULT_TTS_VIEW
    return Settings(
        database_url=database_url,
        cors_origins=os.environ.get("API_CORS_ORIGINS", "http://localhost:4200").strip(),
        tts_database_url=tts_database_url,
        tts_view=tts_view,
    )


def resolve_tts_database_url(settings: Settings | None = None) -> str:
    """Prefer ``TTS_DATABASE_URL`` when set; otherwise Q10012 ``DATABASE_URL``."""
    cfg = settings if settings is not None else get_settings()
    return cfg.tts_database_url or cfg.database_url
