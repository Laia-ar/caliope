"""
Run all migration scripts in this directory.

Scripts are executed in alphabetical order. Each script should be idempotent
so it can run safely on every deploy.
"""
import importlib.util
import os
import sys

MIGRATIONS_DIR = os.path.dirname(os.path.abspath(__file__))

def run_migrations():
    files = sorted(f for f in os.listdir(MIGRATIONS_DIR) if f.endswith(".py") and f != "run_migrations.py")
    if not files:
        print("No migrations to run.")
        return

    for filename in files:
        path = os.path.join(MIGRATIONS_DIR, filename)
        print(f"Running migration: {filename}")
        spec = importlib.util.spec_from_file_location(f"migration_{filename[:-3]}", path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        if hasattr(module, "migrate"):
            module.migrate()
        print(f"Finished migration: {filename}")

    print("All migrations completed.")

if __name__ == "__main__":
    run_migrations()
