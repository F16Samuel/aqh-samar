from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings

import urllib.parse

db_url = settings.DATABASE_URL
parsed_url = urllib.parse.urlparse(db_url)
query_params = urllib.parse.parse_qs(parsed_url.query)
sslmode = query_params.pop("sslmode", None)

new_query = urllib.parse.urlencode(query_params, doseq=True)
parsed_url = parsed_url._replace(query=new_query)
clean_db_url = urllib.parse.urlunparse(parsed_url)

connect_args = {}
if sslmode or "pooler.supabase.com" in clean_db_url:
    connect_args["ssl"] = True

engine = create_async_engine(
    clean_db_url,
    connect_args=connect_args,
    echo=settings.APP_ENV == "development",
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)

AsyncSessionLocal: async_sessionmaker[AsyncSession] = async_sessionmaker(
    bind=engine,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)


async def get_db() -> AsyncSession:  # type: ignore[return]
    async with AsyncSessionLocal() as session:
        yield session
