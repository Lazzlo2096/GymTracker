"""password_hash comment: argon2, not AuthX

Revision ID: d5e6f7a8b9c0
Revises: c4d5e6f7a8b9
Create Date: 2026-10-08

"""

from alembic import op
import sqlalchemy as sa

revision = "d5e6f7a8b9c0"
down_revision = "c4d5e6f7a8b9"
branch_labels = None
depends_on = None

_ARGON2 = "Хеш пароля (argon2). Для старых записей может быть NULL"
_AUTHX = "Хеш пароля (AuthX). Для старых записей может быть NULL"


def upgrade() -> None:
    op.alter_column(
        "users",
        "password_hash",
        existing_type=sa.VARCHAR(),
        comment=_ARGON2,
        existing_comment=_AUTHX,
        existing_nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "users",
        "password_hash",
        existing_type=sa.VARCHAR(),
        comment=_AUTHX,
        existing_comment=_ARGON2,
        existing_nullable=True,
    )
