"""Промокоды: создание, погашение, реферальный milestone."""

from __future__ import annotations

import secrets
import string
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Literal

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.expression import literal_column

from db.models.postgres import PromoCode, PromoRedemption, User
from db.models.postgres.workout import Workout
from db.repositories.postgres.workout_repository import _TONNAGE_SQL
from services.postgres.premium_actions import grant_premium_days, grant_premium_lifetime
from utils.db_errors import rollback_and_raise_integrity
from services.postgres.push_actions import (
    notify_referral_invited,
    notify_referral_milestone,
)

PROMO_TYPE_REFERRAL = "referral"
PROMO_TYPE_BLOGGER = "blogger"
PROMO_TYPE_SIMPLE = "simple"

PROMO_TYPES_ALLOWED_AT_REGISTER = (PROMO_TYPE_REFERRAL, PROMO_TYPE_BLOGGER)

REFERRAL_MILESTONE_TONNAGE_KG = 100.0
PREMIUM_DAYS_CAMPAIGN = 7
REGISTER_PROMO_BASE_URL = "https://habitpro.ru/register"

RedeemContext = Literal["register", "authenticated"]

_STATUS_PENDING = "pending"
_STATUS_COMPLETED = "completed"
_STATUS_OWNER_REWARDED = "owner_rewarded"


@dataclass
class RedeemResult:
    promo_type: str
    premium_days_granted: int | None = None


def normalize_promo_code(raw: str) -> str:
    return raw.strip().upper()


def _generate_code(length: int = 8) -> str:
    alphabet = string.ascii_uppercase + string.digits
    for _ in range(20):
        code = "".join(secrets.choice(alphabet) for _ in range(length))
        return code
    raise RuntimeError("Failed to generate promo code")


async def get_promo_by_code(session: AsyncSession, code: str) -> PromoCode | None:
    normalized = normalize_promo_code(code)
    if not normalized:
        return None
    r = await session.execute(select(PromoCode).where(PromoCode.code == normalized))
    return r.scalar_one_or_none()


async def create_referral_promo_for_user(
    session: AsyncSession, user: User
) -> PromoCode:
    existing = await session.execute(
        select(PromoCode).where(
            PromoCode.owner_user_id == user.id,
            PromoCode.type == PROMO_TYPE_REFERRAL,
        )
    )
    row = existing.scalar_one_or_none()
    if row is not None:
        return row

    for _ in range(30):
        code = _generate_code()
        dup = await session.execute(select(PromoCode.id).where(PromoCode.code == code))
        if dup.scalar_one_or_none() is not None:
            continue
        promo = PromoCode(
            owner_user_id=user.id,
            code=code,
            type=PROMO_TYPE_REFERRAL,
        )
        session.add(promo)
        await session.flush()
        return promo
    raise HTTPException(
        status_code=500, detail="Не удалось создать реферальный промокод"
    )


async def setup_new_user_promos(
    session: AsyncSession, user: User, promo_code: str | None = None
) -> RedeemResult | None:
    await create_referral_promo_for_user(session, user)
    if promo_code and promo_code.strip():
        return await redeem_promo_code(
            session, code=promo_code, redeemer=user, context="register"
        )
    return None


async def sum_user_tonnage_kg(session: AsyncSession, user_id: int) -> float:
    r = await session.execute(
        select(func.coalesce(func.sum(literal_column(_TONNAGE_SQL)), 0.0))
        .select_from(Workout)
        .where(Workout.user_id == user_id)
    )
    return float(r.scalar_one() or 0.0)


async def process_referral_milestones(
    session: AsyncSession, redeemer_user_id: int
) -> None:
    tonnage = await sum_user_tonnage_kg(session, redeemer_user_id)
    if tonnage < REFERRAL_MILESTONE_TONNAGE_KG:
        return

    stmt = (
        select(PromoRedemption)
        .join(PromoCode, PromoRedemption.promo_code_id == PromoCode.id)
        .where(
            PromoRedemption.redeemer_user_id == redeemer_user_id,
            PromoRedemption.is_referral_redemption.is_(True),
            PromoRedemption.status == _STATUS_PENDING,
            PromoCode.owner_user_id.isnot(None),
        )
    )
    r = await session.execute(stmt)
    for redemption in r.scalars().all():
        owner_id = redemption.promo_code.owner_user_id
        if owner_id is None:
            continue
        redemption.status = _STATUS_OWNER_REWARDED
        redemption.redeemer_tonnage_kg = tonnage
        redemption.owner_rewarded_at = datetime.now(timezone.utc)
        await grant_premium_lifetime(session, owner_id)
        owner = await session.get(User, owner_id)
        invitee = await session.get(User, redeemer_user_id)
        if owner and invitee:
            await notify_referral_milestone(
                session,
                owner,
                invitee_name=invitee.display_name,
                dedup_key=f"milestone:{redemption.id}",
            )


async def redeem_promo_code(
    session: AsyncSession,
    *,
    code: str,
    redeemer: User,
    context: RedeemContext,
) -> RedeemResult:
    promo = await get_promo_by_code(session, code)
    if promo is None:
        raise HTTPException(status_code=404, detail="Промокод не найден")

    if promo.type == PROMO_TYPE_REFERRAL:
        if context != "register":
            raise HTTPException(
                status_code=400,
                detail="Реферальный промокод можно указать только при регистрации",
            )
        if promo.owner_user_id is None:
            raise HTTPException(
                status_code=400, detail="Некорректный реферальный промокод"
            )
        if promo.owner_user_id == redeemer.id:
            raise HTTPException(
                status_code=400, detail="Нельзя активировать свой промокод"
            )
    elif promo.type == PROMO_TYPE_SIMPLE:
        if context != "authenticated":
            raise HTTPException(
                status_code=400,
                detail="Этот промокод можно активировать только после регистрации",
            )
    elif promo.type == PROMO_TYPE_BLOGGER:
        pass
    else:
        raise HTTPException(status_code=400, detail="Неизвестный тип промокода")

    if context == "register" and promo.type not in PROMO_TYPES_ALLOWED_AT_REGISTER:
        raise HTTPException(
            status_code=400,
            detail="Этот промокод нельзя использовать при регистрации",
        )

    if promo.type == PROMO_TYPE_REFERRAL:
        prior = await session.execute(
            select(PromoRedemption.id).where(
                PromoRedemption.redeemer_user_id == redeemer.id,
                PromoRedemption.is_referral_redemption.is_(True),
            )
        )
        if prior.scalar_one_or_none() is not None:
            raise HTTPException(
                status_code=409, detail="Реферальный промокод уже был активирован"
            )

        redemption = PromoRedemption(
            promo_code_id=promo.id,
            redeemer_user_id=redeemer.id,
            status=_STATUS_PENDING,
            is_referral_redemption=True,
        )
        session.add(redemption)
        await session.flush()

        if promo.owner_user_id is not None:
            owner = await session.get(User, promo.owner_user_id)
            if owner:
                await notify_referral_invited(
                    session,
                    owner,
                    invitee_name=redeemer.display_name,
                    dedup_key=f"invited:{redeemer.id}",
                )

        await process_referral_milestones(session, redeemer.id)
        return RedeemResult(promo_type=promo.type)

    global_used = await session.execute(
        select(PromoRedemption.id).where(PromoRedemption.promo_code_id == promo.id)
    )
    if global_used.scalar_one_or_none() is not None:
        raise HTTPException(status_code=409, detail="Промокод уже использован")

    already = await session.execute(
        select(PromoRedemption.id).where(
            PromoRedemption.promo_code_id == promo.id,
            PromoRedemption.redeemer_user_id == redeemer.id,
        )
    )
    if already.scalar_one_or_none() is not None:
        raise HTTPException(status_code=409, detail="Вы уже активировали этот промокод")

    redemption = PromoRedemption(
        promo_code_id=promo.id,
        redeemer_user_id=redeemer.id,
        status=_STATUS_COMPLETED,
        is_referral_redemption=False,
        premium_days_granted=PREMIUM_DAYS_CAMPAIGN,
    )
    session.add(redemption)
    await session.flush()

    await grant_premium_days(session, redeemer.id, days=PREMIUM_DAYS_CAMPAIGN)
    return RedeemResult(
        promo_type=promo.type, premium_days_granted=PREMIUM_DAYS_CAMPAIGN
    )


async def resolve_promo_code(session: AsyncSession, code: str) -> dict:
    promo = await get_promo_by_code(session, code)
    if promo is None:
        return {
            "valid": False,
            "code": normalize_promo_code(code),
            "type": None,
            "allowed_at_register": False,
            "owner_display_name": None,
            "label": None,
        }

    owner_name = None
    if promo.type == PROMO_TYPE_REFERRAL and promo.owner_user_id:
        owner = await session.get(User, promo.owner_user_id)
        if owner:
            owner_name = owner.display_name

    return {
        "valid": True,
        "code": promo.code,
        "type": promo.type,
        "allowed_at_register": promo.type in PROMO_TYPES_ALLOWED_AT_REGISTER,
        "owner_display_name": owner_name,
        "label": promo.label,
    }


@dataclass
class InviteeRow:
    display_name: str
    status: str
    tonnage_kg: float
    milestone_kg: float
    progress_percent: float


@dataclass
class ReferralStats:
    invited_total: int
    milestone_completed: int
    in_progress: int
    rewards_earned: int
    milestone_kg: float


@dataclass
class PromoDashboard:
    code: str
    register_url: str
    stats: ReferralStats
    invitees: list[InviteeRow]


async def get_my_promo_dashboard(session: AsyncSession, user: User) -> PromoDashboard:
    r = await session.execute(
        select(PromoCode).where(
            PromoCode.owner_user_id == user.id,
            PromoCode.type == PROMO_TYPE_REFERRAL,
        )
    )
    promo = r.scalar_one_or_none()
    if promo is None:
        promo = await create_referral_promo_for_user(session, user)

    stmt = (
        select(PromoRedemption, User)
        .join(User, PromoRedemption.redeemer_user_id == User.id)
        .where(
            PromoRedemption.promo_code_id == promo.id,
            PromoRedemption.is_referral_redemption.is_(True),
        )
        .order_by(PromoRedemption.created_at.desc())
    )
    rows = await session.execute(stmt)
    invitees: list[InviteeRow] = []
    milestone_completed = 0
    in_progress = 0
    for redemption, redeemer in rows.all():
        tonnage = await sum_user_tonnage_kg(session, redeemer.id)
        if redemption.status == _STATUS_OWNER_REWARDED:
            milestone_completed += 1
        elif redemption.status == _STATUS_PENDING:
            in_progress += 1
        progress = min(
            100.0,
            round(
                (
                    (tonnage / REFERRAL_MILESTONE_TONNAGE_KG) * 100.0
                    if REFERRAL_MILESTONE_TONNAGE_KG > 0
                    else 0.0
                ),
                1,
            ),
        )
        invitees.append(
            InviteeRow(
                display_name=redeemer.display_name,
                status=redemption.status,
                tonnage_kg=round(tonnage, 1),
                milestone_kg=REFERRAL_MILESTONE_TONNAGE_KG,
                progress_percent=progress,
            )
        )

    invited_total = len(invitees)
    stats = ReferralStats(
        invited_total=invited_total,
        milestone_completed=milestone_completed,
        in_progress=in_progress,
        rewards_earned=milestone_completed,
        milestone_kg=REFERRAL_MILESTONE_TONNAGE_KG,
    )

    return PromoDashboard(
        code=promo.code,
        register_url=f"{REGISTER_PROMO_BASE_URL}?promo={promo.code}",
        stats=stats,
        invitees=invitees,
    )


async def create_promo_code_admin(
    session: AsyncSession,
    *,
    code: str,
    promo_type: str,
    label: str | None,
    created_by_user_id: int,
) -> PromoCode:
    if promo_type not in (PROMO_TYPE_BLOGGER, PROMO_TYPE_SIMPLE):
        raise HTTPException(
            status_code=400, detail="Admin может создавать только blogger или simple"
        )
    normalized = normalize_promo_code(code)
    if not normalized or len(normalized) < 4:
        raise HTTPException(status_code=400, detail="Код слишком короткий")

    existing = await get_promo_by_code(session, normalized)
    if existing is not None:
        raise HTTPException(status_code=409, detail="Промокод уже существует")

    promo = PromoCode(
        owner_user_id=None,
        code=normalized,
        type=promo_type,
        label=label,
        created_by_user_id=created_by_user_id,
    )
    session.add(promo)
    try:
        await session.flush()
    except IntegrityError as exc:
        await rollback_and_raise_integrity(
            session,
            exc,
            conflict_detail="Промокод уже существует",
            other_detail="Не удалось сохранить промокод",
        )
    return promo


async def list_admin_promo_codes(session: AsyncSession) -> list[dict]:
    r = await session.execute(
        select(PromoCode)
        .where(PromoCode.type.in_([PROMO_TYPE_BLOGGER, PROMO_TYPE_SIMPLE]))
        .order_by(PromoCode.created_at.desc())
    )
    promos = r.scalars().all()
    out: list[dict] = []
    for promo in promos:
        cnt = await session.execute(
            select(func.count())
            .select_from(PromoRedemption)
            .where(PromoRedemption.promo_code_id == promo.id)
        )
        out.append(
            {
                "id": promo.id,
                "code": promo.code,
                "type": promo.type,
                "label": promo.label,
                "created_at": promo.created_at,
                "redemption_count": int(cnt.scalar_one() or 0),
            }
        )
    return out
