"""exercises_in_catalog: user_gym_id

Revision ID: p3q4r5s6t7u8
Revises: n2o3p4q5r6s7
Create Date: 2026-06-02

"""

from alembic import op
import sqlalchemy as sa

revision = "p3q4r5s6t7u8"
down_revision = "n2o3p4q5r6s7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    table = "exercises_in_catalog"
    cols = {c["name"] for c in insp.get_columns(table)}
    if "user_gym_id" not in cols:
        op.add_column(
            table,
            sa.Column("user_gym_id", sa.Integer(), nullable=True),
        )
        op.create_index(
            "ix_exercises_in_catalog_user_gym_id",
            table,
            ["user_gym_id"],
            unique=False,
        )
        op.create_foreign_key(
            "fk_exercises_in_catalog_user_gym_id",
            table,
            "user_gyms",
            ["user_gym_id"],
            ["id"],
            ondelete="SET NULL",
        )


def downgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    table = "exercises_in_catalog"
    cols = {c["name"] for c in insp.get_columns(table)}
    if "user_gym_id" in cols:
        op.drop_constraint(
            "fk_exercises_in_catalog_user_gym_id", table, type_="foreignkey"
        )
        op.drop_index("ix_exercises_in_catalog_user_gym_id", table_name=table)
        op.drop_column(table, "user_gym_id")
