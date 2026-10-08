"""Регистрация Expo push-токенов."""

from typing import Annotated

from fastapi import APIRouter, Depends

from db.models.postgres import User
from dependencies.auth import get_current_user
from dependencies.db_session import db_session
from schemas.push_token import PushTokenRegister, PushTokenResponse, PushTokenUnregister
from services.postgres.push_actions import remove_push_token, upsert_push_token

router = APIRouter(prefix="/push-tokens", tags=["push_tokens"])


@router.post("/", response_model=PushTokenResponse)
async def register_push_token(
    body: PushTokenRegister,
    session: db_session,
    auth_user: Annotated[User, Depends(get_current_user)],
):
    await upsert_push_token(
        session,
        auth_user,
        expo_push_token=body.expo_push_token,
        platform=body.platform,
    )
    await session.commit()
    return PushTokenResponse(status="registered")


@router.delete("/", response_model=PushTokenResponse)
async def unregister_push_token(
    body: PushTokenUnregister,
    session: db_session,
    auth_user: Annotated[User, Depends(get_current_user)],
):
    await remove_push_token(session, auth_user, body.expo_push_token)
    await session.commit()
    return PushTokenResponse(status="removed")
