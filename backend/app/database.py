import os
import logging
from dotenv import load_dotenv
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./voiceforge.db")



def get_db():
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()
class Base(DeclarativeBase):
    pass


if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False},
    )
else:
    engine = create_engine(DATABASE_URL)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def ensure_schema_updates():
    """Apply legacy additive SQLite/Postgres schema updates when the table exists."""
    if not inspect(engine).has_table("agents"):
        return

    columns = {
        column["name"] for column in inspect(engine).get_columns("agents")
    }
    with engine.begin() as connection:
        if "temperature" not in columns:
            connection.execute(text(
                "ALTER TABLE agents ADD COLUMN temperature FLOAT DEFAULT 1.0"
            ))
            logger.info("Added missing agents.temperature column")

        if "voice_speed" not in columns:
            connection.execute(text(
                "ALTER TABLE agents ADD COLUMN voice_speed FLOAT DEFAULT 1.0"
            ))
            logger.info("Added missing agents.voice_speed column")

ensure_schema_updates()
