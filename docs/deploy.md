# Deployment Guide

## Render (Frontend Only)

This project is now a single Next.js frontend deployment.

### Steps

1. Push latest code to GitHub.
2. In Render, click **New** -> **Blueprint**.
3. Select this repository.
4. Render reads `render.yaml` and creates one service:
   - `prisp-frontend` (Next.js)
5. Click **Apply** / **Create**.

### Health Check

- Frontend: `/`

### Notes

- No backend, no database, and no backend env vars are required.
- App data (tasks, accounts, session, attachments) is stored in browser `localStorage`.
- Data is local to each browser/device and is not shared across users.
