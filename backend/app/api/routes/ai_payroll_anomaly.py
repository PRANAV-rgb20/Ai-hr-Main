"""Payroll Anomaly Detector — /api/v1/ai/payroll/detect-anomalies/{month}/{year}/"""
import logging
from typing import Annotated

import numpy as np
from fastapi import APIRouter, Depends
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import require_roles
from app.models.employee import Department, Employee
from app.models.payroll import Payroll
from app.models.user import User

logger = logging.getLogger("hrms.ai.payroll")

router = APIRouter(prefix="/ai", tags=["AI - Payroll Anomaly"])


@router.post("/payroll/detect-anomalies/{month}/{year}/")
async def detect_payroll_anomalies(
    month: int,
    year: int,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
    current_user: User = Depends(require_roles("management_admin")),
):
    """
    Run Isolation Forest anomaly detection on payroll data for a given month/year.
    Returns flagged records with reasons.
    """
    result = await db.execute(
        select(Payroll, Employee, Department)
        .join(Employee, Payroll.employee_id == Employee.id)
        .join(Department, Employee.department_id == Department.id, isouter=True)
        .where(Payroll.month == month, Payroll.year == year)
    )
    rows = result.all()

    if len(rows) < 5:
        return {
            "month": month,
            "year": year,
            "total_records": len(rows),
            "flagged_count": 0,
            "flagged": [],
            "message": "Not enough records for anomaly detection (minimum 5 required)",
        }

    payrolls    = [r[0] for r in rows]
    employees   = [r[1] for r in rows]
    departments = [r[2] for r in rows]

    # Build feature matrix
    features = np.array([
        [
            float(p.net_salary),
            float(p.gross_salary),
            float(p.pf_deduction),
            float(p.tax_deduction),
            float(p.other_deductions or 0),
        ]
        for p in payrolls
    ])

    scaler = StandardScaler()
    scaled = scaler.fit_transform(features)

    iso = IsolationForest(contamination=0.1, random_state=42)
    preds  = iso.fit_predict(scaled)
    scores = iso.decision_function(scaled)

    # Department median net salaries for contextual reasons
    dept_salaries: dict[str, list[float]] = {}
    for i, dept in enumerate(departments):
        name = dept.name if dept else "Unknown"
        dept_salaries.setdefault(name, []).append(float(payrolls[i].net_salary))
    dept_medians: dict[str, float] = {
        k: float(np.median(v)) for k, v in dept_salaries.items()
    }
    global_median = float(np.median(features[:, 0]))

    flagged = []
    for i, pred in enumerate(preds):
        if pred != -1:
            continue

        p, emp, dept = payrolls[i], employees[i], departments[i]
        dept_name = dept.name if dept else "Unknown"
        median = dept_medians.get(dept_name, global_median)
        net    = float(p.net_salary)
        gross  = float(p.gross_salary)

        if net > median * 1.5:
            reason = "Net salary significantly above department median"
        elif net < median * 0.5:
            reason = "Net salary significantly below department median"
        elif float(p.pf_deduction) == 0:
            reason = "No PF deduction recorded"
        elif float(p.tax_deduction) == 0 and gross > 40_000:
            reason = "Missing tax deduction on high salary"
        elif float(p.other_deductions or 0) > gross * 0.3:
            reason = "Other deductions exceed 30% of gross"
        else:
            reason = "Statistical outlier in payroll data"

        flagged.append({
            "employee_id":   str(emp.id),
            "employee_name": emp.user.full_name if emp.user else emp.designation or "Unknown",
            "department":    dept_name,
            "net_salary":    net,
            "gross_salary":  gross,
            "anomaly_score": round(float(scores[i]), 3),
            "reason":        reason,
        })

    # Sort worst anomalies first (lowest score = most anomalous)
    flagged.sort(key=lambda x: x["anomaly_score"])

    return {
        "month":         month,
        "year":          year,
        "total_records": len(rows),
        "flagged_count": len(flagged),
        "flagged":       flagged,
    }
