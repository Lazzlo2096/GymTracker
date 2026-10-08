"""user_weights: убрать weight_lbs, добавить body_fat_percent.

Revision ID: b5c6d7e8f9a0
Revises: a4b5c6d7e8f9
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b5c6d7e8f9a0"
down_revision: Union[str, Sequence[str], None] = "a4b5c6d7e8f9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_TABLE = "user_weights"


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    cols = {c["name"] for c in insp.get_columns(_TABLE)}
    checks = {c["name"] for c in insp.get_check_constraints(_TABLE)}

    if "body_fat_percent" not in cols:
        op.add_column(
            _TABLE,
            sa.Column("body_fat_percent", sa.Numeric(4, 1), nullable=True),
        )
    if "ck_user_weight_body_fat_percent_range" not in checks:
        op.create_check_constraint(
            "ck_user_weight_body_fat_percent_range",
            _TABLE,
            "body_fat_percent IS NULL OR (body_fat_percent > 0 AND body_fat_percent <= 100)",
        )

    if "ck_user_weight_lbs_positive" in checks:
        op.drop_constraint("ck_user_weight_lbs_positive", _TABLE, type_="check")
    if "weight_lbs" in cols:
        op.drop_column(_TABLE, "weight_lbs")


def downgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    cols = {c["name"] for c in insp.get_columns(_TABLE)}
    checks = {c["name"] for c in insp.get_check_constraints(_TABLE)}

    if "weight_lbs" not in cols:
        op.add_column(_TABLE, sa.Column("weight_lbs", sa.Numeric(6, 2), nullable=True))
    if "ck_user_weight_lbs_positive" not in checks:
        op.create_check_constraint(
            "ck_user_weight_lbs_positive",
            _TABLE,
            "weight_lbs IS NULL OR weight_lbs > 0",
        )

    if "ck_user_weight_body_fat_percent_range" in checks:
        op.drop_constraint(
            "ck_user_weight_body_fat_percent_range", _TABLE, type_="check"
        )
    if "body_fat_percent" in cols:
        op.drop_column(_TABLE, "body_fat_percent")
