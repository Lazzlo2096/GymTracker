"""exercises_in_catalog: user_id, unique (user_id, name)

Revision ID: c1a2b3c4d5e6
Revises: b4c8e0a1d2f3
Create Date: 2026-04-11

"""

from alembic import op
import sqlalchemy as sa

revision = "c1a2b3c4d5e6"
down_revision = "b4c8e0a1d2f3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    table = "exercises_in_catalog"
    cols = {c["name"] for c in insp.get_columns(table)}

    if "user_id" not in cols:
        op.add_column(
            table,
            sa.Column("user_id", sa.Integer(), nullable=True),
        )
        op.create_foreign_key(
            "fk_exercises_in_catalog_user_id_users",
            table,
            "users",
            ["user_id"],
            ["id"],
            ondelete="CASCADE",
        )

    n_users = conn.execute(sa.text("SELECT COUNT(*) FROM users")).scalar() or 0
    if n_users > 0:
        op.execute(sa.text(f"""
                UPDATE {table} AS e
                SET user_id = s.id
                FROM (SELECT id FROM users ORDER BY id ASC LIMIT 1) AS s
                WHERE e.user_id IS NULL
                """))
    else:
        op.execute(sa.text(f"DELETE FROM {table}"))

    op.alter_column(table, "user_id", existing_type=sa.Integer(), nullable=False)

    insp_uq = sa.inspect(conn)
    uq_names = {u["name"] for u in insp_uq.get_unique_constraints(table)}
    if "uq_exercise_catalog_name" in uq_names:
        op.drop_constraint("uq_exercise_catalog_name", table, type_="unique")

    insp_uq2 = sa.inspect(conn)
    uq_names2 = {u["name"] for u in insp_uq2.get_unique_constraints(table)}
    if "uq_exercise_catalog_user_name" not in uq_names2:
        op.create_unique_constraint(
            "uq_exercise_catalog_user_name",
            table,
            ["user_id", "name"],
        )

    insp_ix = sa.inspect(conn)
    ix_names = {i["name"] for i in insp_ix.get_indexes(table)}
    if "ix_exercises_in_catalog_user_id" not in ix_names:
        op.create_index("ix_exercises_in_catalog_user_id", table, ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_exercises_in_catalog_user_id", table_name="exercises_in_catalog")
    op.drop_constraint(
        "uq_exercise_catalog_user_name",
        "exercises_in_catalog",
        type_="unique",
    )
    op.create_unique_constraint(
        "uq_exercise_catalog_name",
        "exercises_in_catalog",
        ["name"],
    )
    op.drop_constraint(
        "fk_exercises_in_catalog_user_id_users",
        "exercises_in_catalog",
        type_="foreignkey",
    )
    op.drop_column("exercises_in_catalog", "user_id")
