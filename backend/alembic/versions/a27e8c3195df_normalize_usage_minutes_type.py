"""normalize usage minutes column type

Revision ID: a27e8c3195df
Revises: 9c2adfa74b16
Create Date: 2026-10-22 12:37:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a27e8c3195df"
down_revision: Union[str, Sequence[str], None] = "9c2adfa74b16"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    columns = sa.inspect(op.get_bind()).get_columns("usage_records")
    total_minutes = next(
        column for column in columns if column["name"] == "total_minutes"
    )
    if not isinstance(total_minutes["type"], sa.Float):
        with op.batch_alter_table("usage_records") as batch_op:
            batch_op.alter_column(
                "total_minutes",
                existing_type=total_minutes["type"],
                type_=sa.Float(),
                existing_nullable=False,
            )


def downgrade() -> None:
    columns = sa.inspect(op.get_bind()).get_columns("usage_records")
    total_minutes = next(
        column for column in columns if column["name"] == "total_minutes"
    )
    if isinstance(total_minutes["type"], sa.Float):
        with op.batch_alter_table("usage_records") as batch_op:
            batch_op.alter_column(
                "total_minutes",
                existing_type=sa.Float(),
                type_=sa.Integer(),
                existing_nullable=False,
            )
