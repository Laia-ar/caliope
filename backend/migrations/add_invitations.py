"""
Idempotent migration script to add invitation-related columns and table.
Run manually once: python backend/migrations/add_invitations.py
"""
import sqlite3
import os
import sys

DB_PATH = os.path.join(os.path.dirname(__file__), '..', '..', 'instance', 'app.db')

def column_exists(cursor, table, column):
    cursor.execute(f"PRAGMA table_info({table})")
    return any(row[1] == column for row in cursor.fetchall())

def table_exists(cursor, table):
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table,))
    return cursor.fetchone() is not None

def migrate():
    if not os.path.exists(DB_PATH):
        print(f"Database not found at {DB_PATH}")
        sys.exit(1)

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Add columns to users table
    new_columns = [
        ("can_create_invites", "BOOLEAN DEFAULT 0"),
        ("trial_expires_at", "DATETIME"),
        ("is_disabled", "BOOLEAN DEFAULT 0"),
    ]

    for col_name, col_type in new_columns:
        if not column_exists(cursor, "users", col_name):
            print(f"Adding column '{col_name}' to 'users'...")
            cursor.execute(f"ALTER TABLE users ADD COLUMN {col_name} {col_type}")
        else:
            print(f"Column '{col_name}' already exists in 'users', skipping.")

    # Create invitation_links table
    if not table_exists(cursor, "invitation_links"):
        print("Creating table 'invitation_links'...")
        cursor.execute("""
            CREATE TABLE invitation_links (
                id INTEGER PRIMARY KEY,
                token VARCHAR(64) NOT NULL UNIQUE,
                created_by_id INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                used_by_id INTEGER,
                used_at DATETIME,
                expires_at DATETIME,
                FOREIGN KEY (created_by_id) REFERENCES users (id),
                FOREIGN KEY (used_by_id) REFERENCES users (id)
            )
        """)
        cursor.execute("CREATE INDEX ix_invitation_links_token ON invitation_links (token)")
    else:
        print("Table 'invitation_links' already exists, skipping.")

    conn.commit()
    conn.close()
    print("Migration completed successfully.")

if __name__ == "__main__":
    migrate()
