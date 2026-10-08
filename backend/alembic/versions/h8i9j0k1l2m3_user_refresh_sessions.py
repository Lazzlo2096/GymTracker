"""user_refresh_sessions: несколько refresh-сессий на пользователя

Revision ID: h8i9j0k1l2m3
Revises: g7h8i9j0k1l2
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "h8i9j0k1l2m3"
down_revision: Union[str, Sequence[str], None] = "g7h8i9j0k1l2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    if sa.inspect(bind).has_table("user_refresh_sessions"):
        return

    op.create_table(
        "user_refresh_sessions",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("jti", sa.String(length=64), nullable=False),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "last_used_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("jti"),
    )
    op.create_index(
        op.f("ix_user_refresh_sessions_user_id"),
        "user_refresh_sessions",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_user_refresh_sessions_jti"),
        "user_refresh_sessions",
        ["jti"],
        unique=True,
    )

    op.execute(sa.text("""
            INSERT INTO user_refresh_sessions (user_id, jti, created_at, last_used_at)
            SELECT id, refresh_jti, now(), now()
            FROM users
            WHERE refresh_jti IS NOT NULL
        """))


def downgrade() -> None:
    op.drop_index(
        op.f("ix_user_refresh_sessions_jti"), table_name="user_refresh_sessions"
    )
    op.drop_index(
        op.f("ix_user_refresh_sessions_user_id"), table_name="user_refresh_sessions"
    )
    op.drop_table("user_refresh_sessions")
