"""App config — env-driven, never hardcode secrets."""
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[2] / ".env")


class Settings:
    DATABASE_URL: str = os.environ["DATABASE_URL"]
    DATABASE_URL_SYNC: str = os.environ.get("DATABASE_URL_SYNC", "")
    DB_POOL_PRE_PING: bool = os.environ.get("DB_POOL_PRE_PING", "false").lower() in ("1", "true", "yes")

    SECRET_KEY: str = os.environ["SECRET_KEY"]
    ALGORITHM: str = os.environ.get("ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.environ.get("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
    REFRESH_TOKEN_EXPIRE_DAYS: int = int(os.environ.get("REFRESH_TOKEN_EXPIRE_DAYS", "7"))

    REDIS_URL: str = os.environ.get("REDIS_URL", "")

    CLOUDINARY_CLOUD_NAME: str = os.environ.get("CLOUDINARY_CLOUD_NAME", "")
    CLOUDINARY_API_KEY: str = os.environ.get("CLOUDINARY_API_KEY", "")
    CLOUDINARY_API_SECRET: str = os.environ.get("CLOUDINARY_API_SECRET", "")

    CORS_ORIGINS: str = os.environ.get("CORS_ORIGINS", "*")

    # AI — OpenRouter (replaces Gemini + Groq)
    OPENROUTER_API_KEY: str = os.environ.get("OPENROUTER_API_KEY", "")
    # Legacy keys kept for backward compatibility (not used)
    GEMINI_API_KEY: str = os.environ.get("GEMINI_API_KEY", "")
    GROQ_API_KEY: str = os.environ.get("GROQ_API_KEY", "")


settings = Settings()
