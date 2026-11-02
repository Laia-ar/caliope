"""
Idempotent data migration: expire the trial of legacy password-only users.

All users with a username and password but no Google account are considered
invited users whose trial has ended; they will see the renewal message at
login. The environment admin user (ADMIN_USERNAME, default 'admin') is
excluded.

Run via: python backend/migrations/run_migrations.py
"""
import sqlite3
import os
import sys

DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'instance', 'app.db')

ADMIN_USERNAME = os.getenv('ADMIN_USERNAME', 'admin')
EXPIRED_AT = '2026-01-01 00:00:00'

def column_exists(cursor, table, column):
    cursor.execute(f"PRAGMA table_info({table})")
    return any(row[1] == column for row in cursor.fetchall())

def migrate():
    if not os.path.exists(DB_PATH):
        print(f"Database not found at {DB_PATH}")
        sys.exit(1)

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    if not column_exists(cursor, "users", "trial_expires_at"):
        print("Column 'trial_expires_at' does not exist yet; run 001_add_invitations.py first.")
        conn.close()
        sys.exit(1)

    cursor.execute(
        """
        UPDATE users
        SET trial_expires_at = ?
        WHERE google_id IS NULL
          AND username IS NOT NULL
          AND LOWER(username) != LOWER(?)
          AND (trial_expires_at IS NULL OR trial_expires_at > ?)
        """,
        (EXPIRED_AT, ADMIN_USERNAME, EXPIRED_AT),
    )
    print(f"Marked {cursor.rowcount} legacy password users as trial-expired.")

    conn.commit()
    conn.close()
    print("Migration 003 completed successfully.")

if __name__ == "__main__":
    migrate()
