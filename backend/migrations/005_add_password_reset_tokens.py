"""
Idempotent migration: password_reset_tokens table.
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

    if not table_exists(cursor, "password_reset_tokens"):
        print("Creating table 'password_reset_tokens'...")
        cursor.execute("""
            CREATE TABLE password_reset_tokens (
                id INTEGER PRIMARY KEY,
                user_id INTEGER NOT NULL,
                token_hash VARCHAR(64) NOT NULL UNIQUE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                expires_at DATETIME NOT NULL,
                used_at DATETIME,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        """)
        cursor.execute("CREATE INDEX ix_password_reset_tokens_token_hash ON password_reset_tokens (token_hash)")
    else:
        print("Table 'password_reset_tokens' already exists, skipping.")

    conn.commit()
    conn.close()
    print("Migration 005 completed successfully.")

if __name__ == "__main__":
    migrate()
