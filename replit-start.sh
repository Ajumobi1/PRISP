#!/bin/bash
set -euo pipefail

if [ ! -d "frontend/node_modules" ] || [ ! -d "frontend/.next" ]; then
	bash ./replit-build.sh
fi

# Replit deployments may not provide a local Postgres service.
# If DATABASE_URL is configured and psql is present, try schema init but do not fail startup.
if command -v psql >/dev/null 2>&1 && [ -n "${DATABASE_URL:-}" ]; then
	psql "$DATABASE_URL" -f database/schema.sql >/dev/null 2>&1 || true
fi

(cd backend && uvicorn app.main:app --host 0.0.0.0 --port 8000) &
(cd frontend && NEXT_TELEMETRY_DISABLED=1 npm run start -- --hostname 0.0.0.0 --port 3000) &

wait
