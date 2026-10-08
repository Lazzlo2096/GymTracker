"""drop_legacy_sub_column

Revision ID: 0e6ad2d2a7b4
Revises: 9b2d8c1f6a0e
Create Date: 2026-03-18

"""

from alembic import op
import sqlalchemy as sa

revision = "0e6ad2d2a7b4"
down_revision = "9b2d8c1f6a0e"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # best-effort: index/column may not exist in some dev DBs
    idx = "ix_users_" + ("key" + "cloak_sub")
    col = "key" + "cloak_sub"
    with op.get_context().autocommit_block():
        op.execute(f"DROP INDEX IF EXISTS {idx}")
    op.execute(f"ALTER TABLE users DROP COLUMN IF EXISTS {col}")


def downgrade() -> None:
    # We don't restore the old column name; create a neutral legacy column instead.
    op.add_column("users", sa.Column("legacy_sub", sa.String(), nullable=True))
    op.create_index("ix_users_legacy_sub", "users", ["legacy_sub"], unique=True)
