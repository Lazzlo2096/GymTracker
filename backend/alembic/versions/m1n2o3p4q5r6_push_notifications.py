"""Push-токены, лог уведомлений, настройки напоминаний (TGL-34).

Revision ID: m1n2o3p4q5r6
Revises: l1m2n3o4p5q6
Create Date: 2026-05-29

"""

from alembic import op
import sqlalchemy as sa

revision = "m1n2o3p4q5r6"
down_revision = "l1m2n3o4p5q6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("workout_reminder_time", sa.Time(), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column(
            "workout_reminder_weekdays",
            sa.String(length=32),
            nullable=False,
            server_default=sa.text("'1,2,3,4,5,6,7'"),
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "workout_reminder_timezone",
            sa.String(length=64),
            nullable=False,
            server_default=sa.text("'UTC'"),
        ),
    )

    op.create_table(
        "user_push_tokens",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("expo_push_token", sa.String(length=256), nullable=False),
        sa.Column("platform", sa.String(length=16), nullable=False),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("expo_push_token"),
    )
    op.create_index("ix_user_push_tokens_user_id", "user_push_tokens", ["user_id"])

    op.create_table(
        "notification_log",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("kind", sa.String(length=64), nullable=False),
        sa.Column("dedup_key", sa.String(length=128), nullable=False),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "user_id", "kind", "dedup_key", name="uq_notification_log_dedup"
        ),
    )
    op.create_index("ix_notification_log_user_id", "notification_log", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_notification_log_user_id", table_name="notification_log")
    op.drop_table("notification_log")
    op.drop_index("ix_user_push_tokens_user_id", table_name="user_push_tokens")
    op.drop_table("user_push_tokens")
    op.drop_column("users", "workout_reminder_timezone")
    op.drop_column("users", "workout_reminder_weekdays")
    op.drop_column("users", "workout_reminder_time")
