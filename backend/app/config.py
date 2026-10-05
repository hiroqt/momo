
from typing import Literal

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Supabase
    SUPABASE_URL: str = "https://mock-project.supabase.co"
    SUPABASE_ANON_KEY: str = "mock-anon-key"
    SUPABASE_SERVICE_ROLE_KEY: str = "mock-service-role-key"
    SUPABASE_JWT_SECRET: str | None = "mock-jwt-secret"
    SUPABASE_JWT_AUDIENCE: str = "authenticated"
    DATABASE_BACKEND: str = "supabase"
    ENABLE_DEV_AUTH: bool = False
    DATABASE_MAX_CONCURRENT_QUERIES: int = Field(default=16, ge=1, le=128)
    DATABASE_QUERY_TIMEOUT_SECONDS: int = Field(default=15, ge=1, le=120)
    CORS_ORIGINS: list[str] = ["http://localhost:8081", "http://localhost:3000"]

    # Storage Configuration ('supabase', 's3')
    STORAGE_PROVIDER: Literal["supabase", "s3"] = "supabase"
    SUPABASE_STORAGE_BUCKET: Literal["documents"] = "documents"

    # AWS S3 (Optional if using Supabase Storage)
    AWS_ACCESS_KEY_ID: str = "mock-access-key"
    AWS_SECRET_ACCESS_KEY: str = "mock-secret-key"
    AWS_REGION: str = "us-east-1"
    AWS_S3_BUCKET: str = "study-platform-documents"
    S3_PRESIGNED_URL_EXPIRE_SECONDS: int = 3600
    DOCUMENT_RETENTION_DAYS: int = Field(default=3, ge=3, le=3)

    # OpenRouter / NVIDIA Nemotron
    OPENROUTER_API_KEY: str = "mock-openrouter-key"
    OPENROUTER_BASE_URL: str = "https://openrouter.ai/api/v1"
    NEMOTRON_MODEL: str = "nvidia/nemotron-4-340b-instruct"
    OPENROUTER_IMAGE_MODEL: str = "google/gemini-3.1-flash-image"

    # Embedding Provider ('local', 'openrouter', 'supabase')
    EMBEDDING_PROVIDER: str = "local"
    EMBEDDING_MODEL: str = "nvidia/embeddings-nv-embed-qa-4"

    # Product Constraints
    MONTHLY_DOCUMENT_LIMIT: int = Field(default=10, ge=1, le=10)
    MAX_FILE_SIZE_MB: int = Field(default=15, ge=1, le=15)
    MAX_PAGE_COUNT: int = Field(default=50, ge=1, le=50)

    # Rate Limiting (Requests per minute per user/IP)
    RATE_LIMIT_CHAT_PER_MINUTE: int = 20
    RATE_LIMIT_GENERATION_PER_MINUTE: int = 5
    RATE_LIMIT_MATH_PER_MINUTE: int = 10
    RATE_LIMIT_GLOBAL_PER_MINUTE: int = 60

    # Environment
    ENVIRONMENT: str = "development"

    @model_validator(mode="after")
    def validate_security_mode(self):
        if self.DATABASE_BACKEND not in {"supabase", "memory"}:
            raise ValueError("DATABASE_BACKEND must be supabase or memory")
        if self.ENVIRONMENT not in {"development", "test"}:
            if self.ENABLE_DEV_AUTH or self.DATABASE_BACKEND == "memory":
                raise ValueError("Development authentication/storage are prohibited outside development/test")
            if "*" in self.CORS_ORIGINS:
                raise ValueError("Production CORS requires explicit origins")
        return self

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
