"""make_display_name_unique

Revision ID: 7d6f4a9c1b12
Revises: 0e6ad2d2a7b4
Create Date: 2026-03-18

"""

from alembic import op

revision = "7d6f4a9c1b12"
down_revision = "0e6ad2d2a7b4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Best-effort: skip if duplicates exist (dev DB). In that case user should clean duplicates.
    op.execute("""
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM users GROUP BY display_name HAVING COUNT(*) > 1
          ) THEN
            RAISE NOTICE 'Skipping unique constraint on users.display_name due to duplicates';
          ELSE
            CREATE UNIQUE INDEX IF NOT EXISTS ix_users_display_name ON users (display_name);
          END IF;
        END $$;
        """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_users_display_name;")
