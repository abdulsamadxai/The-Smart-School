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

# Columns added after the first release. create_all() only creates missing
# tables, never alters existing ones, so an older database is missing these
# and the app crashed with "no such column" / NOT NULL errors. This backfill
# runs on every boot, is idempotent, and works on both SQLite and Postgres
# (the old PRAGMA-based version only worked on SQLite and silently did
# nothing on Supabase).
BACKFILL_COLUMNS = {
    "students": {
        "registered_at": "TIMESTAMP",
        "stage": "VARCHAR",
        "class_enrolled": "VARCHAR",
        "age_at_registration": "DOUBLE PRECISION",
        "criteria_note": "VARCHAR",
        "test_date": "VARCHAR",
        "test_time": "VARCHAR",
        "score_total_obtained": "DOUBLE PRECISION",
        "score_total_possible": "DOUBLE PRECISION",
        "score_subjects_json": "TEXT",
        "decision": "VARCHAR",
        "decision_at": "TIMESTAMP",
        "gr_number": "VARCHAR",
        "joined": "BOOLEAN",
        "not_joined_reason": "VARCHAR",
        "challan_monthly_fee": "DOUBLE PRECISION",
        "challan_scholarship_pct": "DOUBLE PRECISION",
        "challan_sibling_discount_pct": "DOUBLE PRECISION",
        "challan_orphan_discount_pct": "DOUBLE PRECISION",
        "challan_admission_fee": "DOUBLE PRECISION",
        "challan_admission_scholarship_pct": "DOUBLE PRECISION",
        "challan_annual_fee": "DOUBLE PRECISION",
        "challan_security": "DOUBLE PRECISION",
        "challan_security_scholarship_pct": "DOUBLE PRECISION",
        "challan_other_dues": "DOUBLE PRECISION",
        "challan_amount_paid": "DOUBLE PRECISION",
        "certificate_issued": "VARCHAR",
        "certificate_issued_at": "TIMESTAMP",
        "leaving_date": "VARCHAR",
        "leaving_reason": "VARCHAR",
        "conduct_remarks": "VARCHAR",
    },
    "fee_records": {
        "payment_method": "VARCHAR",
        "cleared_date": "VARCHAR",
        "invoice_id": "VARCHAR",
        "cleared_at": "TIMESTAMP",
    },
}


def _backfill_columns():
    """Add any missing columns from BACKFILL_COLUMNS to existing tables."""
    try:
        from sqlalchemy import inspect, text

        inspector = inspect(engine)
        existing_tables = set(inspector.get_table_names())
        with engine.begin() as conn:
            for table, columns in BACKFILL_COLUMNS.items():
                if table not in existing_tables:
                    continue
                present = {c["name"] for c in inspector.get_columns(table)}
                for column, coltype in columns.items():
                    if column not in present:
                        conn.execute(
                            text(f"ALTER TABLE {table} ADD COLUMN {column} {coltype}")
                        )
                        print(f"Migration: added {table}.{column}")
        # The very first schema had a NOT NULL contact_number column the
        # current code never sets, which broke every student insert.
        # Keep the column (and any data in it) but allow NULLs.
        if "students" in existing_tables:
            cols = {c["name"]: c for c in inspect(engine).get_columns("students")}
            if "contact_number" in cols and not cols["contact_number"]["nullable"]:
                if engine.dialect.name == "postgresql":
                    with engine.begin() as conn:
                        conn.execute(
                            text("ALTER TABLE students ALTER COLUMN contact_number DROP NOT NULL")
                        )
                    print("Migration: students.contact_number is now nullable")
                elif engine.dialect.name == "sqlite":
                    # SQLite cannot ALTER a column's nullability, so rebuild
                    # the table from the current model (which drops the
                    # unused contact_number column entirely).
                    with engine.begin() as conn:
                        _sqlite_rebuild_students(conn)
    except Exception as e:
        # The app still boots if a migration step fails; the error is
        # printed so it is visible in the server log.
        print(f"Migration notice: {e}")


def _sqlite_rebuild_students(conn):
    """Rebuild the students table from the current model.

    SQLite-only. Used when the old table still has a NOT NULL
    contact_number column, which the current code never sets (every
    student insert then failed). The rebuild keeps all data in columns
    the model still has and recreates the model's indexes.
    """
    from sqlalchemy import inspect, text
    from sqlalchemy.schema import CreateTable, CreateIndex
    from models import Student

    inspector = inspect(conn)
    present = [c["name"] for c in inspector.get_columns("students")]
    model_cols = [c.name for c in Student.__table__.columns]
    common = [c for c in model_cols if c in present]
    ddl = str(CreateTable(Student.__table__).compile(conn))
    conn.execute(text("ALTER TABLE students RENAME TO students_old"))
    try:
        conn.execute(text(ddl))
        # Old rows may have NULL in registered_at (the first schema did
        # not always fill it); the new table requires it, so fall back to
        # a fixed date instead of failing the whole migration.
        select_exprs = [
            "COALESCE(registered_at, '2000-01-01 00:00:00')" if c == "registered_at" else c
            for c in common
        ]
        col_list = ", ".join(common)
        select_list = ", ".join(select_exprs)
        conn.execute(
            text(f"INSERT INTO students ({col_list}) SELECT {select_list} FROM students_old")
        )
        conn.execute(text("DROP TABLE students_old"))
        for index in Student.__table__.indexes:
            conn.execute(text(str(CreateIndex(index).compile(conn))))
        print("Migration: rebuilt students table (contact_number dropped)")
    except Exception:
        # The new (possibly empty) table blocks the rename back, so drop
        # it first; the original data is still in students_old.
        conn.execute(text("DROP TABLE IF EXISTS students"))
        conn.execute(text("ALTER TABLE students_old RENAME TO students"))
        raise


def create_db_and_tables():
    SQLModel.metadata.create_all(engine)
    _backfill_columns()


def get_session():
    with Session(engine) as session:
        yield session
