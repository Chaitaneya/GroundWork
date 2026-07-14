from collections.abc import Generator

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import settings


class Base(DeclarativeBase):
    """All ORM models inherit from this. Alembic reads Base.metadata
    to know what tables *should* exist when autogenerating migrations."""


_engine: Engine | None = None


def get_engine() -> Engine:
    global _engine
    if _engine is None:
        # Neon hands out URLs starting with postgresql://, which SQLAlchemy
        # routes to the old psycopg2 driver. We use psycopg (v3), so rewrite
        # the scheme to pick the right driver.
        url = settings.database_url.replace("postgresql://", "postgresql+psycopg://", 1)
        # pool_pre_ping: test connections before use — Neon closes idle
        # connections when it scales to zero, so stale ones must be detected.
        _engine = create_engine(url, pool_pre_ping=True)
    return _engine


# expire_on_commit=False lets us return ORM objects from endpoints after
# committing without SQLAlchemy re-fetching every attribute.
SessionLocal = sessionmaker(autoflush=False, expire_on_commit=False)


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency: one database session per request, always closed."""
    with SessionLocal(bind=get_engine()) as session:
        yield session
