"""
One-time migration script to add `payment_method` column to fee_records table.
Run once with: python migrate_payment_method.py
"""
import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "school_admissions.db")

def run():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Check if column already exists
    cursor.execute("PRAGMA table_info(fee_records)")
    columns = [row[1] for row in cursor.fetchall()]

    if "payment_method" not in columns:
        cursor.execute(
            "ALTER TABLE fee_records ADD COLUMN payment_method VARCHAR DEFAULT NULL"
        )
        conn.commit()
        print("✅ Column 'payment_method' added to fee_records successfully.")
    else:
        print("ℹ️ Column 'payment_method' already exists. No changes made.")

    conn.close()

if __name__ == "__main__":
    run()
