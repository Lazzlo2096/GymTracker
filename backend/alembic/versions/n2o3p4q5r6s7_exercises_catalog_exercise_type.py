"""exercises_in_catalog: exercise_type (TGL-36)

Revision ID: n2o3p4q5r6s7
Revises: m1n2o3p4q5r6
Create Date: 2026-05-30

"""

from alembic import op
import sqlalchemy as sa

revision = "n2o3p4q5r6s7"
down_revision = "m1n2o3p4q5r6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    table = "exercises_in_catalog"
    cols = {c["name"] for c in insp.get_columns(table)}
    if "exercise_type" not in cols:
        op.add_column(
            table,
            sa.Column("exercise_type", sa.String(length=32), nullable=True),
        )


def downgrade() -> None:
    op.drop_column("exercises_in_catalog", "exercise_type")
