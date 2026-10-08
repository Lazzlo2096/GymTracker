"""add optional weight_lbs to user_weights

Revision ID: b7c8d9e0f1a2
Revises: a91b2c3d4e5f
Create Date: 2026-04-22

"""

from alembic import op
import sqlalchemy as sa

revision = "b7c8d9e0f1a2"
down_revision = "a91b2c3d4e5f"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    table = "user_weights"
    cols = {c["name"] for c in insp.get_columns(table)}
    checks = {c["name"] for c in insp.get_check_constraints(table)}

    if "weight_lbs" not in cols:
        op.add_column(table, sa.Column("weight_lbs", sa.Numeric(6, 2), nullable=True))
    if "ck_user_weight_lbs_positive" not in checks:
        op.create_check_constraint(
            "ck_user_weight_lbs_positive",
            table,
            "weight_lbs IS NULL OR weight_lbs > 0",
        )


def downgrade() -> None:
    op.drop_constraint("ck_user_weight_lbs_positive", "user_weights", type_="check")
    op.drop_column("user_weights", "weight_lbs")
