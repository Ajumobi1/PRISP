#!/bin/bash
set -e

# Initialize database
psql -U postgres -c "CREATE DATABASE prisp;" 2>/dev/null || true
psql -U postgres -d prisp -f database/schema.sql

# Start backend and frontend in parallel
(cd backend && uvicorn app.main:app --host 0.0.0.0 --port 8000) &
(cd frontend && npm run dev -- -H 0.0.0.0 -p 3000) &

wait
