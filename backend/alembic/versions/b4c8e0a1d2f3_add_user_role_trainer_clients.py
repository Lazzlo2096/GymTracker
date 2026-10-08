"""add user role and trainer_clients

Revision ID: b4c8e0a1d2f3
Revises: 2a8f3c1e9b70
Create Date: 2026-04-11

"""

from alembic import op
import sqlalchemy as sa

revision = "b4c8e0a1d2f3"
down_revision = "2a8f3c1e9b70"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)

    user_cols = {c["name"] for c in insp.get_columns("users")}
    if "role" not in user_cols:
        op.add_column(
            "users",
            sa.Column(
                "role", sa.String(length=20), server_default="user", nullable=False
            ),
        )

    if "trainer_clients" not in insp.get_table_names():
        op.create_table(
            "trainer_clients",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("trainer_id", sa.Integer(), nullable=False),
            sa.Column("client_id", sa.Integer(), nullable=False),
            sa.ForeignKeyConstraint(["client_id"], ["users.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["trainer_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint(
                "trainer_id", "client_id", name="uq_trainer_clients_trainer_client"
            ),
        )
        op.create_index(
            op.f("ix_trainer_clients_trainer_id"),
            "trainer_clients",
            ["trainer_id"],
            unique=False,
        )
        op.create_index(
            op.f("ix_trainer_clients_client_id"),
            "trainer_clients",
            ["client_id"],
            unique=False,
        )
    else:
        existing_ix = {idx["name"] for idx in insp.get_indexes("trainer_clients")}
        tix = op.f("ix_trainer_clients_trainer_id")
        cix = op.f("ix_trainer_clients_client_id")
        if tix not in existing_ix:
            op.create_index(tix, "trainer_clients", ["trainer_id"], unique=False)
        if cix not in existing_ix:
            op.create_index(cix, "trainer_clients", ["client_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_trainer_clients_client_id"), table_name="trainer_clients")
    op.drop_index(op.f("ix_trainer_clients_trainer_id"), table_name="trainer_clients")
    op.drop_table("trainer_clients")
    op.drop_column("users", "role")
