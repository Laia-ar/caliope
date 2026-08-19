"""
Idempotent migration: add session_stages table, current_stage_id to
session_participants and stage_id to session_queries. Backfills one stage
per existing session from its instructions/custom_prompt_id.
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

    if not table_exists(cursor, "session_stages"):
        print("Creating table 'session_stages'...")
        cursor.execute(
            """
            CREATE TABLE session_stages (
                id INTEGER PRIMARY KEY,
                session_id INTEGER NOT NULL REFERENCES classroom_sessions(id),
                position INTEGER NOT NULL DEFAULT 1,
                instructions TEXT NOT NULL DEFAULT '',
                custom_prompt_id INTEGER REFERENCES custom_prompts(id)
            )
            """
        )
    else:
        print("Table 'session_stages' already exists, skipping.")

    if table_exists(cursor, "classroom_sessions"):
        cursor.execute(
            """
            INSERT INTO session_stages (session_id, position, instructions, custom_prompt_id)
            SELECT s.id, 1, s.instructions, s.custom_prompt_id
            FROM classroom_sessions s
            WHERE NOT EXISTS (SELECT 1 FROM session_stages st WHERE st.session_id = s.id)
            """
        )
        if cursor.rowcount:
            print(f"Backfilled stage 1 for {cursor.rowcount} existing session(s).")

    if not column_exists(cursor, "session_participants", "current_stage_id"):
        print("Adding column 'current_stage_id' to 'session_participants'...")
        cursor.execute(
            "ALTER TABLE session_participants ADD COLUMN current_stage_id INTEGER REFERENCES session_stages(id)"
        )
    else:
        print("Column 'current_stage_id' already exists in 'session_participants', skipping.")

    if not column_exists(cursor, "session_queries", "stage_id"):
        print("Adding column 'stage_id' to 'session_queries'...")
        cursor.execute(
            "ALTER TABLE session_queries ADD COLUMN stage_id INTEGER REFERENCES session_stages(id)"
        )
    else:
        print("Column 'stage_id' already exists in 'session_queries', skipping.")

    conn.commit()
    conn.close()
    print("Migration 008 completed successfully.")


if __name__ == "__main__":
    migrate()
