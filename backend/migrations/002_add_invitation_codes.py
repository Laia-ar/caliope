"""
Idempotent migration: multi-use invitation codes tables.
Run via: python backend/migrations/run_migrations.py
"""
import sqlite3
import os
import sys

DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'instance', 'app.db')

def table_exists(cursor, table):
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table,))
    return cursor.fetchone() is not None

def migrate():
    if not os.path.exists(DB_PATH):
        print(f"Database not found at {DB_PATH}")
        sys.exit(1)

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    if not table_exists(cursor, "invitation_codes"):
        print("Creating table 'invitation_codes'...")
        cursor.execute("""
            CREATE TABLE invitation_codes (
                id INTEGER PRIMARY KEY,
                code VARCHAR(64) NOT NULL UNIQUE,
                created_by_id INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                duration_days INTEGER NOT NULL,
                max_uses INTEGER,
                uses_count INTEGER NOT NULL DEFAULT 0,
                is_active BOOLEAN NOT NULL DEFAULT 1,
                expires_at DATETIME NOT NULL,
                FOREIGN KEY (created_by_id) REFERENCES users (id)
            )
        """)
        cursor.execute("CREATE INDEX ix_invitation_codes_code ON invitation_codes (code)")
    else:
        print("Table 'invitation_codes' already exists, skipping.")

    if not table_exists(cursor, "invitation_code_uses"):
        print("Creating table 'invitation_code_uses'...")
        cursor.execute("""
            CREATE TABLE invitation_code_uses (
                id INTEGER PRIMARY KEY,
                code_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (code_id) REFERENCES invitation_codes (id),
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        """)
    else:
        print("Table 'invitation_code_uses' already exists, skipping.")

    conn.commit()
    conn.close()
    print("Migration 002 completed successfully.")

if __name__ == "__main__":
    migrate()
