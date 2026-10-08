"""exercises_in_catalog: muscle_group, icon, image (optional text)

Revision ID: d7e8f9a0b1c2
Revises: c1a2b3c4d5e6
Create Date: 2026-04-18

"""

from alembic import op
import sqlalchemy as sa

revision = "d7e8f9a0b1c2"
down_revision = "c1a2b3c4d5e6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    table = "exercises_in_catalog"
    cols = {c["name"] for c in insp.get_columns(table)}

    if "muscle_group" not in cols:
        op.add_column(table, sa.Column("muscle_group", sa.Text(), nullable=True))
    if "icon" not in cols:
        op.add_column(table, sa.Column("icon", sa.Text(), nullable=True))
    if "image" not in cols:
        op.add_column(table, sa.Column("image", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("exercises_in_catalog", "image")
    op.drop_column("exercises_in_catalog", "icon")
    op.drop_column("exercises_in_catalog", "muscle_group")
