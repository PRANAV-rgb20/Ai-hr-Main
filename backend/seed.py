"""Seed script for HRMS demo data.

Run: cd /app/backend && python -m seed
"""
import asyncio
import random
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal, Base, engine
from app.core.security import hash_password
from app.models.attendance import Attendance, AttendanceStatus
from app.models.employee import Department, Employee
from app.models.leave import Leave, LeaveBalance, LeaveStatus, LeaveType
from app.models.notification import Notification
from app.models.payroll import Payroll, PayrollStatus
from app.models.performance import Goal, GoalStatus, PerformanceReview, ReviewPeriod, ReviewStatus
from app.models.recruitment import Candidate, CandidateStatus, JobPosting, JobStatus
from app.models.user import RoleEnum, User


USERS = [
    {"email": "admin@hrms.com", "password": "Admin@123", "full_name": "Avery Stone", "role": RoleEnum.management_admin.value},
    {"email": "manager@hrms.com", "password": "Manager@123", "full_name": "Morgan Hale", "role": RoleEnum.senior_manager.value},
    {"email": "recruiter@hrms.com", "password": "Recruiter@123", "full_name": "Riya Patel", "role": RoleEnum.hr_recruiter.value},
    {"email": "employee1@hrms.com", "password": "Employee@123", "full_name": "Liam Carter", "role": RoleEnum.employee.value},
    {"email": "employee2@hrms.com", "password": "Employee@123", "full_name": "Sofia Reyes", "role": RoleEnum.employee.value},
    {"email": "employee3@hrms.com", "password": "Employee@123", "full_name": "Noah Bennett", "role": RoleEnum.employee.value},
    {"email": "employee4@hrms.com", "password": "Employee@123", "full_name": "Aiko Tanaka", "role": RoleEnum.employee.value},
    {"email": "employee5@hrms.com", "password": "Employee@123", "full_name": "Diego Marin", "role": RoleEnum.employee.value},
]

DEPARTMENTS = ["Engineering", "Human Resources", "Operations"]


async def reset_data(db: AsyncSession):
    for model in [Notification, Attendance, Leave, LeaveBalance, Payroll, PerformanceReview, Goal, Candidate, JobPosting, Employee, Department, User]:
        await db.execute(delete(model))
    await db.commit()


async def main():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        await reset_data(db)

        # Departments
        depts = {}
        for name in DEPARTMENTS:
            d = Department(name=name)
            db.add(d)
            depts[name] = d
        await db.flush()

        # Users + employees
        users_by_email = {}
        for i, u in enumerate(USERS):
            user = User(
                email=u["email"],
                hashed_password=hash_password(u["password"]),
                full_name=u["full_name"],
                role=u["role"],
                is_active=True,
            )
            db.add(user)
            users_by_email[u["email"]] = user
        await db.flush()

        # Map users to employees (admin/manager/recruiter also get employee records)
        emp_records = {}
        role_dept = {
            RoleEnum.management_admin.value: "Operations",
            RoleEnum.senior_manager.value: "Engineering",
            RoleEnum.hr_recruiter.value: "Human Resources",
        }
        for i, u in enumerate(USERS):
            user = users_by_email[u["email"]]
            dept = depts[role_dept.get(u["role"], "Engineering")]
            emp = Employee(
                user_id=user.id,
                employee_code=f"EMP{1001 + i:04d}",
                department_id=dept.id,
                designation={
                    RoleEnum.management_admin.value: "Chief Operations Officer",
                    RoleEnum.senior_manager.value: "Senior Engineering Manager",
                    RoleEnum.hr_recruiter.value: "Talent Acquisition Lead",
                    RoleEnum.employee.value: random.choice([
                        "Software Engineer", "Product Designer", "QA Engineer", "Data Analyst", "DevOps Engineer"
                    ]),
                }[u["role"]],
                date_of_joining=date.today() - timedelta(days=random.randint(120, 1200)),
                phone=f"+1-555-0{100+i:03d}",
                address=f"{100+i} Market St, San Francisco, CA",
                emergency_contact=f"+1-555-0{200+i:03d}",
                is_active=True,
            )
            db.add(emp)
            emp_records[u["email"]] = emp
        await db.flush()

        # Manager links: assign manager to all employee role
        manager_emp = emp_records["manager@hrms.com"]
        for k, e in emp_records.items():
            if users_by_email[k].role == RoleEnum.employee.value:
                e.manager_id = manager_emp.id
        await db.flush()

        # Leave balances
        plan = [(LeaveType.annual.value, 18), (LeaveType.sick.value, 10), (LeaveType.casual.value, 6)]
        for e in emp_records.values():
            for lt, total in plan:
                db.add(LeaveBalance(employee_id=e.id, leave_type=lt, total_days=total, used_days=random.randint(0, total // 2)))

        # 30 days attendance
        today = date.today()
        for e in emp_records.values():
            for i in range(30):
                d = today - timedelta(days=i)
                if d.weekday() >= 5:
                    continue
                r = random.random()
                if r < 0.05:
                    db.add(Attendance(employee_id=e.id, date=d, status=AttendanceStatus.absent, work_hours=0))
                else:
                    is_late = r < 0.15
                    clock_in_dt = datetime.combine(d, datetime.min.time(), tzinfo=timezone.utc).replace(hour=10 if is_late else 9, minute=random.randint(0, 45))
                    clock_out_dt = clock_in_dt + timedelta(hours=random.uniform(7.5, 9.5))
                    hours = round((clock_out_dt - clock_in_dt).total_seconds() / 3600, 2)
                    db.add(Attendance(
                        employee_id=e.id,
                        date=d,
                        clock_in=clock_in_dt,
                        clock_out=clock_out_dt,
                        status=AttendanceStatus.late if is_late else AttendanceStatus.present,
                        work_hours=hours,
                    ))

        # Sample leaves: pending + approved
        for i, (k, e) in enumerate(emp_records.items()):
            if users_by_email[k].role != RoleEnum.employee.value:
                continue
            # one approved
            s = today - timedelta(days=20 + i)
            db.add(Leave(
                employee_id=e.id,
                leave_type=LeaveType.annual.value,
                start_date=s,
                end_date=s + timedelta(days=2),
                days_count=3,
                reason="Family vacation",
                status=LeaveStatus.approved,
                approved_by=users_by_email["manager@hrms.com"].id,
                approved_at=datetime.now(timezone.utc) - timedelta(days=15),
            ))
            # one pending
            s2 = today + timedelta(days=7 + i)
            db.add(Leave(
                employee_id=e.id,
                leave_type=LeaveType.sick.value,
                start_date=s2,
                end_date=s2 + timedelta(days=1),
                days_count=2,
                reason="Medical appointment",
                status=LeaveStatus.pending,
            ))

        # A few notifications for employee1
        emp1_user = users_by_email["employee1@hrms.com"]
        db.add(Notification(user_id=emp1_user.id, type="leave", title="Leave Approved", message="Your annual leave was approved.", is_read=False))
        db.add(Notification(user_id=emp1_user.id, type="info", title="Welcome to HRMS", message="Your account is ready.", is_read=True))

        # ----- Payroll: 3 months for each employee -----
        today = date.today()
        for emp_email, e in emp_records.items():
            user = users_by_email[emp_email]
            basic = 8000.0 if user.role == RoleEnum.management_admin.value else 6000.0 if user.role == RoleEnum.senior_manager.value else 5000.0 if user.role == RoleEnum.hr_recruiter.value else 4000.0
            hra = round(basic * 0.4, 2)
            transport = 200.0
            medical = 150.0
            gross = basic + hra + transport + medical
            pf = round(basic * 0.12, 2)
            tax = round(gross * 0.10, 2)
            net = round(gross - pf - tax, 2)
            for i in range(3):
                m = today.month - i
                y = today.year
                while m <= 0:
                    m += 12
                    y -= 1
                db.add(Payroll(
                    employee_id=e.id,
                    month=m,
                    year=y,
                    basic_salary=basic,
                    hra=hra,
                    transport_allowance=transport,
                    medical_allowance=medical,
                    gross_salary=gross,
                    pf_deduction=pf,
                    tax_deduction=tax,
                    other_deductions=0.0,
                    net_salary=net,
                    status=PayrollStatus.paid if i > 0 else PayrollStatus.processed,
                ))

        # ----- Performance reviews: 2 per employee -----
        manager_user = users_by_email["manager@hrms.com"]
        for emp_email, e in emp_records.items():
            for period, year in [(ReviewPeriod.Q1.value, today.year), (ReviewPeriod.Q2.value, today.year)]:
                gs = round(random.uniform(6.5, 9.5), 1)
                ss = round(random.uniform(6.5, 9.5), 1)
                ats = round(random.uniform(6.5, 9.5), 1)
                overall = round((gs + ss + ats) / 3, 2)
                db.add(PerformanceReview(
                    employee_id=e.id,
                    reviewer_id=manager_user.id,
                    period=period,
                    year=year,
                    goals_score=gs,
                    skills_score=ss,
                    attitude_score=ats,
                    overall_score=overall,
                    comments=f"Solid {period} performance — keep up the momentum.",
                    status=ReviewStatus.submitted,
                ))
            # Goals: 2-3 per employee
            for j, (title, desc) in enumerate([
                ("Complete onboarding playbook", "Finish all six onboarding modules and certifications"),
                ("Ship Q-1 milestone", "Deliver primary deliverable for Q1 commitments"),
                ("Mentor a junior team member", "Pair with one junior across the quarter"),
            ]):
                progress = [100, 60, 20][j]
                status = GoalStatus.completed if progress >= 100 else GoalStatus.in_progress if progress > 0 else GoalStatus.pending
                db.add(Goal(
                    employee_id=e.id,
                    title=title,
                    description=desc,
                    target_date=today + timedelta(days=30 * (j + 1)),
                    status=status,
                    progress_percent=progress,
                ))

        # ----- Recruitment: 2 jobs with 3 candidates each -----
        eng = depts["Engineering"]
        hr_dept = depts["Human Resources"]
        recruiter_user = users_by_email["recruiter@hrms.com"]
        jobs = [
            JobPosting(
                title="Senior Frontend Engineer",
                department_id=eng.id,
                description="Build delightful, performant React experiences for our internal tools.",
                requirements="React, TypeScript, 5+ yrs experience, design sense, ownership mindset.",
                status=JobStatus.open,
                created_by=recruiter_user.id,
            ),
            JobPosting(
                title="People Operations Specialist",
                department_id=hr_dept.id,
                description="Own employee lifecycle programs from onboarding to offboarding.",
                requirements="3+ yrs HR ops, excellent communication, HRIS experience preferred.",
                status=JobStatus.open,
                created_by=recruiter_user.id,
            ),
        ]
        for j in jobs:
            db.add(j)
        await db.flush()

        candidate_pool = [
            ("Alex Rivera", "alex.rivera@example.com", "+1-415-555-0190", CandidateStatus.applied),
            ("Priya Shah", "priya.shah@example.com", "+1-415-555-0191", CandidateStatus.screened),
            ("Jordan Kim", "jordan.kim@example.com", "+1-415-555-0192", CandidateStatus.interview),
            ("Mei Wang", "mei.wang@example.com", "+1-415-555-0193", CandidateStatus.applied),
            ("Tomás Pereira", "tomas.p@example.com", "+1-415-555-0194", CandidateStatus.offered),
            ("Hana Okafor", "hana.o@example.com", "+1-415-555-0195", CandidateStatus.rejected),
        ]
        for idx, job in enumerate(jobs):
            for c_idx in range(3):
                name, email, phone, status = candidate_pool[idx * 3 + c_idx]
                db.add(Candidate(
                    job_id=job.id,
                    name=name,
                    email=email,
                    phone=phone,
                    resume_url="",
                    status=status,
                ))

        await db.commit()
        print("Seed complete.")


if __name__ == "__main__":
    asyncio.run(main())
