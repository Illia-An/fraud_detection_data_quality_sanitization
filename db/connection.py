from sqlalchemy import Engine, create_engine

from db.config import get_settings, resolve_tts_database_url


def get_engine() -> Engine:
    """Create a SQLAlchemy engine from DATABASE_URL in .env."""
    return create_engine(get_settings().database_url)


def get_tts_engine() -> Engine:
    """Engine for TTS McKitiBump (``TTS_DATABASE_URL`` or ``DATABASE_URL``)."""
    return create_engine(resolve_tts_database_url())
