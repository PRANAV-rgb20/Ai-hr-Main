"""Pydantic schemas for HRMS API."""
from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field


# ----- Auth -----
class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    full_name: str = Field(min_length=1)
    role: str = "employee"


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    role: str
    full_name: str
    user_id: str


class RefreshRequest(BaseModel):
    refresh_token: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    email: EmailStr
    full_name: str
    role: str
    is_active: bool


# ----- Department -----
class DepartmentCreate(BaseModel):
    name: str = Field(min_length=1)


class DepartmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    head_id: Optional[str] = None


# ----- Employee -----
class EmployeeBase(BaseModel):
    employee_code: str
    department_id: Optional[str] = None
    designation: str = ""
    date_of_joining: Optional[date] = None
    phone: str = ""
    address: str = ""
    emergency_contact: str = ""
    manager_id: Optional[str] = None


class EmployeeCreate(EmployeeBase):
    email: EmailStr
    full_name: str
    password: str = Field(min_length=6)
    role: str = "employee"


class EmployeeUpdate(BaseModel):
    department_id: Optional[str] = None
    designation: Optional[str] = None
    date_of_joining: Optional[date] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    emergency_contact: Optional[str] = None
    manager_id: Optional[str] = None
    is_active: Optional[bool] = None


class EmployeeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    user_id: str
    employee_code: str
    department_id: Optional[str] = None
    department_name: Optional[str] = None
    designation: str
    date_of_joining: Optional[date] = None
    phone: str
    address: str
    emergency_contact: str
    profile_photo_url: str
    manager_id: Optional[str] = None
    is_active: bool
    email: Optional[str] = None
    full_name: Optional[str] = None
    role: Optional[str] = None


class EmployeeListResponse(BaseModel):
    items: list[EmployeeOut]
    total: int
    page: int
    page_size: int


# ----- Attendance -----
class AttendanceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    employee_id: str
    date: date
    clock_in: Optional[datetime] = None
    clock_out: Optional[datetime] = None
    status: str
    work_hours: float
    notes: str


class AttendanceSummary(BaseModel):
    present_days: int
    absent_days: int
    late_days: int
    half_days: int
    total_work_hours: float


# ----- Leave -----
class LeaveApply(BaseModel):
    leave_type: str
    start_date: date
    end_date: date
    reason: str = ""


class LeaveOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    employee_id: str
    employee_name: Optional[str] = None
    leave_type: str
    start_date: date
    end_date: date
    days_count: int
    reason: str
    status: str
    applied_at: datetime


class LeaveBalanceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    leave_type: str
    total_days: int
    used_days: int
    remaining_days: int


# ----- Notifications -----
class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    type: str
    title: str
    message: str
    is_read: bool
    created_at: datetime



# ----- Payroll -----
class PayrollOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    employee_id: str
    employee_name: Optional[str] = None
    month: int
    year: int
    basic_salary: float
    hra: float
    transport_allowance: float
    medical_allowance: float
    gross_salary: float
    pf_deduction: float
    tax_deduction: float
    other_deductions: float
    net_salary: float
    status: str
    generated_at: datetime


# ----- Performance -----
class ReviewCreate(BaseModel):
    employee_id: str
    period: str
    year: int
    goals_score: float = Field(ge=0, le=10)
    skills_score: float = Field(ge=0, le=10)
    attitude_score: float = Field(ge=0, le=10)
    comments: str = ""


class ReviewOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    employee_id: str
    employee_name: Optional[str] = None
    period: str
    year: int
    goals_score: float
    skills_score: float
    attitude_score: float
    overall_score: float
    comments: str
    status: str
    created_at: datetime


class GoalCreate(BaseModel):
    employee_id: str
    title: str
    description: str = ""
    target_date: Optional[date] = None


class GoalUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    target_date: Optional[date] = None
    status: Optional[str] = None
    progress_percent: Optional[int] = Field(default=None, ge=0, le=100)


class GoalOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    employee_id: str
    title: str
    description: str
    target_date: Optional[date] = None
    status: str
    progress_percent: int


# ----- Recruitment -----
class JobCreate(BaseModel):
    title: str
    department_id: Optional[str] = None
    description: str = ""
    requirements: str = ""


class JobUpdate(BaseModel):
    title: Optional[str] = None
    department_id: Optional[str] = None
    description: Optional[str] = None
    requirements: Optional[str] = None
    status: Optional[str] = None


class JobOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    title: str
    department_id: Optional[str] = None
    department_name: Optional[str] = None
    description: str
    requirements: str
    status: str
    created_at: datetime
    candidate_count: Optional[int] = 0


class CandidateApply(BaseModel):
    name: str = Field(min_length=1)
    email: EmailStr
    phone: str = ""
    resume_url: str = ""


class CandidateStatusUpdate(BaseModel):
    status: str


class CandidateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    job_id: str
    job_title: Optional[str] = None
    name: str
    email: EmailStr
    phone: str
    resume_url: str
    status: str
    applied_at: datetime
