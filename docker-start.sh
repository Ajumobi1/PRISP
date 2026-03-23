#!/usr/bin/env bash
set -euo pipefail

if [ -n "${DATABASE_URL:-}" ]; then
  echo "Running database bootstrap..."
  bootstrapped="false"
  for attempt in $(seq 1 20); do
    if (cd /app/backend && python3 -m app.init_db); then
      bootstrapped="true"
      break
    fi
    echo "Database not ready yet (attempt ${attempt}/20). Retrying in 3s..."
    sleep 3
  done

  if [ "$bootstrapped" != "true" ]; then
    echo "Database bootstrap failed after retries."
    exit 1
  fi
fi

(cd /app/backend && uvicorn app.main:app --host 0.0.0.0 --port "${BACKEND_PORT}") &
(cd /app/frontend && NEXT_TELEMETRY_DISABLED=1 npm run start -- --hostname 0.0.0.0 --port "${PORT}") &

wait
