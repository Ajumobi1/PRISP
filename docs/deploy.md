# Deployment Guide

## Render (Deploy Together)

This repo includes a Render Blueprint at `render.yaml` so you can deploy database + backend + frontend in one flow.

### Steps

1. Push latest code to GitHub.
2. In Render, click **New** -> **Blueprint**.
3. Select this GitHub repository.
4. Render reads `render.yaml` and shows:
   - `prisp-db` (PostgreSQL)
   - `prisp-backend` (FastAPI)
   - `prisp-frontend` (Next.js)
5. Click **Apply** / **Create**.

### After first deploy

Update these env vars in Render to match your real service URLs (if your names differ):

- Backend `ALLOWED_ORIGINS` = your frontend URL
- Frontend `BACKEND_API_BASE_URL` = your backend URL + `/api/v1`

Then redeploy both services.

### Health checks

- Backend: `/api/v1/health`
- Frontend: `/`

### Notes

- Backend startup runs DB initialization automatically:
  - `python -m app.init_db && uvicorn ...`
- Frontend uses rewrite proxy through `BACKEND_API_BASE_URL`.
- Task attachments are stored on service disk; for long-term persistence across redeploys, move attachments to object storage (e.g., S3-compatible bucket).
