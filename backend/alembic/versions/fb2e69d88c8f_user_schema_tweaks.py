"""Комментарии users.password_hash/refresh_jti и тип age_years.

Revision ID: fb2e69d88c8f
Revises: c3e4f5a6b7c8

Индекс ix_users_display_name не трогаем — он уже в 7d6f4a9c1b12_make_display_name_unique.

Если в каталоге остался второй файл с тем же revision (например autogenerate под root),
удалите дубликат, иначе Alembic увидит две ревизии fb2e69d88c8f.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "fb2e69d88c8f"
down_revision: Union[str, Sequence[str], None] = "c3e4f5a6b7c8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "users",
        "password_hash",
        existing_type=sa.VARCHAR(),
        comment="Хеш пароля (AuthX). Для старых записей может быть NULL",
        existing_comment="Только для legacy-пользователей; Keycloak-пользователи — NULL",
        existing_nullable=True,
    )
    op.alter_column(
        "users",
        "refresh_jti",
        existing_type=sa.VARCHAR(),
        comment="Последний refresh token jti для ротации",
        existing_nullable=True,
    )
    op.alter_column(
        "users",
        "age_years",
        existing_type=sa.SMALLINT(),
        type_=sa.Integer(),
        existing_nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "users",
        "age_years",
        existing_type=sa.Integer(),
        type_=sa.SMALLINT(),
        existing_nullable=True,
    )
    op.alter_column(
        "users",
        "refresh_jti",
        existing_type=sa.VARCHAR(),
        comment=None,
        existing_comment="Последний refresh token jti для ротации",
        existing_nullable=True,
    )
    op.alter_column(
        "users",
        "password_hash",
        existing_type=sa.VARCHAR(),
        comment="Только для legacy-пользователей; Keycloak-пользователи — NULL",
        existing_comment="Хеш пароля (AuthX). Для старых записей может быть NULL",
        existing_nullable=True,
    )
