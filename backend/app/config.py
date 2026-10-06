
from typing import Any, Literal
from urllib.parse import urlsplit

from pydantic import Field, ValidationError, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Each managed environment is pinned to exactly one Supabase project. These refs
# are public identifiers (they appear in client URLs), not credentials. A
# staging process can never start against production data, and vice versa.
STAGING_PROJECT_REF = "zkouryrzhsgaeqyiwwyb"
PRODUCTION_PROJECT_REF = "liyuyfqkbknxorzoekkq"
MANAGED_PROJECT_REFS = {"staging": STAGING_PROJECT_REF, "production": PRODUCTION_PROJECT_REF}
# APP_ENV is the operator-facing selector; ENVIRONMENT is the derived internal
# mode that existing modules use for development/test-only behavior.
APP_ENV_TO_ENVIRONMENT = {"local": "development", "test": "test",
                          "staging": "staging", "production": "production"}
LOOPBACK_HOSTS = {"127.0.0.1", "::1"}


class Settings(BaseSettings):
    # Explicit environment selection; there is intentionally no default.
    APP_ENV: Literal["local", "test", "staging", "production"]

    # Supabase
    SUPABASE_URL: str = "http://127.0.0.1:54321"
    SUPABASE_PROJECT_REF: str = ""
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
    EMBEDDING_PROVIDER: Literal["local", "openrouter"] = "local"
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
    RATE_LIMIT_UPLOAD_PER_MINUTE: int = Field(default=20, ge=1, le=60)

    # Durable background jobs. The API only enqueues; separate worker processes
    # (`python -m app.workers.runner`) claim jobs with renewable leases.
    INLINE_JOB_EXECUTION: bool = True  # local/test convenience only
    JOB_LEASE_SECONDS: int = Field(default=120, ge=15, le=900)
    JOB_HEARTBEAT_SECONDS: int = Field(default=30, ge=5, le=300)
    JOB_MAX_ATTEMPTS: int = Field(default=3, ge=1, le=10)
    JOB_RETRY_DELAY_SECONDS: int = Field(default=30, ge=0, le=3600)
    WORKER_CONCURRENCY: int = Field(default=2, ge=1, le=16)
    WORKER_POLL_SECONDS: float = Field(default=2.0, ge=0.1, le=60)
    WORKER_DRAIN_SECONDS: int = Field(default=30, ge=1, le=600)
    JOB_RECOVERY_GRACE_SECONDS: int = Field(default=300, ge=30, le=86400)
    CLEANUP_INTERVAL_SECONDS: int = Field(default=900, ge=60, le=86400)
    CLEANUP_OVERDUE_ALERT_SECONDS: int = Field(default=3600, ge=60, le=86400)

    # Environment (derived from APP_ENV; never configure independently)
    ENVIRONMENT: Literal["development", "test", "staging", "production"] = "development"
    LOCAL_ONLY: bool = True

    @model_validator(mode="before")
    @classmethod
    def derive_environment(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data
        app_env = data.get("APP_ENV")
        if app_env not in APP_ENV_TO_ENVIRONMENT:
            raise ValueError("APP_ENV must be explicitly set to local, test, staging or production")
        derived = APP_ENV_TO_ENVIRONMENT[app_env]
        if data.get("ENVIRONMENT") not in {None, "", derived}:
            raise ValueError("ENVIRONMENT conflicts with APP_ENV; remove it")
        return {**data, "ENVIRONMENT": derived}

    @property
    def is_managed(self) -> bool:
        return self.APP_ENV in MANAGED_PROJECT_REFS

    def validate_supabase_endpoint(self) -> None:
        """Pin server SDK traffic to a local IP or the selected managed project."""
        parsed = urlsplit(self.SUPABASE_URL)
        if parsed.username or parsed.password or parsed.query or parsed.fragment or parsed.path not in {"", "/"}:
            raise ValueError("Supabase endpoint must be an origin without connection options")
        if self.ENVIRONMENT in {"development", "test"}:
            if not self.LOCAL_ONLY or parsed.scheme not in {"http", "https"} or parsed.hostname not in LOOPBACK_HOSTS:
                raise ValueError("Development/test requires LOCAL_ONLY and an explicit loopback Supabase endpoint")
            if self.SUPABASE_PROJECT_REF:
                raise ValueError("Local/test configuration cannot select a hosted Supabase project")
        else:
            if self.LOCAL_ONLY:
                raise ValueError("Managed staging/production requires LOCAL_ONLY=false")
            expected = MANAGED_PROJECT_REFS.get(self.APP_ENV)
            if not expected or self.SUPABASE_PROJECT_REF != expected:
                raise ValueError("Supabase project does not match the pinned project for this APP_ENV")
            if parsed.scheme != "https" or parsed.hostname != f"{expected}.supabase.co" or parsed.port not in {None, 443}:
                raise ValueError("Supabase endpoint does not match the pinned project for this APP_ENV")

    @model_validator(mode="after")
    def validate_security_mode(self):
        if self.DATABASE_BACKEND not in {"supabase", "memory"}:
            raise ValueError("DATABASE_BACKEND must be supabase or memory")
        if APP_ENV_TO_ENVIRONMENT[self.APP_ENV] != self.ENVIRONMENT:
            raise ValueError("ENVIRONMENT conflicts with APP_ENV")
        self.validate_supabase_endpoint()
        if self.JOB_HEARTBEAT_SECONDS * 2 > self.JOB_LEASE_SECONDS:
            raise ValueError("Job heartbeat must renew well before the lease expires")
        if self.ENVIRONMENT not in {"development", "test"}:
            if self.ENABLE_DEV_AUTH or self.DATABASE_BACKEND == "memory":
                raise ValueError("Development authentication/storage are prohibited outside development/test")
            if self.INLINE_JOB_EXECUTION:
                raise ValueError("Managed environments require separate durable workers")
            for name in ("SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "OPENROUTER_API_KEY"):
                if is_placeholder(getattr(self, name)):
                    raise ValueError(f"{name} must be supplied by server secret configuration")
            if self.SUPABASE_JWT_SECRET and is_placeholder(self.SUPABASE_JWT_SECRET):
                raise ValueError("Remove placeholder JWT secret; managed asymmetric tokens use JWKS")
            if self.EMBEDDING_PROVIDER != "openrouter":
                raise ValueError("Managed environments require a supported semantic embedding provider")
            if not self.CORS_ORIGINS:
                raise ValueError("Managed environments require explicit HTTPS origins")
            for origin in self.CORS_ORIGINS:
                parsed = urlsplit(origin)
                if parsed.scheme != "https" or not parsed.hostname or is_placeholder(parsed.hostname) or "*" in origin or parsed.username or parsed.password or parsed.path or parsed.query or parsed.fragment:
                    raise ValueError("Managed environments require explicit HTTPS CORS origins")
            if self.OPENROUTER_BASE_URL != "https://openrouter.ai/api/v1":
                raise ValueError("Managed AI requests must use the approved provider endpoint")
            if self.STORAGE_PROVIDER == "s3" and any(is_placeholder(getattr(self, name)) for name in ("AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_S3_BUCKET")):
                raise ValueError("Managed S3 storage requires server-side configuration")
        elif self.LOCAL_ONLY and not is_placeholder(self.OPENROUTER_API_KEY):
            raise ValueError("Local-only execution cannot configure a hosted AI credential")
        if self.LOCAL_ONLY and self.EMBEDDING_PROVIDER != "local":
            raise ValueError("Local-only execution requires local embeddings")
        if self.LOCAL_ONLY and self.STORAGE_PROVIDER != "supabase":
            raise ValueError("Local-only execution requires local Supabase/memory storage")
        return self

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

def is_placeholder(value: str) -> bool:
    normalized = value.strip().lower()
    return not normalized or normalized.startswith(("mock-", "your-", "replace-", "placeholder", "changeme"))


def load_settings() -> Settings:
    try:
        return Settings()
    except ValidationError:
        # Pydantic's default error includes the full input dictionary, including
        # server credentials. Never print it at application startup.
        raise RuntimeError("Invalid server configuration. Check environment isolation and required configuration.") from None


settings = load_settings()
