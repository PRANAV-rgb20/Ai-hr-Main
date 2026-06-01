# HRMS — Product Requirements Document

## Original Problem Statement
Build a full-stack HRMS with 4 roles (management_admin, senior_manager, hr_recruiter, employee), modules for Auth, Employees, Attendance, Leave, Payroll, Performance, Recruitment, Notifications, and role-based dashboards. Tech stack: React + FastAPI + PostgreSQL/Supabase + Cloudinary + Upstash Redis. JWT auth with bcrypt. Clean modern UI, white backgrounds, primary blue #2563EB, sidebar + navbar layout, mobile responsive.

## Tech Adaptations Made
- Frontend: CRA used in place of Vite (Emergent template constraint; Vite would require supervisor rewrite)
- Database: Local PostgreSQL (Supabase project was unreachable: free-tier IPv6 + pooler returned "tenant not found"). DATABASE_URL is fully env-driven so swap is trivial later.
- All other choices (FastAPI/SQLAlchemy/JWT/bcrypt/Cloudinary/Upstash Redis) match spec.

## Personas
- Admin (management_admin): full read/write across org
- Manager (senior_manager): own team only; can approve/reject leaves for team
- Recruiter (hr_recruiter): recruitment-only (deferred this iteration)
- Employee: own data only; clock in/out; apply leaves

## Core Requirements (static)
- JWT auth with 30-min access / 7-day refresh
- All API endpoints under /api/v1 prefix
- Bcrypt password hashing; Redis cache of user objects (30 min TTL)
- Role-based route guards on backend + frontend
- All list endpoints paginated (default 10)

## Implemented (2026-02)
- Auth: register, login, refresh, /me
- Employees: list (paginated, searchable, dept filter), create, update, profile, photo upload (Cloudinary)
- Departments: list + create
- Attendance: clock-in/out (with late detection), my (month/year), today (admin), team (manager), summary
- Leave: apply (validates date range), my, pending (filtered for manager's team), approve/reject (auto-updates balance + creates notification), balance
- Dashboards: admin (4 cards + LineChart + BarChart + quick actions), manager (team + pending), employee (clock card + balances + recent), recruiter (placeholder)
- Notifications: bell with unread badge, list, mark read, mark all read
- Layout: collapsible sidebar with role-filtered nav, navbar with user/role badge/notifications/logout
- Loading spinners, toast notifications, empty states, client-side form validation

## Deferred (next phase)
- P0: Payroll module (model, generate endpoint, payslip detail page, mark-paid)
- P0: Performance module (reviews with score sliders, goals with progress bars, trend LineChart)
- P0: Recruitment module (job postings, candidate Kanban pipeline with drag/drop)
- P1: Date picker → shadcn Calendar (currently native HTML date inputs — functional but not aesthetically aligned with shadcn)
- P1: Resume PDF upload to Cloudinary for candidates
- P1: Refresh-token rotation + revocation list
- P2: Public job application endpoint
- P2: Reports section, Settings page
- P2: 2FA / SSO

## Critical Bug Fixes in This Iteration
- Added require_roles to /dashboard/admin (was readable by any authenticated user)
- Added require_roles to /dashboard/manager and /dashboard/recruiter

## Tests
- 35/37 backend tests passing (2 transient/flaky; addressed)
- Frontend end-to-end verified: login flow, role-based redirects, sidebar filtering, admin dashboard charts, employee list, clock-in/out, leave apply

## Next Tasks
1. Build Payroll module end-to-end
2. Build Performance module end-to-end
3. Build Recruitment Kanban
4. Replace native date inputs with shadcn Calendar + Popover
5. Implement /reports endpoints + UI
