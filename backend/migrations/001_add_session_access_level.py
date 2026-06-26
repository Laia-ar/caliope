"""
Idempotent migration: add access_level to classroom_sessions and user_id to session_participants.
"""
import os
import sqlite3
import sys

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "instance", "app.db")


def column_exists(cursor, table, column):
    cursor.execute(f"PRAGMA table_info({table})")
    return any(row[1] == column for row in cursor.fetchall())


def migrate():
    if not os.path.exists(DB_PATH):
        print(f"Database not found at {DB_PATH}, skipping migration.")
        sys.exit(0)

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    if not column_exists(cursor, "classroom_sessions", "access_level"):
        print("Adding column 'access_level' to 'classroom_sessions'...")
        cursor.execute(
            "ALTER TABLE classroom_sessions ADD COLUMN access_level VARCHAR(20) NOT NULL DEFAULT 'registered'"
        )
    else:
        print("Column 'access_level' already exists in 'classroom_sessions', skipping.")

    if not column_exists(cursor, "session_participants", "user_id"):
        print("Adding column 'user_id' to 'session_participants'...")
        cursor.execute(
            "ALTER TABLE session_participants ADD COLUMN user_id INTEGER REFERENCES users(id)"
        )
    else:
        print("Column 'user_id' already exists in 'session_participants', skipping.")

    conn.commit()
    conn.close()
    print("Migration 001 completed successfully.")


if __name__ == "__main__":
    migrate()
