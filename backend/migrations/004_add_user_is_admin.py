"""
Idempotent migration script to add is_admin column to users table.
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

    if not column_exists(cursor, "users", "is_admin"):
        print("Adding column 'is_admin' to 'users'...")
        cursor.execute("ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT 0")
    else:
        print("Column 'is_admin' already exists in 'users', skipping.")

    conn.commit()
    conn.close()
    print("Migration 004 completed successfully.")


if __name__ == "__main__":
    migrate()
