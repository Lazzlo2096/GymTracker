"""Переименовать user_gym_data в user_fitness_data (для БД после старой z3).

Revision ID: a4b5c6d7e8f9
Revises: z3a4b5c6d7e8
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a4b5c6d7e8f9"
down_revision: Union[str, Sequence[str], None] = "z3a4b5c6d7e8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())
    tables = insp.get_table_names()
    if "user_gym_data" in tables and "user_fitness_data" not in tables:
        op.rename_table("user_gym_data", "user_fitness_data")


def downgrade() -> None:
    insp = sa.inspect(op.get_bind())
    tables = insp.get_table_names()
    if "user_fitness_data" in tables and "user_gym_data" not in tables:
        op.rename_table("user_fitness_data", "user_gym_data")
