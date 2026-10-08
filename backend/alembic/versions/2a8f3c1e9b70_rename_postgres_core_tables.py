"""rename postgres core tables (catalog, user weights, workouts)

Revision ID: 2a8f3c1e9b70
Revises: f8e2a1c09d33
Create Date: 2026-03-22

"""

from alembic import op

revision = "2a8f3c1e9b70"
down_revision = "f8e2a1c09d33"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.rename_table("exercise_catalog", "exercises_in_catalog")
    op.rename_table("user_weight", "user_weights")
    op.rename_table("workout", "workouts")


def downgrade() -> None:
    op.rename_table("workouts", "workout")
    op.rename_table("user_weights", "user_weight")
    op.rename_table("exercises_in_catalog", "exercise_catalog")
