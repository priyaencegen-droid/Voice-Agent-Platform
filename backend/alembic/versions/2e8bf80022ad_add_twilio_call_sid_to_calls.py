"""add twilio_call_sid to calls"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "2e8bf80022ad"
down_revision: Union[str, Sequence[str], None] = "40a80aeb061e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("calls") as batch_op:
        batch_op.add_column(
            sa.Column("twilio_call_sid", sa.String(), nullable=True)
        )

        batch_op.create_unique_constraint(
            "uq_calls_twilio_call_sid",
            ["twilio_call_sid"]
        )


def downgrade() -> None:
    with op.batch_alter_table("calls") as batch_op:
        batch_op.drop_constraint(
            "uq_calls_twilio_call_sid",
            type_="unique",
        )

        batch_op.drop_column("twilio_call_sid")