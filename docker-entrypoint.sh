#!/bin/sh
set -eu

cleanup() {
  if [ -n "${BACKEND_PID:-}" ]; then
    kill "$BACKEND_PID" 2>/dev/null || true
  fi
  if [ -n "${FRONTEND_PID:-}" ]; then
    kill "$FRONTEND_PID" 2>/dev/null || true
  fi
}

trap cleanup INT TERM EXIT

mkdir -p "${FLASK_INSTANCE_PATH:-/app/backend/instance}"

cd /app/backend

# Initialize the database before starting Gunicorn
# (init_db was previously inside 'if __name__ == __main__', which Gunicorn skips)
echo "[Entrypoint] Initializing database..."
/app/.venv/bin/python -c "from app import app; from models import init_db; app.app_context().push(); init_db()"

# Start backend with Gunicorn + gevent workers
# -k gevent          : async workers that handle many concurrent I/O waits
# -w 2               : 2 workers (safe for 1 vCPU + 2GB RAM)
# --worker-connections 500 : each worker can juggle 500 concurrent connections
# --bind 0.0.0.0:5000 : listen on all interfaces
# --access-logfile - : log to stdout
# --error-logfile -  : errors to stdout
# --capture-output   : capture print() statements from Flask
echo "[Entrypoint] Starting backend with Gunicorn (gevent) on port 5000..."
/app/.venv/bin/gunicorn \
    -k gevent \
    -w 2 \
    --worker-connections 500 \
    --bind 0.0.0.0:5000 \
    --access-logfile - \
    --error-logfile - \
    --capture-output \
    --enable-stdio-inheritance \
    app:app > /tmp/backend.log 2>&1 &
BACKEND_PID=$!
echo "[Entrypoint] Backend PID: $BACKEND_PID"

# Wait for backend to be ready
echo "[Entrypoint] Waiting for backend to start..."
for i in 1 2 3 4 5 6 7 8 9 10; do
    if curl -s http://127.0.0.1:5000/ > /dev/null 2>&1; then
        echo "[Entrypoint] Backend is ready!"
        break
    fi
    echo "[Entrypoint] Waiting... ($i/10)"
    sleep 1
done

cd /app/frontend
echo "[Entrypoint] Starting frontend on port 3000..."
npm run start &
FRONTEND_PID=$!
echo "[Entrypoint] Frontend PID: $FRONTEND_PID"

wait "$BACKEND_PID" "$FRONTEND_PID"
