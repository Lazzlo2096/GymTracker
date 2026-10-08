"""API идей и улучшений (предложить идею, голосование)."""

from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query, status

from db.models.postgres import User
from dependencies.auth import get_current_user
from dependencies.db_session import db_session
from schemas.feature_idea import (
    FeatureIdeaCreate,
    FeatureIdeaCreateResponse,
    FeatureIdeaLikeToggleResponse,
    FeatureIdeaPublicOut,
    FeatureIdeaSort,
)
from services.postgres.feature_idea_actions import (
    postgres_create_feature_idea,
    postgres_list_public_feature_ideas,
    postgres_toggle_feature_idea_like,
)

router = APIRouter(prefix="/feature_ideas", tags=["feature_ideas"])


@router.post(
    "/",
    response_model=FeatureIdeaCreateResponse,
    status_code=status.HTTP_201_CREATED,
)
async def submit_feature_idea(
    body: FeatureIdeaCreate,
    session: db_session,
    auth_user: Annotated[User, Depends(get_current_user)],
):
    """
    Предложить идею. Публикация после `is_approved = true` в БД (модерация вручную).
    Автор сохраняется в `feature_ideas.author_user_id`, в публичном API не отдаётся.
    """
    return await postgres_create_feature_idea(session, body, auth_user)


@router.get("/", response_model=list[FeatureIdeaPublicOut])
async def list_public_feature_ideas(
    session: db_session,
    auth_user: Annotated[User, Depends(get_current_user)],
    sort: Annotated[
        FeatureIdeaSort,
        Query(description="new — по дате; popular — по числу лайков"),
    ] = "new",
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
):
    """
    Список опубликованных идей (`is_approved = true`).

    Без автора; `liked_by_me` — лайк текущего пользователя.
    `status`: in_development | accepted_to_plan | null (без чипа).
    """
    return await postgres_list_public_feature_ideas(
        session,
        auth_user,
        sort=sort,
        limit=limit,
        offset=offset,
    )


@router.post(
    "/{idea_id}/toggle_like",
    response_model=FeatureIdeaLikeToggleResponse,
)
async def toggle_feature_idea_like(
    idea_id: Annotated[int, Path(ge=1)],
    session: db_session,
    auth_user: Annotated[User, Depends(get_current_user)],
):
    """
    Поставить или убрать лайк. Список кто лайкнул — только в `feature_ideas_likes`, наружу не отдаётся.
    """
    return await postgres_toggle_feature_idea_like(session, idea_id, auth_user)
