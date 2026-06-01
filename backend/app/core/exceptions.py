"""Consistent API errors: {"detail": "...", "code": "..."}."""
from fastapi import HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

STATUS_CODES = {
    400: "bad_request",
    401: "unauthorized",
    403: "forbidden",
    404: "not_found",
    409: "conflict",
    422: "validation_error",
    500: "internal_error",
    503: "service_unavailable",
}


class HRMSException(Exception):
    """Raise with an explicit error code."""

    def __init__(self, status_code: int, detail: str, code: str):
        self.status_code = status_code
        self.detail = detail
        self.code = code
        super().__init__(detail)


def api_error(status_code: int, detail: str, code: str | None = None) -> None:
    """Convenience: raise HRMSException."""
    raise HRMSException(status_code, detail, code or STATUS_CODES.get(status_code, "error"))


def _normalize_detail(detail) -> tuple[str, str | None]:
    if isinstance(detail, dict) and "detail" in detail and "code" in detail:
        return str(detail["detail"]), str(detail["code"])
    if isinstance(detail, str):
        return detail, None
    if isinstance(detail, list):
        parts = []
        for item in detail:
            if isinstance(item, dict):
                parts.append(item.get("msg", str(item)))
            else:
                parts.append(str(item))
        return "; ".join(parts) or "Request failed", None
    return str(detail), None


def register_exception_handlers(app):
    @app.exception_handler(HRMSException)
    async def hrms_exception_handler(_request: Request, exc: HRMSException):
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail, "code": exc.code},
        )

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(_request: Request, exc: StarletteHTTPException):
        message, code = _normalize_detail(exc.detail)
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "detail": message,
                "code": code or STATUS_CODES.get(exc.status_code, "error"),
            },
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(_request: Request, exc: RequestValidationError):
        message, _ = _normalize_detail(exc.errors())
        return JSONResponse(
            status_code=422,
            content={"detail": message, "code": "validation_error"},
        )
