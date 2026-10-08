from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from project_config import settings

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    pool_size=10,
    max_overflow=10,
)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def get_session() -> AsyncSession:
    async with SessionLocal() as session:
        yield session
