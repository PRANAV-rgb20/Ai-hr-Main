"""Iteration 2 backend tests — Payroll, Performance, Recruitment, Reports."""
import os
from datetime import date

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://hr-dashboard-227.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api/v1"

ADMIN = ("admin@hrms.com", "Admin@123")
MANAGER = ("manager@hrms.com", "Manager@123")
RECRUITER = ("recruiter@hrms.com", "Recruiter@123")
EMP = ("employee1@hrms.com", "Employee@123")


def _login(email, pwd):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": pwd}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="session")
def admin_token():
    return _login(*ADMIN)["access_token"]


@pytest.fixture(scope="session")
def manager_token():
    return _login(*MANAGER)["access_token"]


@pytest.fixture(scope="session")
def recruiter_token():
    return _login(*RECRUITER)["access_token"]


@pytest.fixture(scope="session")
def emp_session():
    d = _login(*EMP)
    return d


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


# ----- Payroll -----
class TestPayroll:
    def test_generate_admin_only(self, admin_token):
        r = requests.post(f"{API}/payroll/generate/1/2026", headers=_h(admin_token), timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        for p in data:
            assert "id" in p and "net_salary" in p and "gross_salary" in p
            assert p["month"] == 1 and p["year"] == 2026

    def test_generate_idempotent(self, admin_token):
        r1 = requests.post(f"{API}/payroll/generate/1/2026", headers=_h(admin_token), timeout=30)
        r2 = requests.post(f"{API}/payroll/generate/1/2026", headers=_h(admin_token), timeout=30)
        assert r1.status_code == 200 and r2.status_code == 200
        ids1 = sorted([p["id"] for p in r1.json()])
        ids2 = sorted([p["id"] for p in r2.json()])
        assert ids1 == ids2, "Second generate created duplicate rows"

    def test_generate_forbidden_for_employee(self, emp_session):
        r = requests.post(f"{API}/payroll/generate/1/2026", headers=_h(emp_session["access_token"]), timeout=15)
        assert r.status_code == 403

    def test_my_payslips(self, emp_session):
        r = requests.get(f"{API}/payroll/my", headers=_h(emp_session["access_token"]), timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_get_payslip_403_other_employee(self, admin_token, emp_session):
        lst = requests.get(f"{API}/payroll/admin/list/1/2026", headers=_h(admin_token), timeout=15).json()
        # find a payslip not belonging to employee1 user
        me = requests.get(f"{API}/auth/me", headers=_h(emp_session["access_token"]), timeout=10).json()
        my_payslips = requests.get(f"{API}/payroll/my", headers=_h(emp_session["access_token"]), timeout=10).json()
        my_ids = {p["id"] for p in my_payslips}
        others = [p for p in lst if p["id"] not in my_ids]
        if not others:
            pytest.skip("No other employee payslip available")
        r = requests.get(f"{API}/payroll/{others[0]['id']}", headers=_h(emp_session["access_token"]), timeout=10)
        assert r.status_code == 403

    def test_mark_paid(self, admin_token):
        lst = requests.get(f"{API}/payroll/admin/list/1/2026", headers=_h(admin_token), timeout=15).json()
        assert lst, "no payslips"
        pid = lst[0]["id"]
        r = requests.put(f"{API}/payroll/{pid}/mark-paid", headers=_h(admin_token), timeout=15)
        assert r.status_code == 200
        assert r.json()["status"] == "paid"
        # verify persistence
        v = requests.get(f"{API}/payroll/{pid}", headers=_h(admin_token), timeout=10).json()
        assert v["status"] == "paid"

    def test_mark_paid_forbidden_employee(self, admin_token, emp_session):
        lst = requests.get(f"{API}/payroll/admin/list/1/2026", headers=_h(admin_token), timeout=15).json()
        pid = lst[0]["id"]
        r = requests.put(f"{API}/payroll/{pid}/mark-paid", headers=_h(emp_session["access_token"]), timeout=10)
        assert r.status_code == 403

    def test_summary(self, admin_token):
        r = requests.get(f"{API}/payroll/summary/1/2026", headers=_h(admin_token), timeout=15)
        assert r.status_code == 200
        d = r.json()
        for k in ("count", "total_gross", "total_net", "paid_count", "processed_count"):
            assert k in d

    def test_admin_list_forbidden_employee(self, emp_session):
        r = requests.get(f"{API}/payroll/admin/list/1/2026", headers=_h(emp_session["access_token"]), timeout=10)
        assert r.status_code == 403


# ----- Performance -----
class TestPerformance:
    def test_create_review_admin(self, admin_token):
        emps = requests.get(f"{API}/employees", headers=_h(admin_token), timeout=15).json()
        emp_list = emps.get("items", emps) if isinstance(emps, dict) else emps
        emp_id = emp_list[0]["id"]
        payload = {"employee_id": emp_id, "period": "Q1", "year": 2026,
                   "goals_score": 8.0, "skills_score": 7.0, "attitude_score": 9.0, "comments": "TEST review"}
        r = requests.post(f"{API}/performance/review", json=payload, headers=_h(admin_token), timeout=15)
        assert r.status_code == 201, r.text
        d = r.json()
        assert d["overall_score"] == round((8.0 + 7.0 + 9.0) / 3, 2)

    def test_create_review_forbidden_employee(self, admin_token, emp_session):
        emps = requests.get(f"{API}/employees", headers=_h(admin_token), timeout=15).json()
        emp_list = emps.get("items", emps) if isinstance(emps, dict) else emps
        r = requests.post(f"{API}/performance/review",
                          json={"employee_id": emp_list[0]["id"], "period": "Q1", "year": 2026,
                                "goals_score": 5, "skills_score": 5, "attitude_score": 5},
                          headers=_h(emp_session["access_token"]), timeout=10)
        assert r.status_code == 403

    def test_my_reviews(self, emp_session):
        r = requests.get(f"{API}/performance/my", headers=_h(emp_session["access_token"]), timeout=10)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_team_reviews_manager(self, manager_token):
        r = requests.get(f"{API}/performance/team", headers=_h(manager_token), timeout=10)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_team_reviews_forbidden_employee(self, emp_session):
        r = requests.get(f"{API}/performance/team", headers=_h(emp_session["access_token"]), timeout=10)
        assert r.status_code == 403

    def test_create_own_goal_employee(self, emp_session, admin_token):
        # find emp record for employee1
        me = requests.get(f"{API}/auth/me", headers=_h(emp_session["access_token"]), timeout=10).json()
        emps = requests.get(f"{API}/employees", headers=_h(admin_token), timeout=10).json()
        emp_list = emps.get("items", emps) if isinstance(emps, dict) else emps
        my_emp = next((e for e in emp_list if e.get("user_id") == me.get("id") or e.get("email") == me.get("email")), None)
        if not my_emp:
            pytest.skip("Could not resolve own employee record")
        p = {"employee_id": my_emp["id"], "title": "TEST_goal_self", "description": "auto"}
        r = requests.post(f"{API}/performance/goals", json=p, headers=_h(emp_session["access_token"]), timeout=10)
        assert r.status_code == 201
        gid = r.json()["id"]
        # update to 100%
        u = requests.put(f"{API}/performance/goals/{gid}", json={"progress_percent": 100},
                         headers=_h(emp_session["access_token"]), timeout=10)
        assert u.status_code == 200
        assert u.json()["status"] == "completed"
        # update to 50% on new goal
        r2 = requests.post(f"{API}/performance/goals", json={**p, "title": "TEST_goal2"},
                           headers=_h(emp_session["access_token"]), timeout=10)
        gid2 = r2.json()["id"]
        u2 = requests.put(f"{API}/performance/goals/{gid2}", json={"progress_percent": 50},
                          headers=_h(emp_session["access_token"]), timeout=10)
        assert u2.json()["status"] == "in_progress"

    def test_create_goal_for_other_forbidden_for_employee(self, emp_session, admin_token):
        emps = requests.get(f"{API}/employees", headers=_h(admin_token), timeout=10).json()
        emp_list = emps.get("items", emps) if isinstance(emps, dict) else emps
        me = requests.get(f"{API}/auth/me", headers=_h(emp_session["access_token"]), timeout=10).json()
        other = next((e for e in emp_list if e.get("user_id") != me.get("id")), None)
        if not other:
            pytest.skip("no other employee")
        r = requests.post(f"{API}/performance/goals",
                          json={"employee_id": other["id"], "title": "TEST_bad"},
                          headers=_h(emp_session["access_token"]), timeout=10)
        assert r.status_code == 403

    def test_my_goals(self, emp_session):
        r = requests.get(f"{API}/performance/my-goals", headers=_h(emp_session["access_token"]), timeout=10)
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ----- Recruitment -----
class TestRecruitment:
    def test_list_jobs_has_candidate_count(self, recruiter_token):
        r = requests.get(f"{API}/jobs", headers=_h(recruiter_token), timeout=15)
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        if items:
            assert "candidate_count" in items[0]

    def test_get_job_no_auth(self, recruiter_token):
        items = requests.get(f"{API}/jobs", headers=_h(recruiter_token), timeout=10).json()
        if not items:
            pytest.skip("no jobs")
        jid = items[0]["id"]
        # WITHOUT auth header
        r = requests.get(f"{API}/jobs/{jid}", timeout=10)
        assert r.status_code == 200, f"public job GET should work, got {r.status_code}"

    def test_create_job_recruiter(self, recruiter_token):
        r = requests.post(f"{API}/jobs",
                          json={"title": "TEST_Engineer", "description": "d", "requirements": "r"},
                          headers=_h(recruiter_token), timeout=15)
        assert r.status_code == 201, r.text
        assert r.json()["status"] == "open"
        TestRecruitment._test_job_id = r.json()["id"]

    def test_create_job_forbidden_employee(self, emp_session):
        r = requests.post(f"{API}/jobs", json={"title": "TEST_X"},
                          headers=_h(emp_session["access_token"]), timeout=10)
        assert r.status_code == 403

    def test_public_apply_no_auth(self):
        # use a known job id from list (unauth call to /jobs would 401; use admin token to get id)
        admin_tok = _login(*ADMIN)["access_token"]
        items = requests.get(f"{API}/jobs", headers=_h(admin_tok), timeout=10).json()
        open_jobs = [j for j in items if j["status"] == "open"]
        if not open_jobs:
            pytest.skip("no open job")
        jid = open_jobs[0]["id"]
        # NO auth header
        r = requests.post(f"{API}/jobs/{jid}/apply",
                          json={"name": "TEST_Public Applicant", "email": "test_public@example.com",
                                "phone": "1234567890", "resume_url": "https://example.com/r.pdf"},
                          timeout=15)
        assert r.status_code == 201, f"public apply failed: {r.status_code} {r.text}"
        d = r.json()
        assert d["status"] == "applied"
        assert d["name"] == "TEST_Public Applicant"

    def test_public_apply_closed_job_409(self, admin_token, recruiter_token):
        # create job, close it, then apply
        r = requests.post(f"{API}/jobs", json={"title": "TEST_Closed"},
                          headers=_h(recruiter_token), timeout=10)
        jid = r.json()["id"]
        u = requests.put(f"{API}/jobs/{jid}", json={"status": "closed"},
                         headers=_h(recruiter_token), timeout=10)
        assert u.status_code == 200 and u.json()["status"] == "closed"
        apply = requests.post(f"{API}/jobs/{jid}/apply",
                              json={"name": "TEST_X", "email": "test_closed@example.com"}, timeout=10)
        assert apply.status_code == 409, f"expected 409 got {apply.status_code}"

    def test_list_candidates_recruiter(self, recruiter_token):
        r = requests.get(f"{API}/candidates", headers=_h(recruiter_token), timeout=10)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_list_candidates_forbidden_employee(self, emp_session):
        r = requests.get(f"{API}/candidates", headers=_h(emp_session["access_token"]), timeout=10)
        assert r.status_code == 403

    def test_update_candidate_status(self, recruiter_token):
        cands = requests.get(f"{API}/candidates", headers=_h(recruiter_token), timeout=10).json()
        if not cands:
            pytest.skip("no candidate")
        cid = cands[0]["id"]
        r = requests.put(f"{API}/candidates/{cid}/status", json={"status": "interview"},
                         headers=_h(recruiter_token), timeout=10)
        assert r.status_code == 200
        assert r.json()["status"] == "interview"

    def test_update_candidate_invalid_status(self, recruiter_token):
        cands = requests.get(f"{API}/candidates", headers=_h(recruiter_token), timeout=10).json()
        if not cands:
            pytest.skip("no candidate")
        r = requests.put(f"{API}/candidates/{cands[0]['id']}/status",
                         json={"status": "bogus_stage"}, headers=_h(recruiter_token), timeout=10)
        assert r.status_code == 400


# ----- Reports -----
class TestReports:
    def test_overview_admin(self, admin_token):
        r = requests.get(f"{API}/reports/overview", headers=_h(admin_token), timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("total_employees", "total_departments", "open_jobs", "total_candidates",
                  "approved_leaves", "pending_leaves", "headcount_by_department",
                  "leave_by_type", "top_performers", "payroll_recent", "candidate_pipeline"):
            assert k in d, f"missing key {k}"
        assert isinstance(d["headcount_by_department"], list)
        assert isinstance(d["candidate_pipeline"], list)

    def test_overview_forbidden_employee(self, emp_session):
        r = requests.get(f"{API}/reports/overview", headers=_h(emp_session["access_token"]), timeout=10)
        assert r.status_code == 403

    def test_recruiter_dashboard(self, recruiter_token):
        r = requests.get(f"{API}/dashboard/recruiter", headers=_h(recruiter_token), timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("open_jobs", "total_candidates", "interviews", "pipeline", "recent_jobs"):
            assert k in d, f"missing key {k}"

    def test_recruiter_dashboard_forbidden_employee(self, emp_session):
        r = requests.get(f"{API}/dashboard/recruiter", headers=_h(emp_session["access_token"]), timeout=10)
        assert r.status_code == 403
