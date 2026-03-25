## PRISP Frontend-Only Portal

This project now runs as a single Next.js frontend app with:

- Unit Task Tracker (`/task-tracker`)
- Dashboard (`/dashboard`)
- Account Admin (`/account-admin`)

No backend service is required.

### Default Admin Login

- Username: `admin`
- Password: `admin`

Use this account to approve, decline, lock, and unlock registered users.

### Run Locally (single command flow)

1. `cd frontend`
2. `npm install`
3. `npm run dev`

Open `http://localhost:3000`.

### Data Persistence

All data is stored in browser `localStorage`:

- Tasks and task attachments
- Accounts and admin status changes
- Active login session

Because data is browser-local, each browser/device has its own separate dataset.

### Deployment

Deploy only the frontend service (`frontend` directory). Example Render blueprint is in `render.yaml`.
