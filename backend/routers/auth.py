"""Эндпоинты авторизации (AuthX, JWT cookies)."""

import logging

from fastapi import (
    APIRouter,
    Depends,
    File,
    Header,
    HTTPException,
    Response,
    UploadFile,
)
from fastapi.responses import HTMLResponse
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from dependencies.db_session import db_session
from cache_groups import CacheGroup
from utils.cache import cached_get, ns
from utils.db_errors import rollback_and_raise_integrity
from dependencies.auth import auth, current_user
from db.models.postgres import User
from schemas.auth import (
    LoginRequest,
    OAuthExchangeRequest,
    OAuthProvider,
    OAuthStartResponse,
    RegisterRequest,
    TokenResponse,
    UserMe,
    UserMeUpdate,
)
from schemas.utils.common_parts import ApiMessage
from authx import TokenPayload
from services.postgres.oauth_providers import (
    build_auth_url,
    exchange_code_and_get_identity,
)
from services.postgres.auth_actions import (
    get_or_create_oauth_user,
    hash_password,
    persist_new_refresh_session,
    refresh_jti_from_token_response,
    revoke_presented_refresh,
    verify_password,
)
from services.postgres.auth_refresh_sessions import rotate_refresh_session
from services.postgres.user_profile_actions import (
    build_user_me,
    postgres_patch_user_profile,
    postgres_upload_user_avatar,
)
from services.postgres.promo_actions import setup_new_user_promos
from services.postgres.user_profile_satellites import create_user_profile_satellites
from services.postgres.email_verification_actions import (
    render_verify_result_html,
    send_verification_email,
    send_verification_email_required,
    verify_email_token,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])


def _set_auth_cookies(response: Response, user: User) -> TokenResponse:
    """Выставляет access/refresh JWT в cookies ответа и возвращает токены в теле."""
    role_val = user.role.value if hasattr(user.role, "value") else str(user.role)
    extra = {"role": role_val}

    access_token = auth.create_access_token(uid=str(user.id), data=extra)
    refresh_token = auth.create_refresh_token(uid=str(user.id), data=extra)

    auth.set_access_cookies(access_token, response)
    auth.set_refresh_cookies(refresh_token, response)

    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/login", response_model=TokenResponse)
async def login(
    payload: LoginRequest, response: Response, session: db_session
) -> TokenResponse:
    """
    Логин по email или username и паролю.
    Возвращает JWT access_token и refresh_token.
    """
    login_str = payload.login.strip()
    if "@" in login_str:
        result = await session.execute(select(User).where(User.email == login_str))
        user = result.scalar_one_or_none()
    else:
        result = await session.execute(
            select(User).where(User.display_name == login_str)
        )
        user = result.scalar_one_or_none()

    if not user or not user.password_hash:
        raise HTTPException(status_code=401, detail="Неверный логин или пароль")
    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Неверный логин или пароль")

    token_response = _set_auth_cookies(response, user)
    await persist_new_refresh_session(session, user, token_response)
    await session.commit()

    return token_response


@router.post("/register", response_model=TokenResponse)
async def register(
    payload: RegisterRequest, response: Response, session: db_session
) -> TokenResponse:
    """
    Регистрация по почте и паролю.
    Создаёт пользователя в PostgreSQL и выставляет cookies (автологин).
    """
    user = User(
        email=str(payload.email),
        display_name=payload.username.strip(),
        password_hash=hash_password(payload.password),
    )
    session.add(user)

    try:
        await session.flush()
        await create_user_profile_satellites(session, user.id)
        await setup_new_user_promos(session, user, payload.promo_code)
        await session.commit()
    except HTTPException:
        await session.rollback()
        raise
    except IntegrityError as exc:
        await rollback_and_raise_integrity(
            session,
            exc,
            conflict_detail="Пользователь с таким email или именем уже существует",
            other_detail="Не удалось зарегистрировать пользователя",
        )
    await session.refresh(user)

    token_response = _set_auth_cookies(response, user)
    await persist_new_refresh_session(session, user, token_response)
    await session.commit()

    try:
        await send_verification_email(session, user)
    except Exception:
        logger.warning(
            "verification email after register failed user_id=%s",
            user.id,
            exc_info=True,
        )

    return token_response


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    response: Response,
    session: db_session,
    payload: TokenPayload = Depends(auth.refresh_token_required),
) -> TokenResponse:
    try:
        user_id = int(payload.sub)
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid token subject") from e

    result = await session.execute(select(User).where(User.id == user_id))

    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    token_jti = getattr(payload, "jti", None)
    if not token_jti:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    token_response = _set_auth_cookies(response, user)
    new_jti = refresh_jti_from_token_response(token_response)
    await rotate_refresh_session(session, user.id, str(token_jti), new_jti)

    await session.commit()

    return token_response


@router.post("/logout", response_model=ApiMessage)
async def logout(
    response: Response,
    session: db_session,
    user: current_user,
    x_refresh_token: str | None = Header(default=None, alias="X-Refresh-Token"),
) -> ApiMessage:
    """Отозвать refresh-сессию текущего устройства (не выходить на других)."""
    await revoke_presented_refresh(session, user.id, x_refresh_token)
    await session.commit()
    auth.unset_cookies(response)
    return ApiMessage()


@router.get("/me", response_model=UserMe)
@cached_get(namespace=ns.me, cache_group=CacheGroup.HOT1)
async def me(session: db_session, user: current_user) -> UserMe:
    """
    Получить данные текущего пользователя из access cookie.
    """
    await session.refresh(user)

    return await build_user_me(session, user)


@router.patch("/me", response_model=UserMe)
async def patch_me(
    body: UserMeUpdate, session: db_session, user: current_user
) -> UserMe:
    """Частично обновить профиль (имя, рост, настройки, выбранный зал)."""
    u = await postgres_patch_user_profile(session, user, body)
    await session.refresh(u)

    return await build_user_me(session, u)


@router.post("/me/avatar", response_model=UserMe)
async def upload_me_avatar(
    session: db_session,
    user: current_user,
    file: UploadFile = File(...),
) -> UserMe:
    """Загрузить аватар (multipart, поле file)."""
    await postgres_upload_user_avatar(session, user, file)
    await session.refresh(user)

    return await build_user_me(session, user)


@router.post("/email/resend", response_model=ApiMessage)
async def resend_verification_email(
    session: db_session,
    user: current_user,
) -> ApiMessage:
    """Повторно отправить письмо подтверждения email."""
    await send_verification_email_required(session, user)
    return ApiMessage(message="Письмо отправлено")


@router.get("/email/verify", response_class=HTMLResponse)
async def verify_email(
    session: db_session,
    token: str,
) -> HTMLResponse:
    """Подтверждение email по ссылке из письма (HTML-страница)."""
    try:
        await verify_email_token(session, token)
        html = render_verify_result_html(
            success=True,
            message="Спасибо! Теперь можно вернуться в приложение.",
        )
        return HTMLResponse(content=html, status_code=200)
    except HTTPException as e:
        detail = e.detail if isinstance(e.detail, str) else "Ссылка недействительна"
        html = render_verify_result_html(success=False, message=detail)
        return HTMLResponse(content=html, status_code=400)


@router.get("/oauth/{provider}/start", response_model=OAuthStartResponse)
@cached_get(namespace=ns.oauth_start, cache_group=CacheGroup.COLD1)
async def oauth_start(
    provider: OAuthProvider,
    redirect_uri: str | None = None,
    state: str | None = None,
) -> OAuthStartResponse:
    """
    Вернуть URL авторизации у провайдера.
    Клиент делает redirect на `auth_url`.
    """
    return OAuthStartResponse(
        provider=provider,
        auth_url=build_auth_url(provider, redirect_uri, state),
    )


@router.post("/oauth/{provider}/exchange", response_model=TokenResponse)
async def oauth_exchange(
    provider: OAuthProvider,
    payload: OAuthExchangeRequest,
    response: Response,
    session: db_session,
) -> TokenResponse:
    """
    Обменять code на профиль провайдера, найти/создать локального пользователя,
    выдать JWT access/refresh и выставить cookies.
    """
    identity = await exchange_code_and_get_identity(
        provider,
        code=payload.code,
        redirect_uri=payload.redirect_uri,
    )

    user, _created = await get_or_create_oauth_user(
        session, identity, promo_code=payload.promo_code
    )
    token_response = _set_auth_cookies(response, user)
    await persist_new_refresh_session(session, user, token_response)
    await session.commit()

    return token_response
