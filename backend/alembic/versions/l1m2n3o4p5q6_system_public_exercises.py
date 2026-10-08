"""system_exercises, public_exercises, provenance на exercises_in_catalog (TGL-33).

Revision ID: l1m2n3o4p5q6
Revises: k0l1m2n3o4p5
Create Date: 2026-05-29

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "l1m2n3o4p5q6"
down_revision = "k0l1m2n3o4p5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "system_exercises",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("muscle_group", sa.String(length=128), nullable=True),
        sa.Column("machine_location", sa.Text(), nullable=True),
        sa.Column(
            "machine_settings", postgresql.JSONB(astext_type=sa.Text()), nullable=True
        ),
        sa.Column("icon", sa.String(length=64), nullable=True),
        sa.Column("image", sa.Text(), nullable=True),
        sa.Column(
            "is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")
        ),
        sa.Column(
            "sort_order", sa.Integer(), nullable=False, server_default=sa.text("0")
        ),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )

    op.create_table(
        "public_exercises",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("author_user_id", sa.Integer(), nullable=False),
        sa.Column("source_catalog_id", sa.Integer(), nullable=True),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("muscle_group", sa.String(length=128), nullable=True),
        sa.Column("machine_location", sa.Text(), nullable=True),
        sa.Column(
            "machine_settings", postgresql.JSONB(astext_type=sa.Text()), nullable=True
        ),
        sa.Column("icon", sa.String(length=64), nullable=True),
        sa.Column("image", sa.Text(), nullable=True),
        sa.Column(
            "is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")
        ),
        sa.Column(
            "published_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["author_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["source_catalog_id"], ["exercises_in_catalog.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_public_exercises_author_user_id", "public_exercises", ["author_user_id"]
    )
    op.create_index(
        "ix_public_exercises_published_at", "public_exercises", ["published_at"]
    )

    op.add_column(
        "exercises_in_catalog",
        sa.Column("source_system_exercise_id", sa.Integer(), nullable=True),
    )
    op.add_column(
        "exercises_in_catalog",
        sa.Column("source_public_exercise_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_exercises_in_catalog_source_system",
        "exercises_in_catalog",
        "system_exercises",
        ["source_system_exercise_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_exercises_in_catalog_source_public",
        "exercises_in_catalog",
        "public_exercises",
        ["source_public_exercise_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_exercises_in_catalog_source_public",
        "exercises_in_catalog",
        type_="foreignkey",
    )
    op.drop_constraint(
        "fk_exercises_in_catalog_source_system",
        "exercises_in_catalog",
        type_="foreignkey",
    )
    op.drop_column("exercises_in_catalog", "source_public_exercise_id")
    op.drop_column("exercises_in_catalog", "source_system_exercise_id")
    op.drop_index("ix_public_exercises_published_at", table_name="public_exercises")
    op.drop_index("ix_public_exercises_author_user_id", table_name="public_exercises")
    op.drop_table("public_exercises")
    op.drop_table("system_exercises")
