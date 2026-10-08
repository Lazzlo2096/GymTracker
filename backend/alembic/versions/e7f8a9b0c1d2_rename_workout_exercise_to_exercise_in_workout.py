"""rename workout_exercise table and exercise_id column

Revision ID: e7f8a9b0c1d2
Revises: d4e5f6a7b8c9
Create Date: 2026-04-29

"""

from alembic import op
import sqlalchemy as sa

revision = "e7f8a9b0c1d2"
down_revision = "d4e5f6a7b8c9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    tables = set(insp.get_table_names())

    if "workout_exercise" in tables and "exercise_in_workout" not in tables:
        op.rename_table("workout_exercise", "exercise_in_workout")

    insp = sa.inspect(conn)
    tables = set(insp.get_table_names())
    if "exercise_in_workout" not in tables:
        return

    cols = {c["name"] for c in insp.get_columns("exercise_in_workout")}
    if "exercise_id" in cols and "exercise_in_catalog_id" not in cols:
        op.alter_column(
            "exercise_in_workout",
            "exercise_id",
            new_column_name="exercise_in_catalog_id",
        )


def downgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    tables = set(insp.get_table_names())

    if "exercise_in_workout" in tables:
        cols = {c["name"] for c in insp.get_columns("exercise_in_workout")}
        if "exercise_in_catalog_id" in cols and "exercise_id" not in cols:
            op.alter_column(
                "exercise_in_workout",
                "exercise_in_catalog_id",
                new_column_name="exercise_id",
            )

    insp = sa.inspect(conn)
    tables = set(insp.get_table_names())
    if "exercise_in_workout" in tables and "workout_exercise" not in tables:
        op.rename_table("exercise_in_workout", "workout_exercise")
