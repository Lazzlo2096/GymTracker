"""Таблицы feature_ideas и feature_ideas_likes.

Revision ID: j0k1l2m3n4o5
Revises: i9j0k1l2m3n4
Create Date: 2026-05-26

"""

from alembic import op
import sqlalchemy as sa

revision = "j0k1l2m3n4o5"
down_revision = "i9j0k1l2m3n4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "feature_ideas",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("author_user_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=256), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("icon_key", sa.String(length=64), nullable=True),
        sa.Column(
            "is_approved",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column(
            "status",
            sa.String(length=32),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["author_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_feature_ideas_approved_created",
        "feature_ideas",
        ["is_approved", "created_at"],
    )
    op.create_index("ix_feature_ideas_author", "feature_ideas", ["author_user_id"])

    op.create_table(
        "feature_ideas_likes",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("idea_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["idea_id"], ["feature_ideas.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "idea_id", "user_id", name="uq_feature_idea_like_idea_user"
        ),
    )
    op.create_index(
        "ix_feature_ideas_likes_idea_id",
        "feature_ideas_likes",
        ["idea_id"],
    )
    op.create_index(
        "ix_feature_ideas_likes_user_id",
        "feature_ideas_likes",
        ["user_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_feature_ideas_likes_user_id", table_name="feature_ideas_likes")
    op.drop_index("ix_feature_ideas_likes_idea_id", table_name="feature_ideas_likes")
    op.drop_table("feature_ideas_likes")
    op.drop_index("ix_feature_ideas_author", table_name="feature_ideas")
    op.drop_index("ix_feature_ideas_approved_created", table_name="feature_ideas")
    op.drop_table("feature_ideas")
