"""Схемы API промокодов."""

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class PromoResolveOut(BaseModel):
    valid: bool
    code: str
    type: Optional[str] = None
    allowed_at_register: bool = False
    owner_display_name: Optional[str] = None
    label: Optional[str] = None


class PromoRedeemRequest(BaseModel):
    code: str = Field(..., min_length=1, max_length=32)


class PromoRedeemResponse(BaseModel):
    promo_type: str
    premium_days_granted: Optional[int] = None
    message: str = "Промокод активирован"


class PromoInviteeOut(BaseModel):
    display_name: str
    status: str
    tonnage_kg: float
    milestone_kg: float
    progress_percent: float = Field(..., description="Прогресс к milestone, 0–100")


class PromoReferralStatsOut(BaseModel):
    invited_total: int = Field(..., description="Всего зарегистрировалось по коду")
    milestone_completed: int = Field(
        ..., description="Набрали целевой тоннаж (награда выдана)"
    )
    in_progress: int = Field(..., description="Ещё набирают тоннаж")
    rewards_earned: int = Field(
        ..., description="Сколько раз вы получили награду (lifetime)"
    )
    milestone_kg: float = Field(..., description="Целевой тоннаж для награды")


class PromoMeOut(BaseModel):
    code: str
    register_url: str
    stats: PromoReferralStatsOut
    invitees: list[PromoInviteeOut]


class PromoAdminCreate(BaseModel):
    code: str = Field(..., min_length=4, max_length=32)
    type: Literal["blogger", "simple"]
    label: Optional[str] = Field(default=None, max_length=128)


class PromoAdminOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    type: str
    label: Optional[str] = None
    created_at: datetime
    redemption_count: int = 0
