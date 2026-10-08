"""Схемы оплаты YooKassa."""

from datetime import datetime

from pydantic import BaseModel, Field, EmailStr


class YooKassaCreatePaymentRequest(BaseModel):
    """Запрос на создание платежа в YooKassa."""

    amount: float = Field(..., gt=0, description="Сумма платежа")
    receipt_email: EmailStr = Field(
        ...,
        description="Email для отправки чека (обязательный параметр)",
    )
    description: str | None = Field(default=None, max_length=500)
    return_url: str | None = Field(
        default=None,
        description="URL возврата после оплаты (если не передан — берётся из env)",
    )
    metadata: dict | None = Field(default=None, description="Произвольные данные")


class YooKassaCreatePaymentResponse(BaseModel):
    """Ответ после создания платежа."""

    payment_id: str
    status: str
    confirmation_url: str | None = None
    amount: float
    currency: str


class YooKassaPaymentStatusResponse(BaseModel):
    """Статус платежа в YooKassa."""

    payment_id: str
    status: str
    paid: bool
    amount: float
    currency: str
    paid_at: datetime | None = None
    description: str | None = None
