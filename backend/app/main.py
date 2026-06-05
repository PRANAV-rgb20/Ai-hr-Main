"""FastAPI app factory + routers."""
import logging

from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import Base, engine
from app.core.exceptions import register_exception_handlers
from app.api.routes import attendance, auth, dashboard, employees, leave, notifications, payroll, performance, recruitment, reports
from app.api.routes import ai_resume
from app.api.routes import ai_interview
from app.api.routes import ai_predictions
from app.api.routes import ai_sentiment
from app.api.routes import ai_payroll_anomaly
from app.api.routes import ai_leave_optimizer
from app.api.routes import ai_audit
from app.api.routes import ai_policy
from app.api.routes import ai_insights
from app.models import attendance as _a  # noqa: F401
from app.models import employee as _e  # noqa: F401
from app.models import leave as _l  # noqa: F401
from app.models import notification as _n  # noqa: F401
from app.models import payroll as _p  # noqa: F401
from app.models import performance as _pf  # noqa: F401
from app.models import recruitment as _r  # noqa: F401
from app.models import user as _u  # noqa: F401
from app.models import interview as _iv  # noqa: F401
from app.models import sentiment as _s  # noqa: F401
from app.models import audit as _au  # noqa: F401
from app.models import policy as _pl  # noqa: F401

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("hrms")

app = FastAPI(title="HRMS API", version="1.0.0")
register_exception_handlers(app)

# CORS — allow same-origin via ingress; * for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if settings.CORS_ORIGINS in ("*", "") else settings.CORS_ORIGINS.split(","),
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup():
    # Ensure spaCy model is available — silently skip if already installed
    try:
        import spacy
        spacy.load("en_core_web_sm")
    except OSError:
        import subprocess, sys
        subprocess.run(
            [sys.executable, "-m", "pip", "install",
             "https://github.com/explosion/spacy-models/releases/download/"
             "en_core_web_sm-3.7.1/en_core_web_sm-3.7.1-py3-none-any.whl"],
            capture_output=True,
        )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("HRMS DB tables ensured")
    # Trigger ML model training/loading on boot (runs in background thread via import)
    import asyncio
    await asyncio.to_thread(__import__, "app.ai.ml_models", fromlist=["performance_model"])


# Routes — spec uses /api/v1 prefix
from fastapi import APIRouter

api_v1 = APIRouter(prefix="/api/v1")
api_v1.include_router(auth.router)
api_v1.include_router(employees.router)
api_v1.include_router(attendance.router)
api_v1.include_router(leave.router)
api_v1.include_router(dashboard.router)
api_v1.include_router(notifications.router)
api_v1.include_router(payroll.router)
api_v1.include_router(performance.router)
api_v1.include_router(recruitment.router)
api_v1.include_router(reports.router)
api_v1.include_router(ai_resume.router)
api_v1.include_router(ai_interview.router)
api_v1.include_router(ai_predictions.router)
api_v1.include_router(ai_sentiment.router)
api_v1.include_router(ai_payroll_anomaly.router)
api_v1.include_router(ai_leave_optimizer.router)
api_v1.include_router(ai_audit.router)
api_v1.include_router(ai_policy.router)
api_v1.include_router(ai_insights.router)

app.include_router(api_v1)


# Legacy /api root so default health-check works
@app.get("/api/")
async def root():
    return {"status": "ok", "service": "hrms-api", "version": "1.0.0"}


@app.get("/api/health")
async def health():
    return {"status": "healthy"}
