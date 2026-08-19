"""
Idempotent migration: link classroom sessions to Classroom coursework and
track per-participant submissions (submitted_at, submission_url).
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

    new_session_columns = {
        "classroom_course_id": "ALTER TABLE classroom_sessions ADD COLUMN classroom_course_id VARCHAR(64)",
        "classroom_coursework_id": "ALTER TABLE classroom_sessions ADD COLUMN classroom_coursework_id VARCHAR(64)",
        "classroom_coursework_url": "ALTER TABLE classroom_sessions ADD COLUMN classroom_coursework_url VARCHAR(512)",
    }
    for column, ddl in new_session_columns.items():
        if table_exists(cursor, "classroom_sessions") and not column_exists(cursor, "classroom_sessions", column):
            print(f"Adding column '{column}' to 'classroom_sessions'...")
            cursor.execute(ddl)
        else:
            print(f"Column '{column}' already exists in 'classroom_sessions', skipping.")

    new_participant_columns = {
        "submitted_at": "ALTER TABLE session_participants ADD COLUMN submitted_at DATETIME",
        "submission_url": "ALTER TABLE session_participants ADD COLUMN submission_url VARCHAR(512)",
    }
    for column, ddl in new_participant_columns.items():
        if table_exists(cursor, "session_participants") and not column_exists(cursor, "session_participants", column):
            print(f"Adding column '{column}' to 'session_participants'...")
            cursor.execute(ddl)
        else:
            print(f"Column '{column}' already exists in 'session_participants', skipping.")

    conn.commit()
    conn.close()
    print("Migration 009 completed successfully.")


if __name__ == "__main__":
    migrate()
