import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "OCEANTRACE AI"
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./oceantrace.db")
    DEMO_MODE: bool = os.getenv("DEMO_MODE", "true").lower() == "true"
    GEMINI_API_KEY: str | None = os.getenv("GEMINI_API_KEY")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-1.5-pro-latest")
    GEMINI_ENABLED: bool = os.getenv("GEMINI_ENABLED", "true").lower() == "true"

    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
