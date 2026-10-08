"""Зависимость FastAPI: асинхронная сессия SQLAlchemy для одного HTTP-запроса."""

from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from db_config import get_session

db_session = Annotated[AsyncSession, Depends(get_session)]
