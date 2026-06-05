"""
ML models for Performance Prediction and Attrition Risk Scoring.
Models are trained on synthetic data on first import and cached to disk.
"""
import logging
import os

import joblib
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import LogisticRegression

logger = logging.getLogger("hrms.ai.ml")

MODELS_DIR = os.path.join(os.path.dirname(__file__), "saved_models")
os.makedirs(MODELS_DIR, exist_ok=True)


# ── Performance model ─────────────────────────────────────────────────────────

def _train_performance() -> RandomForestRegressor:
    path = os.path.join(MODELS_DIR, "perf.joblib")
    if os.path.exists(path):
        logger.info("Loading cached performance model")
        return joblib.load(path)

    logger.info("Training performance model on synthetic data…")
    np.random.seed(42)
    n = 600

    att    = np.random.uniform(0.5, 1.0, n)          # attendance rate
    tasks  = np.random.uniform(0.4, 1.0, n)          # task completion rate
    peer   = np.random.uniform(1.0, 5.0, n)          # peer rating 1-5
    leave  = np.random.randint(0, 20, n).astype(float)  # leave days taken
    tenure = np.random.randint(1, 60, n).astype(float)  # months

    score = (
        att * 3
        + tasks * 3
        + (peer / 5) * 2
        + (1 - leave / 20)
        + np.minimum(tenure / 60, 1)
    )
    score = 4 + (score / 10) * 6 + np.random.normal(0, 0.3, n)
    score = np.clip(score, 4, 10)

    X = np.column_stack([att, tasks, peer, leave, tenure])
    m = RandomForestRegressor(n_estimators=100, random_state=42)
    m.fit(X, score)
    joblib.dump(m, path)
    logger.info("Performance model trained and saved")
    return m


# ── Attrition model ───────────────────────────────────────────────────────────

def _train_attrition() -> LogisticRegression:
    path = os.path.join(MODELS_DIR, "attrition.joblib")
    if os.path.exists(path):
        logger.info("Loading cached attrition model")
        return joblib.load(path)

    logger.info("Training attrition model on synthetic data…")
    np.random.seed(42)
    n = 600

    pt   = np.random.uniform(-1.0, 1.0, n)   # performance trend
    sent = np.random.uniform(-1.0, 1.0, n)   # sentiment avg
    lf   = np.random.uniform(0, 1.0, n)      # leave frequency
    ten  = np.random.randint(1, 60, n).astype(float)  # tenure months
    sg   = np.random.uniform(0, 0.3, n)      # salary growth rate

    y = ((pt < -0.3) | (sent < -0.4) | (lf > 0.7)).astype(int)
    noise = (np.random.random(n) < 0.1).astype(int)
    y = (y + noise) % 2

    X = np.column_stack([pt, sent, lf, ten, sg])
    m = LogisticRegression(random_state=42, max_iter=1000)
    m.fit(X, y)
    joblib.dump(m, path)
    logger.info("Attrition model trained and saved")
    return m


# ── Load / train on import ────────────────────────────────────────────────────

performance_model = _train_performance()
attrition_model   = _train_attrition()


# ── Prediction functions ──────────────────────────────────────────────────────

def predict_performance(
    attendance_rate: float,
    tasks_completed: float,
    peer_rating: float,
    leave_days: float,
    tenure_months: float,
) -> dict:
    """
    Predict performance score (4–10) for an employee.
    Returns predicted_score and risk_level (low / medium / high).
    """
    X = np.array([[attendance_rate, tasks_completed, peer_rating, leave_days, tenure_months]])
    score = float(performance_model.predict(X)[0])
    score = round(min(max(score, 4.0), 10.0), 1)
    level = "low" if score >= 7 else "medium" if score >= 5 else "high"
    return {"predicted_score": score, "risk_level": level}


def predict_attrition(
    perf_trend: float,
    sentiment_avg: float,
    leave_frequency: float,
    tenure_months: float,
    salary_growth: float,
) -> dict:
    """
    Predict attrition probability (0–1) for an employee.
    Returns risk_score, risk_level, and top_factors list.
    """
    X = np.array([[perf_trend, sentiment_avg, leave_frequency, tenure_months, salary_growth]])
    prob = float(attrition_model.predict_proba(X)[0][1])
    prob = round(prob, 2)
    level = "low" if prob < 0.3 else "medium" if prob < 0.7 else "high"

    factors = []
    if perf_trend < -0.3:      factors.append("Declining performance trend")
    if sentiment_avg < -0.3:   factors.append("Low sentiment score")
    if leave_frequency > 0.6:  factors.append("High leave frequency")
    if tenure_months < 6:      factors.append("Very short tenure")
    if salary_growth < 0.02:   factors.append("Low salary growth")
    if not factors:            factors.append("Within normal range")

    return {"risk_score": prob, "risk_level": level, "top_factors": factors}
