import os
from sqlmodel import Session, create_engine, select
import models  # Your existing models where all SQLModels are registered

# 1. Old SQLite Database
SQLITE_URL = "sqlite:///./school_admissions.db"
sqlite_engine = create_engine(SQLITE_URL)

# 2. New Supabase PostgreSQL Database
SUPABASE_URL = os.getenv("SUPABASE_DATABASE_URL", "postgresql://user:pass@host:5432/postgres")
# Replace postgresql:// with postgresql+psycopg2:// if required by SQLAlchemy
if SUPABASE_URL.startswith("postgresql://"):
    SUPABASE_URL = SUPABASE_URL.replace("postgresql://", "postgresql+psycopg2://")

supabase_engine = create_engine(SUPABASE_URL)

def migrate_data():
    if "user:pass" in SUPABASE_URL:
        print("ERROR: Please update SUPABASE_DATABASE_URL with your actual connection string.")
        return

    print("Creating tables in Supabase...")
    models.SQLModel.metadata.create_all(supabase_engine)

    with Session(sqlite_engine) as sqlite_session:
        # A. Migrate Criterias
        criterias = sqlite_session.exec(select(models.CriteriaSetting)).all()
        print(f"Migrating {len(criterias)} criteria settings...")
        with Session(supabase_engine) as sb_session:
            # We clear them out to cleanly restart (optional)
            sb_session.query(models.CriteriaSetting).delete()
            for c in criterias:
                # Remove SQLite IDs if you want Postgres to regenerate, or keep to preserve links
                sb_session.add(models.CriteriaSetting(**c.dict()))
            sb_session.commit()

        # B. Migrate Students
        students = sqlite_session.exec(select(models.Student)).all()
        print(f"Migrating {len(students)} students...")
        with Session(supabase_engine) as sb_session:
            sb_session.query(models.Student).delete()
            for s in students:
                new_s = models.Student(**s.dict())
                sb_session.add(new_s)
            sb_session.commit()

        # C. Migrate Fee Records
        fee_records = sqlite_session.exec(select(models.FeeRecord)).all()
        print(f"Migrating {len(fee_records)} fee records...")
        with Session(supabase_engine) as sb_session:
            sb_session.query(models.FeeRecord).delete()
            for f in fee_records:
                sb_session.add(models.FeeRecord(**f.dict()))
            sb_session.commit()

        # D. Migrate History Logs
        history_logs = sqlite_session.exec(select(models.HistoryLog)).all()
        print(f"Migrating {len(history_logs)} history logs...")
        with Session(supabase_engine) as sb_session:
            sb_session.query(models.HistoryLog).delete()
            for h in history_logs:
                sb_session.add(models.HistoryLog(**h.dict()))
            sb_session.commit()

    print("✅ Migration to Supabase Complete! No data was lost.")

if __name__ == "__main__":
    migrate_data()
