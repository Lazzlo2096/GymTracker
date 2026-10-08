"""add machine_location to exercises_in_catalog

Revision ID: c2d3e4f5a6b7
Revises: b7c8d9e0f1a2
Create Date: 2026-04-22

"""

from alembic import op
import sqlalchemy as sa

revision = "c2d3e4f5a6b7"
down_revision = "b7c8d9e0f1a2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    cols = {c["name"] for c in insp.get_columns("exercises_in_catalog")}
    if "machine_location" not in cols:
        op.add_column(
            "exercises_in_catalog",
            sa.Column("machine_location", sa.Text(), nullable=True),
        )


def downgrade() -> None:
    op.drop_column("exercises_in_catalog", "machine_location")
