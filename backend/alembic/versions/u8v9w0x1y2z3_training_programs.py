"""training_programs: программы пользователя в JSONB

Revision ID: u8v9w0x1y2z3
Revises: t7u8v9w0x1y2
Create Date: 2026-06-15

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "u8v9w0x1y2z3"
down_revision = "t7u8v9w0x1y2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    if "training_programs" in insp.get_table_names():
        return

    op.create_table(
        "training_programs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column(
            "program_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False
        ),
        sa.Column(
            "is_current",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "jsonb_typeof(program_json) = 'object'",
            name="ck_training_programs_json_object",
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_training_programs_user_id",
        "training_programs",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        "uq_training_programs_user_current",
        "training_programs",
        ["user_id"],
        unique=True,
        postgresql_where=sa.text("is_current IS TRUE"),
    )


def downgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    if "training_programs" not in insp.get_table_names():
        return

    op.drop_index(
        "uq_training_programs_user_current",
        table_name="training_programs",
        postgresql_where=sa.text("is_current IS TRUE"),
    )
    op.drop_index("ix_training_programs_user_id", table_name="training_programs")
    op.drop_table("training_programs")
