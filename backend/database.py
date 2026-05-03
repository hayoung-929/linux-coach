import os

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

_url = os.getenv("DATABASE_URL")

if _url:
    DATABASE_URL = _url
    engine = create_async_engine(DATABASE_URL, echo=False)
else:
    # Local dev fallback: SQLite (no PostgreSQL required)
    DATABASE_URL = "sqlite+aiosqlite:///./linuxcoach.db"
    engine = create_async_engine(
        DATABASE_URL,
        echo=False,
        connect_args={"check_same_thread": False},
    )

AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
