import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

_PROJECT_ROOT = Path(__file__).resolve().parents[1]


@dataclass(frozen=True)
class Settings:
    database_url: str
    cors_origins: str


@lru_cache
def get_settings() -> Settings:
    load_dotenv(_PROJECT_ROOT / ".env")
    database_url = os.environ.get("DATABASE_URL", "").strip()
    if not database_url:
        raise ValueError("DATABASE_URL is not set in .env")
    return Settings(
        database_url=database_url,
        cors_origins=os.environ.get("API_CORS_ORIGINS", "http://localhost:4200").strip(),
    )
