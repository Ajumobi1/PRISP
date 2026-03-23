# ODCHC PRISP (PRS Intelligence & Strategy Portal)

Central Brain platform for PRS operations at ODCHC.

## Stack

- Frontend: Next.js (TypeScript), Tailwind CSS, shadcn-style UI primitives
- Backend: FastAPI (Python)
- Database: PostgreSQL

## Workspace Layout

- `frontend/` - Next.js portal UI
- `backend/` - FastAPI service layer
- `database/schema.sql` - Core database schema
- `docs/data-dictionary.md` - Entity overview

## Quick Start

### 1) Frontend

```bash
cd frontend
npm install
npm run dev
```

Open: `http://localhost:3000/task-tracker`

### 2) Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload --port 8000
```

API docs: `http://localhost:8000/docs`

### 3) Database

Create a PostgreSQL database then run:

```bash
psql -U postgres -d prisp -f database/schema.sql
```

## Smoke Test Checklist

1. Backend health endpoint: `GET http://localhost:8000/health` should return `200`.
2. Task API without DB should return `503` (graceful fail) if PostgreSQL is down.
3. Task API with DB up should allow:
	- `POST /api/v1/tasks`
	- `GET /api/v1/tasks`
	- `GET /api/v1/tasks/export/csv|xlsx|pdf`

## One-Command Full Stack Test (Docker)

From project root:

```bash
docker compose up --build
```

Then open:

- Frontend: `http://localhost:3000/task-tracker`
- Backend docs: `http://localhost:8000/docs`

Stop with:

```bash
docker compose down
```

## Push to New GitHub Repository

```bash
git init
git add .
git commit -m "Initial PRISP full-stack build"
git branch -M main
git remote add origin <your-new-repo-url>
git push -u origin main
```

## Cloud Testing Options

- **Replit**: Import from GitHub, then run with Docker (`docker compose up --build`) in a deployment-capable Replit environment.
- **Railway/Render/Fly.io**: Deploy with the included Dockerfiles and managed PostgreSQL.

## Task Tracker API

- `GET /api/v1/tasks`
- `POST /api/v1/tasks`
- `PUT /api/v1/tasks/{task_id}`
- `DELETE /api/v1/tasks/{task_id}`
- `GET /api/v1/tasks/export/csv`
- `GET /api/v1/tasks/export/xlsx`
- `GET /api/v1/tasks/export/pdf`
