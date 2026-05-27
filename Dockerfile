FROM node:20-bookworm-slim AS frontend-builder
WORKDIR /frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
ARG NEXT_PUBLIC_BACKEND_URL=http://127.0.0.1:5000
ENV NEXT_PUBLIC_BACKEND_URL=${NEXT_PUBLIC_BACKEND_URL}
RUN npm run build

FROM node:20-bookworm-slim
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-venv python3-pip curl \
    && rm -rf /var/lib/apt/lists/*

# Create Python virtual environment
RUN python3 -m venv /app/.venv
ENV PATH="/app/.venv/bin:$PATH"

COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

COPY backend/ /app/backend/

COPY --from=frontend-builder /frontend/package*.json /app/frontend/
COPY --from=frontend-builder /frontend/.next /app/frontend/.next
COPY --from=frontend-builder /frontend/public /app/frontend/public
COPY --from=frontend-builder /frontend/next.config.* /app/frontend/
RUN cd /app/frontend && npm ci --omit=dev

COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    FLASK_ENV=production \
    BACKEND_URL=http://127.0.0.1:5000 \
    FRONTEND_URL=http://127.0.0.1:3000 \
    FLASK_INSTANCE_PATH=/app/backend/instance

EXPOSE 3000 5000

ENTRYPOINT ["/app/docker-entrypoint.sh"]
