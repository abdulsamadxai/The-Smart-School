"""
One-time migration: add certificate columns to students table.
Run with: python migrate_certificates.py
"""
import sqlite3, os

DB_PATH = os.path.join(os.path.dirname(__file__), "school_admissions.db")

NEW_COLUMNS = [
    ("certificate_issued",    "VARCHAR DEFAULT NULL"),
    ("certificate_issued_at", "DATETIME DEFAULT NULL"),
    ("leaving_date",          "VARCHAR DEFAULT NULL"),
    ("leaving_reason",        "VARCHAR DEFAULT NULL"),
    ("conduct_remarks",       "VARCHAR DEFAULT NULL"),
]

def run():
    conn = sqlite3.connect(DB_PATH)
    cur  = conn.cursor()
    cur.execute("PRAGMA table_info(students)")
    existing = {row[1] for row in cur.fetchall()}

    added = []
    for col, definition in NEW_COLUMNS:
        if col not in existing:
            cur.execute(f"ALTER TABLE students ADD COLUMN {col} {definition}")
            added.append(col)

    conn.commit()
    conn.close()

    if added:
        print(f"✅ Added columns: {', '.join(added)}")
    else:
        print("ℹ️  All certificate columns already exist. Nothing changed.")

if __name__ == "__main__":
    run()
