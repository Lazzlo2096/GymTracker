"""add user_gyms and workouts.user_gym_id

Revision ID: f1a2b3c4d5e6
Revises: e7f8a9b0c1d2
Create Date: 2026-05-02

"""

from alembic import op
import sqlalchemy as sa

revision = "f1a2b3c4d5e6"
down_revision = "e7f8a9b0c1d2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_gyms",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=256), nullable=False),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "name", name="uq_user_gym_user_name"),
    )
    op.create_index("ix_user_gyms_user_id", "user_gyms", ["user_id"], unique=False)
    op.add_column(
        "workouts",
        sa.Column("user_gym_id", sa.Integer(), nullable=True),
    )
    op.create_index(
        "ix_workouts_user_gym_id", "workouts", ["user_gym_id"], unique=False
    )
    op.create_foreign_key(
        "fk_workouts_user_gym_id_user_gyms",
        "workouts",
        "user_gyms",
        ["user_gym_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_workouts_user_gym_id_user_gyms", "workouts", type_="foreignkey"
    )
    op.drop_index("ix_workouts_user_gym_id", table_name="workouts")
    op.drop_column("workouts", "user_gym_id")
    op.drop_index("ix_user_gyms_user_id", table_name="user_gyms")
    op.drop_table("user_gyms")
