"""unique (workout_id, order_index) on exercise_in_workout

Revision ID: f6a7b8c9d0e1
Revises: d5e6f7a8b9c0
Create Date: 2026-10-08

"""

from alembic import op

revision = "f6a7b8c9d0e1"
down_revision = "d5e6f7a8b9c0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Только тренировки, где порядок уже повторяется. Остальные order_index не трогаем.
    op.execute(
        """
        WITH dups AS (
            SELECT workout_id
            FROM exercise_in_workout
            GROUP BY workout_id, order_index
            HAVING COUNT(*) > 1
        ),
        ranked AS (
            SELECT e.id,
                   (ROW_NUMBER() OVER (
                       PARTITION BY e.workout_id
                       ORDER BY e.order_index, e.id
                   ) - 1) AS new_order
            FROM exercise_in_workout AS e
            WHERE e.workout_id IN (SELECT workout_id FROM dups)
        )
        UPDATE exercise_in_workout AS e
        SET order_index = ranked.new_order
        FROM ranked
        WHERE e.id = ranked.id
          AND e.order_index IS DISTINCT FROM ranked.new_order
        """
    )
    op.drop_index("ix_we_workout_order", table_name="exercise_in_workout")
    op.create_unique_constraint(
        "uq_we_workout_order",
        "exercise_in_workout",
        ["workout_id", "order_index"],
        deferrable=True,
        initially="DEFERRED",
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_we_workout_order", "exercise_in_workout", type_="unique"
    )
    op.create_index(
        "ix_we_workout_order",
        "exercise_in_workout",
        ["workout_id", "order_index"],
        unique=False,
    )
