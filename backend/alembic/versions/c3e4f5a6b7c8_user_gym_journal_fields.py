"""Поля журнала зала: избранное, рейтинг, отзыв, дата визита, теги, галерея.

Revision ID: c3e4f5a6b7c8
Revises: b2c3d4e5f6a7
Create Date: 2026-05-04

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "c3e4f5a6b7c8"
down_revision = "b2c3d4e5f6a7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    cols = {c["name"] for c in insp.get_columns("user_gyms")}

    if "is_favorite" not in cols:
        op.add_column(
            "user_gyms",
            sa.Column(
                "is_favorite",
                sa.Boolean(),
                nullable=False,
                server_default=sa.text("false"),
            ),
        )
    if "rating" not in cols:
        op.add_column(
            "user_gyms", sa.Column("rating", sa.SmallInteger(), nullable=True)
        )
    if "review_text" not in cols:
        op.add_column("user_gyms", sa.Column("review_text", sa.Text(), nullable=True))
    if "review_updated_at" not in cols:
        op.add_column(
            "user_gyms",
            sa.Column("review_updated_at", sa.TIMESTAMP(timezone=True), nullable=True),
        )
    if "last_visited_at" not in cols:
        op.add_column(
            "user_gyms",
            sa.Column("last_visited_at", sa.TIMESTAMP(timezone=True), nullable=True),
        )
    if "tags" not in cols:
        op.add_column(
            "user_gyms",
            sa.Column(
                "tags",
                postgresql.JSONB(astext_type=sa.Text()),
                nullable=False,
                server_default=sa.text("'[]'::jsonb"),
            ),
        )
    if "gallery_urls" not in cols:
        op.add_column(
            "user_gyms",
            sa.Column(
                "gallery_urls",
                postgresql.JSONB(astext_type=sa.Text()),
                nullable=False,
                server_default=sa.text("'[]'::jsonb"),
            ),
        )


def downgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    cols = {c["name"] for c in insp.get_columns("user_gyms")}
    for name in (
        "gallery_urls",
        "tags",
        "last_visited_at",
        "review_updated_at",
        "review_text",
        "rating",
        "is_favorite",
    ):
        if name in cols:
            op.drop_column("user_gyms", name)
