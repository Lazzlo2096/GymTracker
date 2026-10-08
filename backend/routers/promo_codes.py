"""API промокодов (рефералка, блогеры, простые)."""

from typing import Annotated

from fastapi import APIRouter, Depends

from db.models.postgres import User
from dependencies.admin import require_admin
from dependencies.auth import get_current_user
from dependencies.db_session import db_session
from schemas.promo_code import (
    PromoAdminCreate,
    PromoAdminOut,
    PromoMeOut,
    PromoRedeemRequest,
    PromoRedeemResponse,
    PromoResolveOut,
)
from services.postgres.promo_actions import (
    create_promo_code_admin,
    get_my_promo_dashboard,
    list_admin_promo_codes,
    redeem_promo_code,
    resolve_promo_code,
)

router = APIRouter(prefix="/promo-codes", tags=["promo_codes"])


@router.get("/me", response_model=PromoMeOut)
async def promo_me(
    session: db_session,
    auth_user: Annotated[User, Depends(get_current_user)],
):
    dash = await get_my_promo_dashboard(session, auth_user)
    await session.commit()
    s = dash.stats
    return PromoMeOut(
        code=dash.code,
        register_url=dash.register_url,
        stats={
            "invited_total": s.invited_total,
            "milestone_completed": s.milestone_completed,
            "in_progress": s.in_progress,
            "rewards_earned": s.rewards_earned,
            "milestone_kg": s.milestone_kg,
        },
        invitees=[
            {
                "display_name": i.display_name,
                "status": i.status,
                "tonnage_kg": i.tonnage_kg,
                "milestone_kg": i.milestone_kg,
                "progress_percent": i.progress_percent,
            }
            for i in dash.invitees
        ],
    )


@router.post("/redeem", response_model=PromoRedeemResponse)
async def promo_redeem(
    body: PromoRedeemRequest,
    session: db_session,
    auth_user: Annotated[User, Depends(get_current_user)],
):
    result = await redeem_promo_code(
        session, code=body.code, redeemer=auth_user, context="authenticated"
    )
    await session.commit()
    msg = "Промокод активирован"
    if result.premium_days_granted:
        msg = f"Premium продлён на {result.premium_days_granted} дней"
    return PromoRedeemResponse(
        promo_type=result.promo_type,
        premium_days_granted=result.premium_days_granted,
        message=msg,
    )


@router.get("/resolve/{code}", response_model=PromoResolveOut)
async def promo_resolve(code: str, session: db_session):
    data = await resolve_promo_code(session, code)
    return PromoResolveOut(**data)


@router.post("/", response_model=PromoAdminOut, status_code=201)
async def promo_admin_create(
    body: PromoAdminCreate,
    session: db_session,
    admin: Annotated[User, Depends(require_admin)],
):
    promo = await create_promo_code_admin(
        session,
        code=body.code,
        promo_type=body.type,
        label=body.label,
        created_by_user_id=admin.id,
    )
    await session.commit()
    return PromoAdminOut(
        id=promo.id,
        code=promo.code,
        type=promo.type,
        label=promo.label,
        created_at=promo.created_at,
        redemption_count=0,
    )


@router.get("/", response_model=list[PromoAdminOut])
async def promo_admin_list(
    session: db_session,
    _: Annotated[User, Depends(require_admin)],
):
    rows = await list_admin_promo_codes(session)
    return [PromoAdminOut(**r) for r in rows]
