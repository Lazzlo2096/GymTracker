"""Роутер оплаты через YooKassa."""

from fastapi import APIRouter

from dependencies.auth import current_user
from dependencies.db_session import db_session
from utils.cache import invalidate_me_cache
from schemas.payments import (
    YooKassaCreatePaymentRequest,
    YooKassaCreatePaymentResponse,
    YooKassaPaymentStatusResponse,
)
from services.postgres.payments_yookassa import (
    create_yookassa_payment,
    check_yookassa_payment,
)

router = APIRouter(prefix="/payments/yookassa", tags=["payments/yookassa"])


@router.post("/create", response_model=YooKassaCreatePaymentResponse)
async def create_payment(
    body: YooKassaCreatePaymentRequest,
    session: db_session,
    user: current_user,
):
    """
    Создать платёж YooKassa и сохранить его в БД.
    """
    return await create_yookassa_payment(session, user=user, req=body)


@router.get("/{payment_id}", response_model=YooKassaPaymentStatusResponse)
async def check_payment(
    payment_id: str,
    session: db_session,
    user: current_user,
):
    """
    Проверить и синхронизировать статус платежа с YooKassa.

    Без Redis-кэша: клиент опрашивает статус, ответ всегда после синхронизации с провайдером.
    """
    result = await check_yookassa_payment(session, user=user, payment_id=payment_id)
    if result.paid:
        await invalidate_me_cache(user.id)
    return result
