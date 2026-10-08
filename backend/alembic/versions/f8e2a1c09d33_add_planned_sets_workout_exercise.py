"""add planned_sets to workout_exercise

Revision ID: f8e2a1c09d33
Revises: 7d6f4a9c1b12
Create Date: 2026-03-22

"""

from alembic import op
import sqlalchemy as sa

revision = "f8e2a1c09d33"
down_revision = "7d6f4a9c1b12"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "workout_exercise",
        sa.Column("planned_sets", sa.Integer(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("workout_exercise", "planned_sets")
