from sqlmodel import create_engine, Session, SQLModel
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./school_admissions.db")

# SQLite: allow cross-thread access (FastAPI uses thread pool workers)
connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(DATABASE_URL, echo=False, connect_args=connect_args)


def create_db_and_tables():
    SQLModel.metadata.create_all(engine)
    try:
        from sqlalchemy import text
        with Session(engine) as session:
            cols = [r[1] for r in session.exec(text("PRAGMA table_info(fee_records)")).all()]
            if cols and "cleared_date" not in cols:
                session.exec(text("ALTER TABLE fee_records ADD COLUMN cleared_date VARCHAR"))
                session.commit()
    except Exception as e:
        print(f"Migration notice: {e}")


def get_session():
    with Session(engine) as session:
        yield session
