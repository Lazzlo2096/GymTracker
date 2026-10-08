"""Разнести поля профиля users в user_fitness_data, user_client_settings, user_reminds.

Revision ID: z3a4b5c6d7e8
Revises: y2z3a4b5c6d7
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "z3a4b5c6d7e8"
down_revision: Union[str, Sequence[str], None] = "y2z3a4b5c6d7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)

    if "user_fitness_data" not in insp.get_table_names():
        op.create_table(
            "user_fitness_data",
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("height_cm", sa.Integer(), nullable=True),
            sa.Column("training_goal", sa.String(length=256), nullable=True),
            sa.Column("target_weight_kg", sa.Integer(), nullable=True),
            sa.Column("preferred_user_gym_id", sa.Integer(), nullable=True),
            sa.ForeignKeyConstraint(
                ["preferred_user_gym_id"], ["user_gyms.id"], ondelete="SET NULL"
            ),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("user_id"),
        )

    if "user_client_settings" not in insp.get_table_names():
        op.create_table(
            "user_client_settings",
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column(
                "measurement_units",
                sa.String(length=16),
                server_default=sa.text("'metric'"),
                nullable=False,
            ),
            sa.Column(
                "settings_dark_theme",
                sa.Boolean(),
                server_default=sa.text("false"),
                nullable=False,
            ),
            sa.Column(
                "settings_notifications",
                sa.Boolean(),
                server_default=sa.text("true"),
                nullable=False,
            ),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("user_id"),
        )

    if "user_reminds" not in insp.get_table_names():
        op.create_table(
            "user_reminds",
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column(
                "settings_workout_reminders",
                sa.Boolean(),
                server_default=sa.text("true"),
                nullable=False,
            ),
            sa.Column("workout_reminder_time", sa.Time(), nullable=True),
            sa.Column(
                "workout_reminder_weekdays",
                sa.String(length=32),
                server_default=sa.text("'1,2,3,4,5,6,7'"),
                nullable=False,
            ),
            sa.Column(
                "workout_reminder_timezone",
                sa.String(length=64),
                server_default=sa.text("'UTC'"),
                nullable=False,
            ),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("user_id"),
        )

    u_cols = {c["name"] for c in insp.get_columns("users")}
    if "height_cm" in u_cols:
        op.execute(sa.text("""
                INSERT INTO user_fitness_data (
                    user_id, height_cm, training_goal, target_weight_kg, preferred_user_gym_id
                )
                SELECT id, height_cm, training_goal, target_weight_kg, preferred_user_gym_id
                FROM users
                ON CONFLICT (user_id) DO NOTHING
                """))
        op.execute(sa.text("""
                INSERT INTO user_client_settings (
                    user_id, measurement_units, settings_dark_theme, settings_notifications
                )
                SELECT id, measurement_units, settings_dark_theme, settings_notifications
                FROM users
                ON CONFLICT (user_id) DO NOTHING
                """))
        op.execute(sa.text("""
                INSERT INTO user_reminds (
                    user_id,
                    settings_workout_reminders,
                    workout_reminder_time,
                    workout_reminder_weekdays,
                    workout_reminder_timezone
                )
                SELECT
                    id,
                    settings_workout_reminders,
                    workout_reminder_time,
                    workout_reminder_weekdays,
                    workout_reminder_timezone
                FROM users
                ON CONFLICT (user_id) DO NOTHING
                """))

        fks = {fk["name"] for fk in insp.get_foreign_keys("users")}
        if "fk_users_preferred_user_gym_id" in fks:
            op.drop_constraint(
                "fk_users_preferred_user_gym_id", "users", type_="foreignkey"
            )

        for col in (
            "preferred_user_gym_id",
            "workout_reminder_timezone",
            "workout_reminder_weekdays",
            "workout_reminder_time",
            "settings_workout_reminders",
            "settings_dark_theme",
            "settings_notifications",
            "measurement_units",
            "target_weight_kg",
            "training_goal",
            "height_cm",
        ):
            if col in u_cols:
                op.drop_column("users", col)


def downgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    u_cols = {c["name"] for c in insp.get_columns("users")}

    if "height_cm" not in u_cols:
        op.add_column("users", sa.Column("height_cm", sa.Integer(), nullable=True))
    if "training_goal" not in u_cols:
        op.add_column(
            "users", sa.Column("training_goal", sa.String(256), nullable=True)
        )
    if "target_weight_kg" not in u_cols:
        op.add_column(
            "users", sa.Column("target_weight_kg", sa.Integer(), nullable=True)
        )
    if "measurement_units" not in u_cols:
        op.add_column(
            "users",
            sa.Column(
                "measurement_units",
                sa.String(16),
                server_default=sa.text("'metric'"),
                nullable=False,
            ),
        )
    if "settings_notifications" not in u_cols:
        op.add_column(
            "users",
            sa.Column(
                "settings_notifications",
                sa.Boolean(),
                server_default=sa.text("true"),
                nullable=False,
            ),
        )
    if "settings_dark_theme" not in u_cols:
        op.add_column(
            "users",
            sa.Column(
                "settings_dark_theme",
                sa.Boolean(),
                server_default=sa.text("false"),
                nullable=False,
            ),
        )
    if "settings_workout_reminders" not in u_cols:
        op.add_column(
            "users",
            sa.Column(
                "settings_workout_reminders",
                sa.Boolean(),
                server_default=sa.text("true"),
                nullable=False,
            ),
        )
    if "workout_reminder_time" not in u_cols:
        op.add_column(
            "users", sa.Column("workout_reminder_time", sa.Time(), nullable=True)
        )
    if "workout_reminder_weekdays" not in u_cols:
        op.add_column(
            "users",
            sa.Column(
                "workout_reminder_weekdays",
                sa.String(32),
                server_default=sa.text("'1,2,3,4,5,6,7'"),
                nullable=False,
            ),
        )
    if "workout_reminder_timezone" not in u_cols:
        op.add_column(
            "users",
            sa.Column(
                "workout_reminder_timezone",
                sa.String(64),
                server_default=sa.text("'UTC'"),
                nullable=False,
            ),
        )
    if "preferred_user_gym_id" not in u_cols:
        op.add_column(
            "users", sa.Column("preferred_user_gym_id", sa.Integer(), nullable=True)
        )
        op.create_foreign_key(
            "fk_users_preferred_user_gym_id",
            "users",
            "user_gyms",
            ["preferred_user_gym_id"],
            ["id"],
            ondelete="SET NULL",
        )

    if "user_fitness_data" in insp.get_table_names():
        op.execute(sa.text("""
                UPDATE users u SET
                    height_cm = g.height_cm,
                    training_goal = g.training_goal,
                    target_weight_kg = g.target_weight_kg,
                    preferred_user_gym_id = g.preferred_user_gym_id
                FROM user_fitness_data g
                WHERE g.user_id = u.id
                """))
    if "user_client_settings" in insp.get_table_names():
        op.execute(sa.text("""
                UPDATE users u SET
                    measurement_units = c.measurement_units,
                    settings_dark_theme = c.settings_dark_theme,
                    settings_notifications = c.settings_notifications
                FROM user_client_settings c
                WHERE c.user_id = u.id
                """))
    if "user_reminds" in insp.get_table_names():
        op.execute(sa.text("""
                UPDATE users u SET
                    settings_workout_reminders = r.settings_workout_reminders,
                    workout_reminder_time = r.workout_reminder_time,
                    workout_reminder_weekdays = r.workout_reminder_weekdays,
                    workout_reminder_timezone = r.workout_reminder_timezone
                FROM user_reminds r
                WHERE r.user_id = u.id
                """))

    for table in ("user_reminds", "user_client_settings", "user_fitness_data"):
        if table in insp.get_table_names():
            op.drop_table(table)
