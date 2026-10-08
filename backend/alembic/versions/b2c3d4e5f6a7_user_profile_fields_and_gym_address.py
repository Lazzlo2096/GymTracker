"""Поля профиля пользователя и адрес зала (user_gyms.address).

Revision ID: b2c3d4e5f6a7
Revises: a9e8f7d6c5b4
Create Date: 2026-05-04

"""

from alembic import op
import sqlalchemy as sa

revision = "b2c3d4e5f6a7"
down_revision = "a9e8f7d6c5b4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)

    ug_cols = {c["name"] for c in insp.get_columns("user_gyms")}
    if "address" not in ug_cols:
        op.add_column("user_gyms", sa.Column("address", sa.Text(), nullable=True))

    u_cols = {c["name"] for c in insp.get_columns("users")}
    if "avatar_url" not in u_cols:
        op.add_column("users", sa.Column("avatar_url", sa.Text(), nullable=True))
    if "height_cm" not in u_cols:
        op.add_column("users", sa.Column("height_cm", sa.Integer(), nullable=True))
    if "age_years" not in u_cols:
        op.add_column("users", sa.Column("age_years", sa.SmallInteger(), nullable=True))
    if "training_goal" not in u_cols:
        op.add_column(
            "users", sa.Column("training_goal", sa.String(256), nullable=True)
        )
    if "measurement_units" not in u_cols:
        op.add_column(
            "users",
            sa.Column(
                "measurement_units",
                sa.String(16),
                nullable=False,
                server_default="metric",
            ),
        )
    if "settings_notifications" not in u_cols:
        op.add_column(
            "users",
            sa.Column(
                "settings_notifications",
                sa.Boolean(),
                nullable=False,
                server_default=sa.text("true"),
            ),
        )
    if "settings_dark_theme" not in u_cols:
        op.add_column(
            "users",
            sa.Column(
                "settings_dark_theme",
                sa.Boolean(),
                nullable=False,
                server_default=sa.text("false"),
            ),
        )
    if "settings_workout_reminders" not in u_cols:
        op.add_column(
            "users",
            sa.Column(
                "settings_workout_reminders",
                sa.Boolean(),
                nullable=False,
                server_default=sa.text("true"),
            ),
        )
    if "preferred_user_gym_id" not in u_cols:
        op.add_column(
            "users",
            sa.Column("preferred_user_gym_id", sa.Integer(), nullable=True),
        )
        op.create_foreign_key(
            "fk_users_preferred_user_gym_id",
            "users",
            "user_gyms",
            ["preferred_user_gym_id"],
            ["id"],
            ondelete="SET NULL",
        )


def downgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    u_cols = {c["name"] for c in insp.get_columns("users")}
    if "preferred_user_gym_id" in u_cols:
        op.drop_constraint(
            "fk_users_preferred_user_gym_id", "users", type_="foreignkey"
        )
        op.drop_column("users", "preferred_user_gym_id")
    for col in (
        "settings_workout_reminders",
        "settings_dark_theme",
        "settings_notifications",
        "measurement_units",
        "training_goal",
        "age_years",
        "height_cm",
        "avatar_url",
    ):
        insp_u = sa.inspect(conn)
        names = {c["name"] for c in insp_u.get_columns("users")}
        if col in names:
            op.drop_column("users", col)
    insp_ug = sa.inspect(conn)
    ug_cols = {c["name"] for c in insp_ug.get_columns("user_gyms")}
    if "address" in ug_cols:
        op.drop_column("user_gyms", "address")
