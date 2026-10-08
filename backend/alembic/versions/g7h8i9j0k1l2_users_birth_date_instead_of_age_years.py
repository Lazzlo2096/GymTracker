"""users: дата рождения вместо age_years

Revision ID: g7h8i9j0k1l2
Revises: fb2e69d88c8f
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "g7h8i9j0k1l2"
down_revision: Union[str, Sequence[str], None] = "fb2e69d88c8f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("birth_date", sa.Date(), nullable=True))
    # Приблизительный перенос: «сегодня минус N лет» (день/месяц как у текущей даты).
    op.execute(sa.text("""
            UPDATE users
            SET birth_date = (CURRENT_DATE - (age_years * INTERVAL '1 year'))::date
            WHERE age_years IS NOT NULL
        """))
    op.drop_column("users", "age_years")


def downgrade() -> None:
    op.add_column("users", sa.Column("age_years", sa.Integer(), nullable=True))
    op.execute(sa.text("""
            UPDATE users
            SET age_years = (
                EXTRACT(YEAR FROM AGE(CURRENT_DATE, birth_date))::int
            )
            WHERE birth_date IS NOT NULL
        """))
    op.drop_column("users", "birth_date")
