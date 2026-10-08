"""add_refresh_jti_to_users

Revision ID: 3c9f7a2b1d21
Revises: 57e233f1f1b2
Create Date: 2026-03-18

"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "3c9f7a2b1d21"
down_revision = "57e233f1f1b2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("refresh_jti", sa.String(), nullable=True))
    op.create_index(
        op.f("ix_users_refresh_jti"), "users", ["refresh_jti"], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_users_refresh_jti"), table_name="users")
    op.drop_column("users", "refresh_jti")
