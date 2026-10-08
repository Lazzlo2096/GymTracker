"""workout_template_exercises: planned_all_* aggregate fields

Revision ID: t7u8v9w0x1y2
Revises: s6t7u8v9w0x1
Create Date: 2026-06-13

"""

from alembic import op
import sqlalchemy as sa

revision = "t7u8v9w0x1y2"
down_revision = "s6t7u8v9w0x1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    cols = {c["name"] for c in insp.get_columns("workout_template_exercises")}

    if "planned_all_reps" not in cols:
        op.add_column(
            "workout_template_exercises",
            sa.Column("planned_all_reps", sa.Integer(), nullable=True),
        )
    if "planned_all_weight_kg" not in cols:
        op.add_column(
            "workout_template_exercises",
            sa.Column("planned_all_weight_kg", sa.Float(), nullable=True),
        )
    if "planned_all_rest_seconds" not in cols:
        op.add_column(
            "workout_template_exercises",
            sa.Column("planned_all_rest_seconds", sa.Integer(), nullable=True),
        )


def downgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    cols = {c["name"] for c in insp.get_columns("workout_template_exercises")}

    if "planned_all_rest_seconds" in cols:
        op.drop_column("workout_template_exercises", "planned_all_rest_seconds")
    if "planned_all_weight_kg" in cols:
        op.drop_column("workout_template_exercises", "planned_all_weight_kg")
    if "planned_all_reps" in cols:
        op.drop_column("workout_template_exercises", "planned_all_reps")
