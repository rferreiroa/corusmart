"""
Configuration management using Pydantic Settings.
All configuration is loaded from environment variables.
"""

from functools import lru_cache
from typing import Optional
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Application
    app_name: str = "BiciCoruña API"
    app_version: str = "1.0.0"
    debug: bool = False
    environment: str = "development"

    # API
    api_v1_prefix: str = "/api/v1"

    # Database
    database_url: str = "postgresql://postgres:postgres@localhost:5432/bicicoruna"
    database_echo: bool = False

    # CORS
    cors_origins: str = "*"

    # External APIs
    gbfs_base_url: str = "https://acoruna.publicbikesystem.net/customer/gbfs/v2"
    openroute_api_key: Optional[str] = None

    # n8n Integration
    n8n_base_url: str = "http://localhost:5678"
    n8n_webhook_secret: Optional[str] = None

    # Ingestion
    ingestion_interval_seconds: int = 120

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


settings = get_settings()
