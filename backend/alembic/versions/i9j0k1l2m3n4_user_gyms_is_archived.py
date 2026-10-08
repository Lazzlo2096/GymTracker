"""user_gyms.is_archived — мягкое скрытие зала без удаления из БД.

Revision ID: i9j0k1l2m3n4
Revises: h8i9j0k1l2m3
Create Date: 2026-05-26

"""

from alembic import op
import sqlalchemy as sa

revision = "i9j0k1l2m3n4"
down_revision = "h8i9j0k1l2m3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    cols = {c["name"] for c in insp.get_columns("user_gyms")}
    if "is_archived" not in cols:
        op.add_column(
            "user_gyms",
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
    cols = {c["name"] for c in insp.get_columns("user_gyms")}
    if "is_archived" in cols:
        op.drop_column("user_gyms", "is_archived")
