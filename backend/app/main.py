"""FastAPI app factory + routers."""
import logging

from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import Base, engine
from app.core.exceptions import register_exception_handlers
from app.api.routes import attendance, auth, dashboard, employees, leave, notifications, payroll, performance, recruitment, reports
from app.models import attendance as _a  # noqa: F401
from app.models import employee as _e  # noqa: F401
from app.models import leave as _l  # noqa: F401
from app.models import notification as _n  # noqa: F401
from app.models import payroll as _p  # noqa: F401
from app.models import performance as _pf  # noqa: F401
from app.models import recruitment as _r  # noqa: F401
from app.models import user as _u  # noqa: F401

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
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("HRMS DB tables ensured")


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

app.include_router(api_v1)


# Legacy /api root so default health-check works
@app.get("/api/")
async def root():
    return {"status": "ok", "service": "hrms-api", "version": "1.0.0"}


@app.get("/api/health")
async def health():
    return {"status": "healthy"}
