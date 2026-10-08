"""exercise_in_workout.inline_name — имя упражнения без записи в каталоге.

Revision ID: x1y2z3a4b5c6
Revises: w0x1y2z3a4b5
Create Date: 2026-06-16

"""

from alembic import op
import sqlalchemy as sa

revision = "x1y2z3a4b5c6"
down_revision = "w0x1y2z3a4b5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    cols = {c["name"] for c in insp.get_columns("exercise_in_workout")}
    if "inline_name" not in cols:
        op.add_column(
            "exercise_in_workout",
            sa.Column("inline_name", sa.String(length=256), nullable=True),
        )


def downgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    cols = {c["name"] for c in insp.get_columns("exercise_in_workout")}
    if "inline_name" in cols:
        op.drop_column("exercise_in_workout", "inline_name")
