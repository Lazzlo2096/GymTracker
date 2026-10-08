"""exercise_in_workout: planned_sets_json

Revision ID: q4r5s6t7u8v9
Revises: p3q4r5s6t7u8
Create Date: 2026-06-08

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "q4r5s6t7u8v9"
down_revision = "p3q4r5s6t7u8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    table = "exercise_in_workout"
    cols = {c["name"] for c in insp.get_columns(table)}
    if "planned_sets_json" not in cols:
        op.add_column(
            table,
            sa.Column(
                "planned_sets_json",
                JSONB,
                nullable=False,
                server_default=sa.text("'[]'::jsonb"),
            ),
        )
        op.create_check_constraint(
            "ck_we_planned_sets_is_array",
            table,
            "jsonb_typeof(planned_sets_json) = 'array'",
        )


def downgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    table = "exercise_in_workout"
    cols = {c["name"] for c in insp.get_columns(table)}
    if "planned_sets_json" in cols:
        op.drop_constraint("ck_we_planned_sets_is_array", table, type_="check")
        op.drop_column(table, "planned_sets_json")
