from sqlalchemy import Engine

from db.config import get_settings, resolve_tts_database_url


def get_engine() -> Engine:
    """Cached SQLAlchemy engine from DATABASE_URL in .env."""
    from backend.data_access import get_cached_engine

    return get_cached_engine(get_settings().database_url)


def get_tts_engine() -> Engine:
    """Cached engine for TTS McKitiBump (``TTS_DATABASE_URL`` or ``DATABASE_URL``)."""
    from backend.data_access import get_cached_engine

    return get_cached_engine(resolve_tts_database_url())
