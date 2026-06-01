# HRMS — Human Resource Management System

Full-stack HRMS with role-based access for **management_admin**, **senior_manager**, **hr_recruiter**, and **employee**.

## Tech stack

| Layer | Stack |
|-------|--------|
| Frontend | React (CRA + Tailwind), React Router v6, Zustand, Recharts, react-hot-toast, lucide-react |
| Backend | FastAPI, SQLAlchemy 2.0 (async), JWT, bcrypt |
| Database | PostgreSQL (Supabase-compatible `DATABASE_URL`) |
| Files | Cloudinary (profile photos + resume PDFs) |
| Cache | Redis / Upstash (`REDIS_URL`) |

API prefix: **`/api/v1`**

Error format (all API errors):

```json
{ "detail": "Human-readable message", "code": "machine_readable_code" }
```

## Project layout

```
ai-hr-main/
├── backend/          # FastAPI app (app/main.py)
├── frontend/         # React app (src/App.js)
└── README.md
```

## Local setup

### 1. Environment

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Edit `backend/.env` with your PostgreSQL, Redis, Cloudinary, and `SECRET_KEY` (32+ characters).

Edit `frontend/.env`:

```env
REACT_APP_BACKEND_URL=http://localhost:8000
```

### 2. Backend

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
```

Start API (from `backend/`):

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Or use the thin entrypoint:

```bash
uvicorn server:app --reload --port 8000
```

### 3. Seed demo data

```bash
cd backend
python -m seed
```

Creates users, departments, employees, 30 days attendance, leave balances, payroll, performance reviews, jobs, and candidates.

### 4. Frontend

```bash
cd frontend
yarn install   # or npm install
yarn start     # http://localhost:3000
```

## Demo credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@hrms.com | Admin@123 |
| Manager | manager@hrms.com | Manager@123 |
| Recruiter | recruiter@hrms.com | Recruiter@123 |
| Employee | employee1@hrms.com … employee5@hrms.com | Employee@123 |

## Modules

1. **Auth** — register, login, refresh, `/me`; Redis user cache (30 min TTL)
2. **Employees** — CRUD, search, departments, Cloudinary profile photos
3. **Attendance** — clock-in/out, calendar, team/admin views
4. **Leave** — apply, balances, manager/admin approve/reject + notifications
5. **Payroll** — generate, payslips, mark paid (admin)
6. **Performance** — reviews, goals, team view (manager)
7. **Recruitment** — jobs, Kanban pipeline, public apply (`/apply/:jobId`) with PDF upload
8. **Notifications** — navbar bell, mark read
9. **Dashboards** — per role (admin, manager, recruiter, employee)
10. **Reports** — admin analytics (extra)
11. **Settings** — UI preferences (client-side; no backend persistence)

## Public job application

- Route: `/apply/:jobId`
- API: `POST /api/v1/jobs/{id}/apply` (no auth)
- Supports **JSON** (`resume_url` optional) or **multipart** (`resume` PDF → Cloudinary)

## Push to GitHub

From the project root (`ai-hr-main/`):

```bash
git init
git add .
git commit -m "Initial HRMS: FastAPI + React full stack"
git branch -M main
git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
git push -u origin main
```

Never commit `.env` files — only `.env.example`.

## Re-seed

```bash
cd backend && python -m seed
```

Warning: seed **clears** existing HRMS tables before inserting demo data.

## Notes

- Frontend uses **Create React App** (not Vite). Migrating to Vite is optional; set `VITE_API_URL` if you do.
- Supabase: use `postgresql+asyncpg://...` in `DATABASE_URL`.
- Settings page is display-only until backend persistence is added.
