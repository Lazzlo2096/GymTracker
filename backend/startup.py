from db_config import engine
from db.models.postgres import Base


async def on_startup():
    # Создаём таблицы, если их нет (для продакшена рекомендуется Alembic: alembic upgrade head)
    async with engine.begin() as conn:
        ## Для функции gen_random_uuid() нужно расширение pgcrypto/uuid-ossp (используем pgcrypto)
        ##await conn.execute(text("CREATE EXTENSION IF NOT EXISTS pgcrypto"))
        await conn.run_sync(Base.metadata.create_all)
