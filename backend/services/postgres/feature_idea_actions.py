"""Идеи и улучшения: отправка, публичный список, лайки."""

from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models.postgres.feature_idea import FeatureIdea
from db.models.postgres.feature_idea_like import FeatureIdeaLike
from db.models.postgres.feature_idea_status import FeatureIdeaStatus
from db.models.postgres.user import User as PgUser
from schemas.feature_idea import (
    FeatureIdeaCreate,
    FeatureIdeaCreateResponse,
    FeatureIdeaLikeToggleResponse,
    FeatureIdeaPublicOut,
    FeatureIdeaSort,
    FeatureIdeaStatusOut,
)


def _status_to_out(
    status: FeatureIdeaStatus | None,
) -> FeatureIdeaStatusOut | None:
    if status is None:
        return None
    if status == FeatureIdeaStatus.IN_DEVELOPMENT:
        return FeatureIdeaStatusOut.IN_DEVELOPMENT
    if status == FeatureIdeaStatus.ACCEPTED_TO_PLAN:
        return FeatureIdeaStatusOut.ACCEPTED_TO_PLAN
    return None


def _row_to_public(
    row: FeatureIdea,
    *,
    likes_count: int,
    liked_by_me: bool,
) -> FeatureIdeaPublicOut:
    return FeatureIdeaPublicOut(
        id=row.id,
        title=row.title,
        description=row.description,
        icon_key=row.icon_key,
        status=_status_to_out(row.status),
        likes_count=likes_count,
        liked_by_me=liked_by_me,
        created_at=row.created_at,
    )


async def postgres_create_feature_idea(
    session: AsyncSession,
    data: FeatureIdeaCreate,
    auth_user: PgUser,
) -> FeatureIdeaCreateResponse:
    """Новая идея на модерации (is_approved=False)."""
    row = FeatureIdea(
        author_user_id=auth_user.id,
        title=data.title.strip(),
        description=data.description.strip(),
        icon_key=(data.icon_key or "").strip() or None,
        is_approved=False,
        status=None,
    )
    session.add(row)
    await session.commit()
    await session.refresh(row)

    return FeatureIdeaCreateResponse(
        message="Идея отправлена на модерацию",
        id=row.id,
        is_approved=False,
    )


async def postgres_list_public_feature_ideas(
    session: AsyncSession,
    auth_user: PgUser,
    *,
    sort: FeatureIdeaSort = "new",
    limit: int = 100,
    offset: int = 0,
) -> list[FeatureIdeaPublicOut]:
    """Только одобренные идеи; автор не возвращается."""
    likes_count_sq = (
        select(
            FeatureIdeaLike.idea_id.label("idea_id"),
            func.count(FeatureIdeaLike.id).label("likes_count"),
        )
        .group_by(FeatureIdeaLike.idea_id)
        .subquery()
    )

    liked_exists = (
        select(FeatureIdeaLike.id)
        .where(
            FeatureIdeaLike.idea_id == FeatureIdea.id,
            FeatureIdeaLike.user_id == auth_user.id,
        )
        .correlate(FeatureIdea)
        .exists()
    )

    likes_count_col = func.coalesce(likes_count_sq.c.likes_count, 0).label(
        "likes_count"
    )

    stmt = (
        select(
            FeatureIdea,
            likes_count_col,
            liked_exists.label("liked_by_me"),
        )
        .outerjoin(likes_count_sq, FeatureIdea.id == likes_count_sq.c.idea_id)
        .where(FeatureIdea.is_approved.is_(True))
    )

    if sort == "popular":
        stmt = stmt.order_by(
            desc(likes_count_col),
            desc(FeatureIdea.created_at),
        )
    else:
        stmt = stmt.order_by(desc(FeatureIdea.created_at))

    if limit is not None:
        stmt = stmt.limit(min(limit, 500))
    if offset is not None:
        stmt = stmt.offset(max(offset, 0))

    result = await session.execute(stmt)
    rows = result.all()

    return [
        _row_to_public(
            idea,
            likes_count=int(lc or 0),
            liked_by_me=bool(liked),
        )
        for idea, lc, liked in rows
    ]


async def postgres_toggle_feature_idea_like(
    session: AsyncSession,
    idea_id: int,
    auth_user: PgUser,
) -> FeatureIdeaLikeToggleResponse:
    """Лайк / снять лайк (только для опубликованных идей)."""
    idea = await session.get(FeatureIdea, idea_id)
    if not idea or not idea.is_approved:
        raise HTTPException(status_code=404, detail="Идея не найдена")

    existing = await session.execute(
        select(FeatureIdeaLike).where(
            FeatureIdeaLike.idea_id == idea_id,
            FeatureIdeaLike.user_id == auth_user.id,
        )
    )
    like_row = existing.scalar_one_or_none()

    if like_row:
        await session.delete(like_row)
        liked = False
    else:
        session.add(FeatureIdeaLike(idea_id=idea_id, user_id=auth_user.id))
        liked = True

    await session.commit()

    count_result = await session.execute(
        select(func.count(FeatureIdeaLike.id)).where(FeatureIdeaLike.idea_id == idea_id)
    )
    likes_count = int(count_result.scalar_one() or 0)

    return FeatureIdeaLikeToggleResponse(
        liked_by_me=liked,
        likes_count=likes_count,
    )
