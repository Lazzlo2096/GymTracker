"""add payments table for yookassa

Revision ID: a91b2c3d4e5f
Revises: d7e8f9a0b1c2
Create Date: 2026-04-22

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "a91b2c3d4e5f"
down_revision = "d7e8f9a0b1c2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "payments",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "provider",
            sa.String(length=32),
            nullable=False,
            server_default=sa.text("'yookassa'"),
        ),
        sa.Column("provider_payment_id", sa.String(length=128), nullable=False),
        sa.Column("idempotence_key", sa.String(length=64), nullable=False),
        sa.Column("amount", sa.Numeric(10, 2), nullable=False),
        sa.Column(
            "currency",
            sa.String(length=3),
            nullable=False,
            server_default=sa.text("'RUB'"),
        ),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "status",
            sa.String(length=32),
            nullable=False,
            server_default=sa.text("'pending'"),
        ),
        sa.Column("confirmation_url", sa.Text(), nullable=True),
        sa.Column("paid_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column(
            "provider_payload",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index(
        "ix_payments_provider_payment_id",
        "payments",
        ["provider_payment_id"],
        unique=True,
    )
    op.create_index(
        "ix_payments_idempotence_key", "payments", ["idempotence_key"], unique=True
    )
    op.create_index(
        "ix_payments_user_created", "payments", ["user_id", "created_at"], unique=False
    )
    op.create_index(
        "ix_payments_provider_status", "payments", ["provider", "status"], unique=False
    )


def downgrade() -> None:
    op.drop_index("ix_payments_provider_status", table_name="payments")
    op.drop_index("ix_payments_user_created", table_name="payments")
    op.drop_index("ix_payments_idempotence_key", table_name="payments")
    op.drop_index("ix_payments_provider_payment_id", table_name="payments")
    op.drop_table("payments")
