"""
Idempotent migration: create usage_logs table.
"""
import os
import sqlite3
import sys

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "instance", "app.db")


def table_exists(cursor, table):
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table,))
    return cursor.fetchone() is not None


def migrate():
    if not os.path.exists(DB_PATH):
        print(f"Database not found at {DB_PATH}, skipping migration.")
        sys.exit(0)

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    if table_exists(cursor, "usage_logs"):
        print("Table 'usage_logs' already exists, skipping.")
    else:
        print("Creating table 'usage_logs'...")
        cursor.execute("""
            CREATE TABLE usage_logs (
                id INTEGER PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                query_id INTEGER REFERENCES queries(id),
                session_query_id INTEGER REFERENCES session_queries(id),
                session_participant_id INTEGER REFERENCES session_participants(id),
                generation_id VARCHAR(100),
                model_name VARCHAR(200) NOT NULL,
                prompt_tokens INTEGER NOT NULL DEFAULT 0,
                completion_tokens INTEGER NOT NULL DEFAULT 0,
                total_tokens INTEGER NOT NULL DEFAULT 0,
                cost_usd NUMERIC(20, 10),
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        cursor.execute("CREATE INDEX ix_usage_logs_generation_id ON usage_logs (generation_id)")
        cursor.execute("CREATE INDEX ix_usage_logs_user_id ON usage_logs (user_id)")
        cursor.execute("CREATE INDEX ix_usage_logs_created_at ON usage_logs (created_at)")

    conn.commit()
    conn.close()
    print("Migration 003 completed successfully.")


if __name__ == "__main__":
    migrate()
