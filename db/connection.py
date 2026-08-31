from sqlalchemy import Engine, create_engine

from db.config import get_settings


def get_engine() -> Engine:
    """Create a SQLAlchemy engine from DATABASE_URL in .env."""
    return create_engine(get_settings().database_url)
