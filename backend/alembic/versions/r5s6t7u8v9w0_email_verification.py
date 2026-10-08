"""users.email_verified_at + email_verification_tokens

Revision ID: r5s6t7u8v9w0
Revises: q4r5s6t7u8v9
Create Date: 2026-06-09

"""

from alembic import op
import sqlalchemy as sa

revision = "r5s6t7u8v9w0"
down_revision = "q4r5s6t7u8v9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    u_cols = {c["name"] for c in insp.get_columns("users")}
    if "email_verified_at" not in u_cols:
        op.add_column(
            "users",
            sa.Column("email_verified_at", sa.TIMESTAMP(timezone=True), nullable=True),
        )
        op.execute(
            sa.text(
                "UPDATE users SET email_verified_at = created_at WHERE email_verified_at IS NULL"
            )
        )

    tables = set(insp.get_table_names())
    if "email_verification_tokens" not in tables:
        op.create_table(
            "email_verification_tokens",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("token_hash", sa.String(length=64), nullable=False),
            sa.Column("expires_at", sa.TIMESTAMP(timezone=True), nullable=False),
            sa.Column(
                "created_at",
                sa.TIMESTAMP(timezone=True),
                server_default=sa.text("now()"),
                nullable=False,
            ),
            sa.Column("consumed_at", sa.TIMESTAMP(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(
            "ix_email_verification_tokens_user_id",
            "email_verification_tokens",
            ["user_id"],
        )
        op.create_index(
            "ix_email_verification_tokens_token_hash",
            "email_verification_tokens",
            ["token_hash"],
        )


def downgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    if "email_verification_tokens" in set(insp.get_table_names()):
        op.drop_index(
            "ix_email_verification_tokens_token_hash", "email_verification_tokens"
        )
        op.drop_index(
            "ix_email_verification_tokens_user_id", "email_verification_tokens"
        )
        op.drop_table("email_verification_tokens")
    u_cols = {c["name"] for c in insp.get_columns("users")}
    if "email_verified_at" in u_cols:
        op.drop_column("users", "email_verified_at")
