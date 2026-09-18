from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

class Settings(BaseSettings):
    # Supabase
    SUPABASE_URL: str = "https://mock-project.supabase.co"
    SUPABASE_ANON_KEY: str = "mock-anon-key"
    SUPABASE_SERVICE_ROLE_KEY: str = "mock-service-role-key"
    SUPABASE_JWT_SECRET: Optional[str] = "mock-jwt-secret"

    # AWS S3
    AWS_ACCESS_KEY_ID: str = "mock-access-key"
    AWS_SECRET_ACCESS_KEY: str = "mock-secret-key"
    AWS_REGION: str = "us-east-1"
    AWS_S3_BUCKET: str = "study-platform-documents"
    S3_PRESIGNED_URL_EXPIRE_SECONDS: int = 3600
    DOCUMENT_RETENTION_DAYS: int = 3

    # OpenRouter / NVIDIA Nemotron
    OPENROUTER_API_KEY: str = "mock-openrouter-key"
    OPENROUTER_BASE_URL: str = "https://openrouter.ai/api/v1"
    NEMOTRON_MODEL: str = "nvidia/nemotron-4-340b-instruct"

    # Embedding Provider ('local', 'openrouter', 'supabase')
    EMBEDDING_PROVIDER: str = "local"
    EMBEDDING_MODEL: str = "nvidia/embeddings-nv-embed-qa-4"

    # Product Constraints
    MONTHLY_DOCUMENT_LIMIT: int = 10
    MAX_FILE_SIZE_MB: int = 15
    MAX_PAGE_COUNT: int = 50

    # Environment
    ENVIRONMENT: str = "development"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
