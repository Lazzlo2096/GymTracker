"""Сервис оплаты через YooKassa."""

from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
import uuid

import httpx
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from project_config import settings
from db.models.postgres import Payment, User
from schemas.payments import (
    YooKassaCreatePaymentRequest,
    YooKassaCreatePaymentResponse,
    YooKassaPaymentStatusResponse,
)

YOOKASSA_API_BASE = "https://api.yookassa.ru/v3"


def _ensure_yookassa_configured() -> None:
    if not settings.YOOKASSA_SHOP_ID or not settings.YOOKASSA_SECRET_KEY:
        raise HTTPException(status_code=500, detail="YooKassa credentials не настроены")


def _fmt_amount(value: float) -> str:
    return str(
        Decimal(str(value)).quantize(
            Decimal("0.01"),
            rounding=ROUND_HALF_UP,
        )
    )


def _receipt_item_description(value: str | None) -> str:
    """Ограничиваем описание позиции чека до 128 символов (ограничение YooKassa)."""
    text = (value or "").strip() or "GymTracker payment"
    return text[:128]


def _parse_paid_at(value: str | None) -> datetime | None:
    if not value:
        return None

    try:
        # YooKassa отдаёт ISO с Z
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except Exception:
        return None


async def create_yookassa_payment(
    session: AsyncSession,
    *,
    user: User,
    req: YooKassaCreatePaymentRequest,
) -> YooKassaCreatePaymentResponse:
    _ensure_yookassa_configured()
    return_url = (req.return_url or settings.YOOKASSA_RETURN_URL_DEFAULT).strip()
    if not return_url:
        raise HTTPException(status_code=400, detail="return_url обязателен")

    idempotence_key = uuid.uuid4().hex
    amount_value = _fmt_amount(req.amount)
    receipt_desc = _receipt_item_description(req.description)
    payload = {
        "amount": {"value": amount_value, "currency": "RUB"},
        "capture": True,
        "confirmation": {"type": "redirect", "return_url": return_url},
        "description": req.description or "GymTracker payment",
        "receipt": {
            "customer": {"email": str(req.receipt_email)},
            "items": [
                {
                    "description": receipt_desc,
                    "quantity": "1.00",
                    "amount": {"value": amount_value, "currency": "RUB"},
                    # Для услуг в приложении: без НДС (код 1), полная предоплата.
                    "vat_code": 1,
                    "payment_mode": "full_prepayment",
                    "payment_subject": "service",
                }
            ],
        },
        "metadata": {
            "user_id": str(user.id),
            "receipt_email": str(req.receipt_email),
            **(req.metadata or {}),
        },
    }

    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.post(
            f"{YOOKASSA_API_BASE}/payments",
            auth=(settings.YOOKASSA_SHOP_ID, settings.YOOKASSA_SECRET_KEY),
            headers={"Idempotence-Key": idempotence_key},
            json=payload,
        )

    if resp.status_code >= 400:
        raise HTTPException(
            status_code=400, detail=f"YooKassa create failed: {resp.text}"
        )

    body = resp.json()
    provider_payment_id = str(body.get("id") or "")
    if not provider_payment_id:
        raise HTTPException(status_code=400, detail="YooKassa: payment id отсутствует")

    amount_obj = body.get("amount") or {}
    amount_num = float(amount_obj.get("value") or amount_value)
    currency = str(amount_obj.get("currency") or "RUB")
    status = str(body.get("status") or "pending")
    confirmation_url = (body.get("confirmation") or {}).get("confirmation_url")
    paid_at = _parse_paid_at(body.get("paid_at"))

    row = Payment(
        user_id=user.id,
        provider="yookassa",
        provider_payment_id=provider_payment_id,
        idempotence_key=idempotence_key,
        amount=amount_num,
        currency=currency,
        description=req.description,
        status=status,
        confirmation_url=confirmation_url,
        paid_at=paid_at,
        provider_payload=body,
    )

    session.add(row)
    await session.commit()

    return YooKassaCreatePaymentResponse(
        payment_id=provider_payment_id,
        status=status,
        confirmation_url=confirmation_url,
        amount=amount_num,
        currency=currency,
    )


async def check_yookassa_payment(
    session: AsyncSession,
    *,
    user: User,
    payment_id: str,
) -> YooKassaPaymentStatusResponse:
    _ensure_yookassa_configured()

    res = await session.execute(
        select(Payment).where(
            Payment.provider == "yookassa",
            Payment.provider_payment_id == payment_id,
            Payment.user_id == user.id,
        )
    )
    row = res.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Payment not found")

    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.get(
            f"{YOOKASSA_API_BASE}/payments/{payment_id}",
            auth=(settings.YOOKASSA_SHOP_ID, settings.YOOKASSA_SECRET_KEY),
        )
    if resp.status_code >= 400:
        raise HTTPException(
            status_code=400, detail=f"YooKassa check failed: {resp.text}"
        )

    body = resp.json()
    amount_obj = body.get("amount") or {}
    row.status = str(body.get("status") or row.status)
    row.currency = str(amount_obj.get("currency") or row.currency)
    row.amount = float(amount_obj.get("value") or row.amount)
    row.paid_at = _parse_paid_at(body.get("paid_at")) or row.paid_at
    row.provider_payload = body
    row.updated_at = datetime.now(timezone.utc)

    confirmation_url = (body.get("confirmation") or {}).get("confirmation_url")
    if confirmation_url:
        row.confirmation_url = confirmation_url

    await session.commit()

    paid = row.status == "succeeded"
    return YooKassaPaymentStatusResponse(
        payment_id=row.provider_payment_id,
        status=row.status,
        paid=paid,
        amount=float(row.amount),
        currency=row.currency,
        paid_at=row.paid_at,
        description=row.description,
    )
