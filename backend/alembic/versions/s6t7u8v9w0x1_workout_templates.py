"""workout_templates + workout_template_exercises

Revision ID: s6t7u8v9w0x1
Revises: r5s6t7u8v9w0
Create Date: 2026-06-13

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "s6t7u8v9w0x1"
down_revision = "r5s6t7u8v9w0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    tables = set(insp.get_table_names())

    if "workout_templates" not in tables:
        op.create_table(
            "workout_templates",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("title", sa.String(length=256), nullable=False),
            sa.Column("description", sa.String(length=512), nullable=True),
            sa.Column("note", sa.Text(), nullable=True),
            sa.Column("user_gym_id", sa.Integer(), nullable=True),
            sa.Column("estimated_minutes", sa.Integer(), nullable=True),
            sa.Column("last_used_at", sa.TIMESTAMP(timezone=True), nullable=True),
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
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(
                ["user_gym_id"], ["user_gyms.id"], ondelete="SET NULL"
            ),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(
            "ix_workout_templates_user_id", "workout_templates", ["user_id"]
        )
        op.create_index(
            "ix_workout_templates_user_gym_id", "workout_templates", ["user_gym_id"]
        )

    if "workout_template_exercises" not in tables:
        op.create_table(
            "workout_template_exercises",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("workout_template_id", sa.Integer(), nullable=False),
            sa.Column("order_index", sa.Integer(), nullable=False),
            sa.Column("exercise_in_catalog_id", sa.Integer(), nullable=True),
            sa.Column("title_override", sa.String(length=256), nullable=True),
            sa.Column("muscle_group", sa.String(length=128), nullable=True),
            sa.Column("note", sa.Text(), nullable=True),
            sa.Column("planned_sets_count", sa.Integer(), nullable=True),
            sa.Column("planned_tonnage_kg", sa.Float(), nullable=True),
            sa.Column(
                "planned_sets_json",
                postgresql.JSONB(astext_type=sa.Text()),
                server_default=sa.text("'[]'::jsonb"),
                nullable=False,
            ),
            sa.Column(
                "created_at",
                sa.TIMESTAMP(timezone=True),
                server_default=sa.text("now()"),
                nullable=False,
            ),
            sa.ForeignKeyConstraint(
                ["workout_template_id"], ["workout_templates.id"], ondelete="CASCADE"
            ),
            sa.ForeignKeyConstraint(
                ["exercise_in_catalog_id"],
                ["exercises_in_catalog.id"],
                ondelete="SET NULL",
            ),
            sa.PrimaryKeyConstraint("id"),
            sa.CheckConstraint(
                "jsonb_typeof(planned_sets_json) = 'array'",
                name="ck_wte_planned_sets_is_array",
            ),
            sa.CheckConstraint(
                "exercise_in_catalog_id IS NOT NULL OR title_override IS NOT NULL",
                name="ck_wte_catalog_or_title",
            ),
        )
        op.create_index(
            "ix_wte_template_order",
            "workout_template_exercises",
            ["workout_template_id", "order_index"],
        )


def downgrade() -> None:
    op.drop_index("ix_wte_template_order", table_name="workout_template_exercises")
    op.drop_table("workout_template_exercises")
    op.drop_index("ix_workout_templates_user_gym_id", table_name="workout_templates")
    op.drop_index("ix_workout_templates_user_id", table_name="workout_templates")
    op.drop_table("workout_templates")
