"""HRMS Backend API test suite (pytest).

Covers: auth, employees, departments, attendance, leave, dashboards, notifications.
Endpoints under /api/v1.
"""
import os
import uuid
from datetime import date

import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE:
    # fallback to frontend/.env
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    BASE = line.split("=", 1)[1].strip().rstrip("/")
    except Exception:
        pass

API = f"{BASE}/api/v1"

ADMIN = {"email": "admin@hrms.com", "password": "Admin@123"}
MANAGER = {"email": "manager@hrms.com", "password": "Manager@123"}
RECRUITER = {"email": "recruiter@hrms.com", "password": "Recruiter@123"}
EMPLOYEE = {"email": "employee1@hrms.com", "password": "Employee@123"}
EMPLOYEE2 = {"email": "employee2@hrms.com", "password": "Employee@123"}


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=15)
    return r


@pytest.fixture(scope="session")
def admin_tokens():
    r = _login(ADMIN)
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="session")
def manager_tokens():
    r = _login(MANAGER)
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="session")
def employee_tokens():
    r = _login(EMPLOYEE)
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="session")
def employee2_tokens():
    r = _login(EMPLOYEE2)
    assert r.status_code == 200, r.text
    return r.json()


def _h(tokens):
    return {"Authorization": f"Bearer {tokens['access_token']}"}


# ---------- AUTH ----------
class TestAuth:
    def test_login_all_demo_accounts(self):
        for creds in (ADMIN, MANAGER, RECRUITER, EMPLOYEE):
            r = _login(creds)
            assert r.status_code == 200, f"{creds['email']} -> {r.status_code} {r.text}"
            data = r.json()
            for k in ("access_token", "refresh_token", "role", "full_name", "user_id"):
                assert k in data, f"missing {k} in {creds['email']} response"

    def test_login_wrong_password(self):
        r = requests.post(f"{API}/auth/login", json={"email": "admin@hrms.com", "password": "wrong"})
        assert r.status_code in (400, 401, 403)

    def test_me(self, admin_tokens):
        r = requests.get(f"{API}/auth/me", headers=_h(admin_tokens))
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("email") == "admin@hrms.com"
        assert data.get("role") == "management_admin"

    def test_me_no_token(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code in (401, 403)

    def test_refresh(self, admin_tokens):
        r = requests.post(f"{API}/auth/refresh", json={"refresh_token": admin_tokens["refresh_token"]})
        assert r.status_code == 200, r.text
        assert "access_token" in r.json()

    def test_register_duplicate(self):
        r = requests.post(
            f"{API}/auth/register",
            json={
                "email": "admin@hrms.com",
                "password": "Admin@123",
                "full_name": "Dup",
                "role": "employee",
            },
        )
        assert r.status_code in (400, 409, 422)

    def test_register_new(self):
        uniq = f"TEST_{uuid.uuid4().hex[:8]}@hrms.com"
        r = requests.post(
            f"{API}/auth/register",
            json={"email": uniq, "password": "Test@1234", "full_name": "Test User", "role": "employee"},
        )
        assert r.status_code in (200, 201), r.text


# ---------- EMPLOYEES ----------
class TestEmployees:
    def test_list_employees_admin(self, admin_tokens):
        r = requests.get(f"{API}/employees", headers=_h(admin_tokens))
        assert r.status_code == 200, r.text
        data = r.json()
        # Could be list or paginated dict
        items = data if isinstance(data, list) else data.get("items") or data.get("data") or []
        assert len(items) >= 1

    def test_list_employees_search(self, admin_tokens):
        r = requests.get(f"{API}/employees?search=employee", headers=_h(admin_tokens))
        assert r.status_code == 200

    def test_employee_sees_only_self(self, employee_tokens):
        r = requests.get(f"{API}/employees", headers=_h(employee_tokens))
        assert r.status_code == 200, r.text
        data = r.json()
        items = data if isinstance(data, list) else data.get("items") or data.get("data") or []
        # employee should only see own record
        assert len(items) <= 1

    def test_get_employee_by_id_admin(self, admin_tokens):
        r = requests.get(f"{API}/employees", headers=_h(admin_tokens))
        items = r.json() if isinstance(r.json(), list) else r.json().get("items") or r.json().get("data") or []
        if not items:
            pytest.skip("no employees")
        eid = items[0].get("id")
        d = requests.get(f"{API}/employees/{eid}", headers=_h(admin_tokens))
        assert d.status_code == 200, d.text

    def test_employee_cannot_see_other(self, admin_tokens, employee_tokens):
        # find an employee that is not self
        me = requests.get(f"{API}/auth/me", headers=_h(employee_tokens)).json()
        all_r = requests.get(f"{API}/employees", headers=_h(admin_tokens)).json()
        items = all_r if isinstance(all_r, list) else all_r.get("items") or all_r.get("data") or []
        other = next((e for e in items if e.get("user_id") and e["user_id"] != me.get("id") and e["user_id"] != me.get("user_id")), None)
        if not other:
            pytest.skip("no other employee")
        r = requests.get(f"{API}/employees/{other['id']}", headers=_h(employee_tokens))
        assert r.status_code in (401, 403, 404)

    def test_create_employee_forbidden_for_employee(self, employee_tokens):
        r = requests.post(
            f"{API}/employees",
            headers=_h(employee_tokens),
            json={
                "employee_code": f"TEST{uuid.uuid4().hex[:6]}",
                "email": f"TEST_{uuid.uuid4().hex[:6]}@hrms.com",
                "full_name": "X",
                "password": "Test@1234",
            },
        )
        assert r.status_code in (401, 403)

    def test_create_employee_admin(self, admin_tokens):
        code = f"TEST{uuid.uuid4().hex[:6].upper()}"
        email = f"test_{uuid.uuid4().hex[:6]}@hrms.com"
        r = requests.post(
            f"{API}/employees",
            headers=_h(admin_tokens),
            json={
                "employee_code": code,
                "email": email,
                "full_name": "TEST Employee",
                "password": "Test@1234",
                "designation": "QA",
            },
        )
        assert r.status_code in (200, 201), r.text


# ---------- DEPARTMENTS ----------
class TestDepartments:
    def test_list_departments(self, admin_tokens):
        r = requests.get(f"{API}/departments", headers=_h(admin_tokens))
        assert r.status_code == 200, r.text

    def test_create_department_admin(self, admin_tokens):
        r = requests.post(
            f"{API}/departments",
            headers=_h(admin_tokens),
            json={"name": f"TEST Dept {uuid.uuid4().hex[:5]}", "code": f"T{uuid.uuid4().hex[:4].upper()}"},
        )
        assert r.status_code in (200, 201), r.text

    def test_create_department_forbidden(self, employee_tokens):
        r = requests.post(
            f"{API}/departments",
            headers=_h(employee_tokens),
            json={"name": "X", "code": "X1"},
        )
        assert r.status_code in (401, 403)


# ---------- ATTENDANCE ----------
class TestAttendance:
    def test_clock_in_employee(self, employee2_tokens):
        r = requests.post(f"{API}/attendance/clock-in", headers=_h(employee2_tokens))
        # Could be first time or already clocked in today
        assert r.status_code in (200, 201, 409), r.text

    def test_clock_in_twice_conflict(self, employee2_tokens):
        # Ensure first clock-in
        requests.post(f"{API}/attendance/clock-in", headers=_h(employee2_tokens))
        r2 = requests.post(f"{API}/attendance/clock-in", headers=_h(employee2_tokens))
        assert r2.status_code == 409, r2.text

    def test_clock_out_employee(self, employee2_tokens):
        # Make sure clocked in first
        requests.post(f"{API}/attendance/clock-in", headers=_h(employee2_tokens))
        r = requests.post(f"{API}/attendance/clock-out", headers=_h(employee2_tokens))
        assert r.status_code in (200, 201), r.text

    def test_attendance_my(self, employee_tokens):
        r = requests.get(f"{API}/attendance/my", headers=_h(employee_tokens))
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, (list, dict))

    def test_attendance_today_admin(self, admin_tokens):
        r = requests.get(f"{API}/attendance/today", headers=_h(admin_tokens))
        assert r.status_code == 200, r.text

    def test_attendance_today_forbidden_for_employee(self, employee_tokens):
        r = requests.get(f"{API}/attendance/today", headers=_h(employee_tokens))
        assert r.status_code in (401, 403)

    def test_attendance_team_manager(self, manager_tokens):
        r = requests.get(f"{API}/attendance/team", headers=_h(manager_tokens))
        assert r.status_code == 200, r.text


# ---------- LEAVE ----------
class TestLeave:
    def test_apply_leave(self, employee_tokens):
        today = date.today().isoformat()
        r = requests.post(
            f"{API}/leave/apply",
            headers=_h(employee_tokens),
            json={
                "leave_type": "casual",
                "start_date": today,
                "end_date": today,
                "reason": "TEST leave",
            },
        )
        assert r.status_code in (200, 201), r.text
        return r.json().get("id")

    def test_apply_leave_invalid_dates(self, employee_tokens):
        r = requests.post(
            f"{API}/leave/apply",
            headers=_h(employee_tokens),
            json={
                "leave_type": "casual",
                "start_date": "2026-01-10",
                "end_date": "2026-01-05",
                "reason": "TEST invalid",
            },
        )
        assert r.status_code in (400, 422), r.text

    def test_leave_my(self, employee_tokens):
        r = requests.get(f"{API}/leave/my", headers=_h(employee_tokens))
        assert r.status_code == 200

    def test_leave_pending_manager(self, manager_tokens):
        r = requests.get(f"{API}/leave/pending", headers=_h(manager_tokens))
        assert r.status_code == 200, r.text

    def test_leave_pending_forbidden_for_employee(self, employee_tokens):
        r = requests.get(f"{API}/leave/pending", headers=_h(employee_tokens))
        assert r.status_code in (401, 403)

    def test_leave_approve_flow(self, employee_tokens, manager_tokens):
        # Apply
        today = date.today().isoformat()
        a = requests.post(
            f"{API}/leave/apply",
            headers=_h(employee_tokens),
            json={"leave_type": "casual", "start_date": today, "end_date": today, "reason": "TEST approve"},
        )
        if a.status_code not in (200, 201):
            pytest.skip(f"could not apply: {a.text}")
        leave_id = a.json().get("id")
        if not leave_id:
            pytest.skip("no id returned")
        r = requests.put(f"{API}/leave/{leave_id}/approve", headers=_h(manager_tokens))
        # may not be manager's team -> 403/404 acceptable but ideally 200
        assert r.status_code in (200, 201, 403, 404), r.text

    def test_leave_balance(self, employee_tokens, admin_tokens):
        me = requests.get(f"{API}/auth/me", headers=_h(employee_tokens)).json()
        # Need employee_id; try to find via list
        all_r = requests.get(f"{API}/employees", headers=_h(admin_tokens)).json()
        items = all_r if isinstance(all_r, list) else all_r.get("items") or all_r.get("data") or []
        match = next((e for e in items if e.get("user_id") == me.get("id") or e.get("user_id") == me.get("user_id")), None)
        if not match:
            pytest.skip("no employee record")
        r = requests.get(f"{API}/leave/balance/{match['id']}", headers=_h(employee_tokens))
        assert r.status_code == 200, r.text


# ---------- DASHBOARDS ----------
class TestDashboards:
    def test_admin_dashboard(self, admin_tokens):
        r = requests.get(f"{API}/dashboard/admin", headers=_h(admin_tokens))
        assert r.status_code == 200, r.text
        data = r.json()
        # spec: counts + headcount_by_department + attendance_trend
        keys = set(data.keys()) if isinstance(data, dict) else set()
        # Soft check
        assert any(k in keys for k in ("headcount_by_department", "attendance_trend", "total_employees", "counts")), data

    def test_manager_dashboard(self, manager_tokens):
        r = requests.get(f"{API}/dashboard/manager", headers=_h(manager_tokens))
        assert r.status_code == 200, r.text

    def test_employee_dashboard(self, employee_tokens):
        r = requests.get(f"{API}/dashboard/employee", headers=_h(employee_tokens))
        assert r.status_code == 200, r.text

    def test_admin_dashboard_forbidden_for_employee(self, employee_tokens):
        r = requests.get(f"{API}/dashboard/admin", headers=_h(employee_tokens))
        assert r.status_code in (401, 403)


# ---------- NOTIFICATIONS ----------
class TestNotifications:
    def test_my_notifications(self, employee_tokens):
        r = requests.get(f"{API}/notifications/my", headers=_h(employee_tokens))
        assert r.status_code == 200, r.text

    def test_read_all(self, employee_tokens):
        r = requests.put(f"{API}/notifications/read-all", headers=_h(employee_tokens))
        assert r.status_code in (200, 204), r.text
