"""
One-off migration: copy all rows from the local SQLite database into a
Supabase PostgreSQL database.

WARNING: this script DELETES all rows in the target Supabase tables before
loading. It asks for confirmation first and will not run without it.

It keeps the original row ids (so student <-> fee/history links survive)
and then resets the Postgres sequences, otherwise the next insert would
collide with an existing id (duplicate-key error on registration).

Usage (from backend/):
  SUPABASE_DATABASE_URL=postgresql+psycopg2://... python migrate_to_supabase.py
"""

import os

import sqlalchemy as sa
from sqlmodel import Session, create_engine, select, delete

import models  # noqa: F401  (registers all SQLModels)

# 1. Old SQLite Database
SQLITE_URL = "sqlite:///./school_admissions.db"
sqlite_engine = create_engine(SQLITE_URL)

# 2. New Supabase PostgreSQL Database
SUPABASE_URL = os.getenv("SUPABASE_DATABASE_URL", "")
if SUPABASE_URL.startswith("postgresql://"):
    SUPABASE_URL = SUPABASE_URL.replace("postgresql://", "postgresql+psycopg2://")

supabase_engine = create_engine(SUPABASE_URL) if SUPABASE_URL else None

# Relationship attributes are not columns; exclude them from row copies.
RELATIONSHIPS = {
    models.CriteriaSetting: (),
    models.Student: ("fee_records", "history_logs"),
    models.FeeRecord: ("student",),
    models.HistoryLog: ("student",),
}


def _row_dict(obj):
    return obj.model_dump(exclude=set(RELATIONSHIPS[type(obj)]))


def _reset_sequences(engine):
    """Point every table's id sequence past its current max id."""
    insp = sa.inspect(engine)
    with engine.connect() as conn:
        for table in insp.get_table_names():
            max_id = conn.execute(
                sa.text(f"SELECT COALESCE(MAX(id), 0) FROM {table}")
            ).scalar()
            if max_id > 0:
                conn.execute(
                    sa.text(
                        f"SELECT setval(pg_get_serial_sequence('{table}', 'id'), "
                        f"{max_id + 1}, false)"
                    )
                )
                print(f"Sequence reset for {table} (max id {max_id})")
        conn.commit()


def migrate_data():
    if not SUPABASE_URL:
        print("ERROR: set SUPABASE_DATABASE_URL first (never hardcode it here).")
        return

    print("Creating tables in Supabase...")
    models.SQLModel.metadata.create_all(supabase_engine)

    with Session(sqlite_engine) as sqlite_session:
        criterias = sqlite_session.exec(select(models.CriteriaSetting)).all()
        students = sqlite_session.exec(select(models.Student)).all()
        fee_records = sqlite_session.exec(select(models.FeeRecord)).all()
        history_logs = sqlite_session.exec(select(models.HistoryLog)).all()

    print(
        f"About to DELETE all rows in the target database and load "
        f"{len(criterias)} criteria, {len(students)} students, "
        f"{len(fee_records)} fee records, {len(history_logs)} history logs."
    )
    confirm = input("Type YES to continue: ").strip()
    if confirm != "YES":
        print("Aborted. Nothing was changed.")
        return

    with Session(supabase_engine) as sb_session:
        # Delete in FK-safe order (children first).
        sb_session.exec(delete(models.HistoryLog))
        sb_session.exec(delete(models.FeeRecord))
        sb_session.exec(delete(models.Student))
        sb_session.exec(delete(models.CriteriaSetting))

        for c in criterias:
            sb_session.add(models.CriteriaSetting(**_row_dict(c)))
        for s in students:
            sb_session.add(models.Student(**_row_dict(s)))
        for f in fee_records:
            sb_session.add(models.FeeRecord(**_row_dict(f)))
        for h in history_logs:
            sb_session.add(models.HistoryLog(**_row_dict(h)))
        sb_session.commit()

    print("Resetting Postgres sequences so new rows do not collide...")
    _reset_sequences(supabase_engine)

    print("Migration to Supabase complete.")


if __name__ == "__main__":
    migrate_data()
