"""exercises_in_catalog.is_archived — мягкая архивация вместо hard delete.

Revision ID: w0x1y2z3a4b5
Revises: u8v9w0x1y2z3
Create Date: 2026-06-16

"""

from alembic import op
import sqlalchemy as sa

revision = "w0x1y2z3a4b5"
down_revision = "u8v9w0x1y2z3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    cols = {c["name"] for c in insp.get_columns("exercises_in_catalog")}
    if "is_archived" not in cols:
        op.add_column(
            "exercises_in_catalog",
            sa.Column(
                "is_archived",
                sa.Boolean(),
                nullable=False,
                server_default=sa.text("false"),
            ),
        )


def downgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    cols = {c["name"] for c in insp.get_columns("exercises_in_catalog")}
    if "is_archived" in cols:
        op.drop_column("exercises_in_catalog", "is_archived")
