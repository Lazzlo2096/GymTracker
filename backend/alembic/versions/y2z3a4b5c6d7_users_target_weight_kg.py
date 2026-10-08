"""users: целевой вес target_weight_kg

Revision ID: y2z3a4b5c6d7
Revises: x1y2z3a4b5c6
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "y2z3a4b5c6d7"
down_revision: Union[str, Sequence[str], None] = "x1y2z3a4b5c6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    cols = {c["name"] for c in insp.get_columns("users")}
    if "target_weight_kg" not in cols:
        op.add_column(
            "users", sa.Column("target_weight_kg", sa.Integer(), nullable=True)
        )


def downgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    cols = {c["name"] for c in insp.get_columns("users")}
    if "target_weight_kg" in cols:
        op.drop_column("users", "target_weight_kg")
