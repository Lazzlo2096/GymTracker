"""add machine_settings to exercises_in_catalog

Revision ID: d4e5f6a7b8c9
Revises: c2d3e4f5a6b7
Create Date: 2026-04-22

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "d4e5f6a7b8c9"
down_revision = "c2d3e4f5a6b7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    cols = {c["name"] for c in insp.get_columns("exercises_in_catalog")}
    if "machine_settings" not in cols:
        op.add_column(
            "exercises_in_catalog",
            sa.Column(
                "machine_settings",
                postgresql.JSONB(astext_type=sa.Text()),
                nullable=True,
            ),
        )


def downgrade() -> None:
    op.drop_column("exercises_in_catalog", "machine_settings")
