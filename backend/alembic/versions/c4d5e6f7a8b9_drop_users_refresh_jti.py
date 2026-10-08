"""drop users.refresh_jti

Сессии refresh живут в user_refresh_sessions
(миграция h8i9j0k1l2m3 уже перенесла старые jti).

Revision ID: c4d5e6f7a8b9
Revises: v1w2x3y4z5a6
Create Date: 2026-10-08

"""

from alembic import op
import sqlalchemy as sa

revision = "c4d5e6f7a8b9"
down_revision = "v1w2x3y4z5a6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_index(op.f("ix_users_refresh_jti"), table_name="users")
    op.drop_column("users", "refresh_jti")


def downgrade() -> None:
    op.add_column("users", sa.Column("refresh_jti", sa.String(), nullable=True))
    op.create_index(
        op.f("ix_users_refresh_jti"), "users", ["refresh_jti"], unique=False
    )
