"""
Idempotent migration script to add google_refresh_token column to users table.
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

    if not column_exists(cursor, "users", "google_refresh_token"):
        print("Adding column 'google_refresh_token' to 'users'...")
        cursor.execute("ALTER TABLE users ADD COLUMN google_refresh_token VARCHAR(255)")
    else:
        print("Column 'google_refresh_token' already exists in 'users', skipping.")

    conn.commit()
    conn.close()
    print("Migration 005 completed successfully.")


if __name__ == "__main__":
    migrate()
