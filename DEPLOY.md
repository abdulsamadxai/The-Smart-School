# Deploying The Smart School

## 1. Database password

The old Supabase database password was committed in the repo and has been
rotated. The file that contained it is deleted from the code. Always use
the **new** password in `DATABASE_URL`.

## 2. Prepare the database (only if you keep the existing Supabase data)

The app now backfills missing columns itself on boot (`backend/database.py`),
so the SQL file below is a backup, not a requirement:

- Optional: in the Supabase dashboard SQL Editor, run
  `backend/migrations/add_missing_columns.sql`. It adds the columns the
  current code expects (challan fields, certificate fields, `invoice_id`)
  and is safe to run more than once.
- Then, from your computer, run the sequence reset so new registrations
  do not hit the duplicate-key crash:
  ```bash
  cd backend
  DATABASE_URL=postgresql+psycopg2://postgres:<NEW-PASSWORD>@<project-ref>.pooler.supabase.com:6543/postgres \
    python reset_seq_final.py
  ```
- If you prefer a fresh database instead, skip both steps: the app creates
  the full schema on first boot.

## 3. Deploy the backend on Render

1. In Render, **New → Blueprint**, connect the `The-Smart-School` repo.
   Render reads `render.yaml` and creates the `smart-school-api` service.
2. When Render asks for the missing values, set them in the dashboard:
   - `DATABASE_URL` — the Supabase Postgres URL **with the new password**.
   - `ADMIN_PASSWORD`, `DIRECTOR_PASSWORD`, `CASH_ADMIN_PASSWORD`,
     `BANK_ADMIN_PASSWORD` — strong passwords of your own choosing.
     (With `ENVIRONMENT=production` the backend refuses to start on the
     well-known defaults, so these must be set.)
3. Deploy. The backend health check is `GET /health`.

## 4. Deploy the frontend on Vercel

1. In Vercel, import the `The-Smart-School` repo (root directory
   `frontend` — `vercel.json` already sets the Vite build).
2. Set the environment variable `VITE_API_BASE_URL` to the Render backend
   URL, e.g. `https://smart-school-api.onrender.com`, then deploy.
   Without it the frontend talks to `http://localhost:8000` and nothing loads.
3. If Vercel gives the app a different hostname than
   `the-smart-school.vercel.app`, update the backend's `ALLOWED_ORIGINS`
   env var in Render to that URL (Render redeploys automatically).

## 5. Verify

- Open the frontend URL and log in with the admin credentials you set.
- The dashboard should load, and registering a test student should work.
- Check `https://<api-url>/health` returns `{"status": "ok", ...}`.
- On the Certificates page, the Mark Paid buttons, the dues challan print,
  and the no-dues clearance print must all work (they were crashing before
  this fix). A student with unpaid admission fees must NOT show
  "Clearance Granted".
- On the Director dashboard, printing a daily slip must mark it PRINTED
  (the print is now recorded in the backend).

## Local development

```bash
# Backend (from backend/): copy .env.example to .env and fill it in
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Frontend (from frontend/)
npm ci
npm run dev        # talks to http://localhost:8000 by default
```
