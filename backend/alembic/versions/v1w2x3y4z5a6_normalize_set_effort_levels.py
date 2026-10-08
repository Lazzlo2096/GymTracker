"""normalize legacy set effort_level values

Revision ID: v1w2x3y4z5a6
Revises: b5c6d7e8f9a0
Create Date: 2026-06-25

"""

from alembic import op
import sqlalchemy as sa

revision = "v1w2x3y4z5a6"
down_revision = "b5c6d7e8f9a0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        sa.text(
            """
            UPDATE exercise_in_workout AS we
            SET sets_json = normalized.sets_json
            FROM (
                SELECT
                    id,
                    jsonb_agg(
                        CASE
                            WHEN item->>'type' = 'set'
                                AND item->>'effort_level' = 'самое то'
                            THEN jsonb_set(
                                item,
                                '{effort_level}',
                                to_jsonb('отлично'::text),
                                false
                            )
                            WHEN item->>'type' = 'set'
                                AND item->>'effort_level' = 'больше точно не надо'
                            THEN jsonb_set(
                                item,
                                '{effort_level}',
                                to_jsonb('на грани'::text),
                                false
                            )
                            ELSE item
                        END
                        ORDER BY ordinality
                    ) AS sets_json
                FROM exercise_in_workout
                CROSS JOIN LATERAL jsonb_array_elements(sets_json)
                    WITH ORDINALITY AS entries(item, ordinality)
                WHERE sets_json @> '[{"effort_level": "самое то"}]'::jsonb
                    OR sets_json @> '[{"effort_level": "больше точно не надо"}]'::jsonb
                GROUP BY id
            ) AS normalized
            WHERE we.id = normalized.id
            """
        )
    )


def downgrade() -> None:
    pass
