# HRMS — Human Resource Management System

Full-stack HRMS with role-based access for **management_admin**, **senior_manager**, **hr_recruiter**, and **employee**, extended with 8 AI/ML features.

## Tech stack

| Layer | Stack |
|-------|--------|
| Frontend | React 19 (CRA + CRACO + Tailwind), React Router v6, Zustand, Recharts, react-hot-toast, lucide-react, Axios |
| Backend | FastAPI (Python 3.10), SQLAlchemy 2.0 async (asyncpg), PyJWT, bcrypt, Pydantic v2 |
| Database | **Neon** PostgreSQL (`postgresql+asyncpg://...`) |
| Files | Cloudinary (profile photos + resume PDFs) |
| Cache | Upstash Redis TLS (`REDIS_URL`) — graceful no-op if unavailable |
| AI | Google Gemini 1.5 Flash, Groq Llama-3.3-70b, scikit-learn, spaCy |

API prefix: **`/api/v1`**

Error format:
```json
{ "detail": "Human-readable message", "code": "machine_readable_code" }
```

---

## Environment Variables

### backend/.env

```env
# PostgreSQL — Neon (use postgresql+asyncpg:// driver)
DATABASE_URL=postgresql+asyncpg://user:pass@host/db?ssl=require

# JWT
SECRET_KEY=at-least-32-random-characters
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# Upstash Redis (TLS) — leave empty to disable caching
REDIS_URL=rediss://default:TOKEN@endpoint.upstash.io:6379

# Cloudinary — https://cloudinary.com/console
CLOUDINARY_CLOUD_NAME=your_cloud
CLOUDINARY_API_KEY=your_key
CLOUDINARY_API_SECRET=your_secret

# CORS
CORS_ORIGINS=http://localhost:3000

# AI — OpenRouter (Required for all AI features)
# Get a key at: https://openrouter.ai/keys
OPENROUTER_API_KEY=sk-or-v1-...
```

### frontend/.env

```env
REACT_APP_BACKEND_URL=http://localhost:8000
REACT_APP_WS_URL=ws://localhost:8000
```

---

## Local setup

### 1. Clone and configure environment

```bash
cp backend/.env.example backend/.env
# Fill in all values in backend/.env
echo "REACT_APP_BACKEND_URL=http://localhost:8000" > frontend/.env
```

### 2. Backend

```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt

# Download spaCy model (needed for Resume Screener)
python -m pip install https://github.com/explosion/spacy-models/releases/download/en_core_web_sm-3.7.1/en_core_web_sm-3.7.1-py3-none-any.whl
```

### 3. Seed demo data

```bash
# From backend/ with venv active
python -m seed
```

Creates: 8 users, 3 departments, employees, 30-day attendance, leave balances, payroll (3 months), performance reviews, goals, job postings, candidates, and sentiment check-ins.

### 4. Start backend

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 5. Frontend

```bash
cd frontend
npm install --legacy-peer-deps
npm start   # http://localhost:3000
```

---

## Demo credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@hrms.com | Admin@123 |
| Manager | manager@hrms.com | Manager@123 |
| Recruiter | recruiter@hrms.com | Recruiter@123 |
| Employee | employee1–5@hrms.com | Employee@123 |

---

## Core Modules

1. **Auth** — login, register, JWT refresh, Redis user cache (30 min TTL)
2. **Employees** — CRUD, departments, Cloudinary profile photos
3. **Attendance** — clock-in/out, monthly calendar, team/today views
4. **Leave** — apply, approve/reject, balance tracking, notifications
5. **Payroll** — generate, payslips, mark paid
6. **Performance** — reviews (scored 0-10), goals with progress
7. **Recruitment** — job postings, drag-and-drop Kanban, public apply with PDF upload
8. **Notifications** — in-app bell, 60s polling, mark read
9. **Dashboards** — per-role with real data and Recharts charts
10. **Reports** — overview analytics
11. **Analytics Dashboard** — 5 chart types, 3M/6M/12M toggle, CSV export

---

## AI Features

| # | Feature | Route | Roles |
|---|---------|-------|-------|
| 1 | **Resume Screener** — Gemini scores PDF resumes against job descriptions | `/ai/resume-screener` | Admin, Recruiter |
| 2 | **Interview Bot** — Groq Llama conducts 8-question voice/text interviews | `/ai/interview` | Admin, Recruiter |
| 3 | **Attrition Risk** — ML (Logistic Regression) predicts attrition probability | `/ai/attrition` | Admin, Manager |
| 4 | **Sentiment Pulse** — Gemini analyzes weekly mood check-ins, heatmap by dept | `/ai/sentiment` | Admin, Manager |
| 5 | **Performance Predictor** — Random Forest predicts performance score | Employee profile | Admin, Manager |
| 6 | **Payroll Anomaly Detector** — Isolation Forest flags unusual payroll records | Payroll admin page | Admin |
| 7 | **Leave Optimizer** — Gemini suggests optimal leave windows avoiding team conflicts | Leave apply form | All employees |
| 8 | **Audit Logs** — Full action trail: login, employee changes, leave decisions, payroll | `/ai/audit` | Admin |

---

## Public job application

- Route: `/apply/:jobId` (no auth required)
- API: `POST /api/v1/jobs/{id}/apply`
- Supports JSON or multipart/form-data (with optional resume PDF → Cloudinary)

---

## Re-seed

```bash
cd backend && python -m seed
```

> ⚠️ Seed clears all HRMS tables before inserting fresh demo data.

---

## Push to GitHub

```bash
git init
git add .
git commit -m "feat: HRMS with AI features"
git branch -M main
git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
git push -u origin main
```

Never commit `.env` — only `.env.example`.

---

## Recent Fixes & Optimizations

This project has been heavily optimized for production:

1. **Performance Enhancements**:
   - Resolved N+1 query issues in the dashboard by implementing `selectinload` for Employee relationships.
   - Flattened expensive 12-query attendance trend loops into a single optimized `GROUP BY` SQL query using `func.extract`.
   - Extracted live clock components in React to prevent global 1-second interval re-renders.
   - Added a 60-second Redis Cache layer to heavy analytical dashboard endpoints.
2. **Robust Fallback Logic**:
   - Fixed empty-state edge cases in the Attendance Dashboard. If no one has clocked in for the current day (e.g., weekends/early mornings), the system automatically gracefully falls back to displaying the data from the *Last Active Working Day*.
   - Fixed the 6-Month Attendance Rate calculation to properly factor in total active headcount and actual working days.
3. **Hierarchical Logic Constraints**:
   - Enforced strict manager assignment rules in the frontend. `senior_manager` and `management_admin` roles cannot be assigned a manager, while standard employees can dynamically select their manager from a filtered list of senior staff.

---

## Deployment Guide

### Backend (Render)
1. Create a **Web Service** on Render pointing to the `backend` directory.
2. Build Command: `pip install -r requirements.txt`
3. Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
4. Set Environment Variables: `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `OPENROUTER_API_KEY`.

### Frontend (Vercel)
1. Create a new project on Vercel pointing to the `frontend` directory.
2. Set Environment Variable: `REACT_APP_API_URL` to your Render backend URL (e.g., `https://api.onrender.com/api/v1`).
3. Add a `vercel.json` file to the frontend root to handle React Router SPA rewrites:
   ```json
   { "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
   ```
4. **CORS**: Ensure your new Vercel `.vercel.app` domain is added to the `CORS_ORIGINS` list in your backend `.env` or settings.
