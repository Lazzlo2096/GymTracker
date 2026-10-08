"""drop workouts.location (место только через user_gym)

Revision ID: a9e8f7d6c5b4
Revises: f1a2b3c4d5e6
Create Date: 2026-05-03

"""

from alembic import op

revision = "a9e8f7d6c5b4"
down_revision = "f1a2b3c4d5e6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_column("workouts", "location")


def downgrade() -> None:
    import sqlalchemy as sa

    op.add_column(
        "workouts",
        sa.Column("location", sa.String(), nullable=True),
    )
