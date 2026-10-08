"""Premium на users, promo_codes и promo_redemptions (KAN-80).

Revision ID: k0l1m2n3o4p5
Revises: j0k1l2m3n4o5
Create Date: 2026-05-26

"""

from alembic import op
import sqlalchemy as sa

revision = "k0l1m2n3o4p5"
down_revision = "j0k1l2m3n4o5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("premium_until", sa.TIMESTAMP(timezone=True), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column(
            "premium_lifetime",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )

    op.create_table(
        "promo_codes",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("owner_user_id", sa.Integer(), nullable=True),
        sa.Column("code", sa.String(length=32), nullable=False),
        sa.Column("type", sa.String(length=16), nullable=False),
        sa.Column("label", sa.String(length=128), nullable=True),
        sa.Column("created_by_user_id", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["owner_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["created_by_user_id"], ["users.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code"),
    )
    op.create_index("ix_promo_codes_owner_user_id", "promo_codes", ["owner_user_id"])
    op.create_index(
        "uq_promo_codes_referral_owner",
        "promo_codes",
        ["owner_user_id"],
        unique=True,
        postgresql_where=sa.text("type = 'referral'"),
    )

    op.create_table(
        "promo_redemptions",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("promo_code_id", sa.Integer(), nullable=False),
        sa.Column("redeemer_user_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column(
            "is_referral_redemption",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column("redeemer_tonnage_kg", sa.Float(), nullable=True),
        sa.Column("owner_rewarded_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("premium_days_granted", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["promo_code_id"], ["promo_codes.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["redeemer_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "redeemer_user_id",
            "promo_code_id",
            name="uq_promo_redemptions_redeemer_code",
        ),
    )
    op.create_index(
        "ix_promo_redemptions_promo_code_id", "promo_redemptions", ["promo_code_id"]
    )
    op.create_index(
        "ix_promo_redemptions_redeemer_user_id",
        "promo_redemptions",
        ["redeemer_user_id"],
    )
    op.create_index(
        "uq_promo_redemptions_one_referral_per_user",
        "promo_redemptions",
        ["redeemer_user_id"],
        unique=True,
        postgresql_where=sa.text("is_referral_redemption = true"),
    )


def downgrade() -> None:
    op.drop_index(
        "uq_promo_redemptions_one_referral_per_user", table_name="promo_redemptions"
    )
    op.drop_index(
        "ix_promo_redemptions_redeemer_user_id", table_name="promo_redemptions"
    )
    op.drop_index("ix_promo_redemptions_promo_code_id", table_name="promo_redemptions")
    op.drop_table("promo_redemptions")
    op.drop_index("uq_promo_codes_referral_owner", table_name="promo_codes")
    op.drop_index("ix_promo_codes_owner_user_id", table_name="promo_codes")
    op.drop_table("promo_codes")
    op.drop_column("users", "premium_lifetime")
    op.drop_column("users", "premium_until")
