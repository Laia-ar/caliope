"""
Idempotent migration script to add focused_passage column to queries table.
Run manually once: python backend/migrations/add_focused_passage.py
"""
import sqlite3
import os
import sys

DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'instance', 'app.db')

def column_exists(cursor, table, column):
    cursor.execute(f"PRAGMA table_info({table})")
    return any(row[1] == column for row in cursor.fetchall())

def migrate():
    if not os.path.exists(DB_PATH):
        print(f"Database not found at {DB_PATH}")
        sys.exit(1)

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    if not column_exists(cursor, "queries", "focused_passage"):
        print("Adding column 'focused_passage' to 'queries'...")
        cursor.execute("ALTER TABLE queries ADD COLUMN focused_passage TEXT")
    else:
        print("Column 'focused_passage' already exists in 'queries', skipping.")

    conn.commit()
    conn.close()
    print("Migration completed.")

if __name__ == "__main__":
    migrate()
