"""
Idempotent migration: store the participant's live editor text so teachers
can follow along (current_text, text_updated_at).
"""
import os
import sqlite3
import sys

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "instance", "app.db")


def column_exists(cursor, table, column):
    cursor.execute(f"PRAGMA table_info({table})")
    return any(row[1] == column for row in cursor.fetchall())


def table_exists(cursor, table):
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table,))
    return cursor.fetchone() is not None


def migrate():
    if not os.path.exists(DB_PATH):
        print(f"Database not found at {DB_PATH}, skipping migration.")
        sys.exit(0)

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    new_columns = {
        "current_text": "ALTER TABLE session_participants ADD COLUMN current_text TEXT NOT NULL DEFAULT ''",
        "text_updated_at": "ALTER TABLE session_participants ADD COLUMN text_updated_at DATETIME",
    }
    for column, ddl in new_columns.items():
        if table_exists(cursor, "session_participants") and not column_exists(cursor, "session_participants", column):
            print(f"Adding column '{column}' to 'session_participants'...")
            cursor.execute(ddl)
        else:
            print(f"Column '{column}' already exists in 'session_participants', skipping.")

    conn.commit()
    conn.close()
    print("Migration 010 completed successfully.")


if __name__ == "__main__":
    migrate()
