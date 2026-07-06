"""
Idempotent migration script to add institutions, grades and user_grades tables,
and grade_id to classroom_sessions.
"""
import sqlite3
import os
import sys

DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'instance', 'app.db')


def table_exists(cursor, table):
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table,))
    return cursor.fetchone() is not None


def column_exists(cursor, table, column):
    cursor.execute(f"PRAGMA table_info({table})")
    return any(row[1] == column for row in cursor.fetchall())


def migrate():
    if not os.path.exists(DB_PATH):
        print(f"Database not found at {DB_PATH}")
        sys.exit(1)

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    if not table_exists(cursor, "institutions"):
        print("Creating table 'institutions'...")
        cursor.execute("""
            CREATE TABLE institutions (
                id INTEGER PRIMARY KEY,
                name VARCHAR(200) NOT NULL UNIQUE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
    else:
        print("Table 'institutions' already exists, skipping.")

    if not table_exists(cursor, "grades"):
        print("Creating table 'grades'...")
        cursor.execute("""
            CREATE TABLE grades (
                id INTEGER PRIMARY KEY,
                institution_id INTEGER NOT NULL,
                name VARCHAR(100) NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (institution_id) REFERENCES institutions (id),
                UNIQUE (institution_id, name)
            )
        """)
    else:
        print("Table 'grades' already exists, skipping.")

    if not table_exists(cursor, "user_grades"):
        print("Creating table 'user_grades'...")
        cursor.execute("""
            CREATE TABLE user_grades (
                id INTEGER PRIMARY KEY,
                grade_id INTEGER NOT NULL,
                email VARCHAR(100) NOT NULL,
                user_id INTEGER,
                role VARCHAR(20) NOT NULL DEFAULT 'student',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (grade_id) REFERENCES grades (id),
                FOREIGN KEY (user_id) REFERENCES users (id),
                UNIQUE (grade_id, email)
            )
        """)
    else:
        print("Table 'user_grades' already exists, skipping.")

    if not column_exists(cursor, "classroom_sessions", "grade_id"):
        print("Adding column 'grade_id' to 'classroom_sessions'...")
        cursor.execute("ALTER TABLE classroom_sessions ADD COLUMN grade_id INTEGER REFERENCES grades (id)")
    else:
        print("Column 'grade_id' already exists in 'classroom_sessions', skipping.")

    conn.commit()
    conn.close()
    print("Migration 006 completed successfully.")


if __name__ == "__main__":
    migrate()
