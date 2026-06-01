"""Cloudinary uploads for images and resume PDFs."""
import cloudinary
import cloudinary.uploader
from fastapi import UploadFile

from app.core.config import settings
from app.core.exceptions import api_error

cloudinary.config(
    cloud_name=settings.CLOUDINARY_CLOUD_NAME,
    api_key=settings.CLOUDINARY_API_KEY,
    api_secret=settings.CLOUDINARY_API_SECRET,
)

ALLOWED_RESUME_TYPES = {
    "application/pdf",
    "application/x-pdf",
}
MAX_RESUME_BYTES = 5 * 1024 * 1024  # 5 MB


def ensure_cloudinary_configured():
    if not settings.CLOUDINARY_CLOUD_NAME:
        api_error(503, "Cloudinary not configured", "cloudinary_not_configured")


async def upload_profile_image(contents: bytes, employee_id: str) -> str:
    ensure_cloudinary_configured()
    try:
        upload = cloudinary.uploader.upload(
            contents,
            folder=f"hrms/employees/{employee_id}",
            resource_type="image",
            overwrite=True,
            public_id="profile",
        )
    except Exception as e:
        api_error(500, f"Upload failed: {e}", "upload_failed")
    return upload.get("secure_url", "")


async def upload_resume_pdf(file: UploadFile, job_id: str, email: str) -> str:
    ensure_cloudinary_configured()
    content_type = (file.content_type or "").lower()
    if content_type and content_type not in ALLOWED_RESUME_TYPES:
        api_error(400, "Resume must be a PDF file", "invalid_file_type")
    contents = await file.read()
    if len(contents) > MAX_RESUME_BYTES:
        api_error(400, "Resume must be 5 MB or smaller", "file_too_large")
    if not contents:
        api_error(400, "Resume file is empty", "empty_file")
    safe_email = email.lower().replace("@", "_at_").replace(".", "_")[:40]
    try:
        upload = cloudinary.uploader.upload(
            contents,
            folder=f"hrms/resumes/{job_id}",
            resource_type="raw",
            public_id=f"{safe_email}_{file.filename or 'resume'}",
        )
    except Exception as e:
        api_error(500, f"Resume upload failed: {e}", "upload_failed")
    return upload.get("secure_url", "")
