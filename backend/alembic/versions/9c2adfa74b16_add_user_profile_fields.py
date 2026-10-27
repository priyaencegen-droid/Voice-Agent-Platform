"""add user profile fields

Revision ID: 9c2adfa74b16
Revises: 4f6fa9a81406
Create Date: 2026-10-22 11:25:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "9c2adfa74b16"
down_revision: Union[str, Sequence[str], None] = "4f6fa9a81406"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("name", sa.String(), nullable=False, server_default=""),
    )
    op.add_column("users", sa.Column("profile_picture", sa.Text(), nullable=True))

    with op.batch_alter_table("users") as batch_op:
        batch_op.alter_column(
            "name",
            existing_type=sa.String(),
            existing_nullable=False,
            existing_server_default="",
            server_default=None,
        )


def downgrade() -> None:
    with op.batch_alter_table("users") as batch_op:
        batch_op.drop_column("profile_picture")
        batch_op.drop_column("name")
