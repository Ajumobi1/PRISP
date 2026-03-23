## PRS Unit Task Tracker

This repository now focuses only on the Unit Task Tracker module.

### Scope

- Backend API for task management and task attachments
- Frontend tracker UI (table + kanban views)
- PostgreSQL schema limited to tracker-related tables

### Main Routes

- Frontend: `/task-tracker` (root `/` redirects here)
- Backend base: `/api/v1/tasks`

### Tracker Features

- Create/list/update/delete tasks
- Multi-assignee entry (saved as joined assignee names)
- Upload multiple files per task
- Download and delete task attachments
- Export tasks as CSV, XLSX, and PDF

### Quick Start

#### Backend

1. `cd backend`
2. `pip install -r requirements.txt`
3. Set `DATABASE_URL` and `ALLOWED_ORIGINS`
4. `python -m app.init_db`
5. `uvicorn app.main:app --host 0.0.0.0 --port 8000`

#### Frontend

1. `cd frontend`
2. `npm install`
3. `npm run dev`

Set `BACKEND_API_BASE_URL` for non-local environments.

### GitHub Push

From repository root:

1. `git add .`
2. `git commit -m "prepare tracker for portable deployment"`
3. `git remote add origin <your-github-repo-url>` (skip if origin already exists)
4. `git push -u origin main`

### Deploy Anywhere (Provider-Agnostic)

Deploy frontend and backend as separate services on any platform that supports custom build/start commands.

#### Backend service

- Root directory: `backend`
- Build command: `pip install -r requirements.txt`
- Start command: `python -m app.init_db && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}`
- Required env vars:
	- `DATABASE_URL`
	- `ALLOWED_ORIGINS` (comma-separated frontend origins)
	- optional `ALLOWED_ORIGIN_REGEX`

#### Frontend service

- Root directory: `frontend`
- Build command: `npm install && npm run build`
- Start command: `npm run start -- --hostname 0.0.0.0 --port ${PORT:-3000}`
- Required env vars:
	- `BACKEND_API_BASE_URL` (example: `https://your-backend-domain.com/api/v1`)

### Deploy Checklist

- Ensure backend is reachable at `/api/v1/health`
- Ensure frontend can call `/api/v1/tasks` via rewrite proxy
- Set production frontend URL in backend `ALLOWED_ORIGINS`
- Confirm uploads directory is writable by backend runtime

### Full Deployment Guides

See `docs/deploy.md` for complete copy-paste setup for Railway, Render, Fly.io, and VPS.

