# AI Study Platform - Backend Service

FastAPI backend service powering document ingestion, text extraction, semantic chunking, vector retrieval, and grounded educational content generation using NVIDIA Nemotron.

---

## Directory Structure

```
backend/
|-- pyproject.toml        # Dependencies and build settings
|-- uv.lock               # Lockfile for reproducible environments
|-- .env.example          # Environment variable template
|-- migrations/
|   |-- 001_initial_schema.sql # Base PostgreSQL schema and pgvector
|   `-- 002_tenant_security.sql # Ownership, RLS, grants, indexes and transactional RPCs
|-- app/
|   |-- main.py           # FastAPI entry point, CORS, and error handlers
|   |-- config.py         # Pydantic Settings management
|   |-- dependencies.py   # FastAPI dependency injection
|   |-- api/
|   |   `-- routes/       # API routers (auth, documents, generations, study_sets, sync)
|   |-- db/
|   |   |-- session.py    # Supabase client initialization
|   |   `-- repositories/ # Database repository pattern implementations
|   |-- domain/
|   |   `-- documents/    # Core domain business models
|   |-- schemas/          # Pydantic request/response schemas
|   |-- services/
|   |   |-- ai/           # AIProvider interface and OpenRouter client
|   |   |-- extraction/   # Document extractors (PDF, DOCX, TXT, PPTX) and chunker
|   |   |-- embeddings/   # Embedding computation and vector search
|   |   |-- retrieval/    # RAG ranking and context synthesis
|   |   |-- storage/      # AWS S3 presigned URL generation and client
|   |   |-- synthesis/    # Grounded prompt compilation
|   |   |-- validation/   # Schema, grounding, and deduplication validators
|   |   `-- ocr/          # Pluggable OCR interface
|   `-- workers/          # Async background ingestion and generation workers
`-- tests/                # Automated pytest suite
```

---

## Environment Configuration

Create a `.env` file from the provided template:

```bash
cp .env.example .env
```

Ensure the following variables are configured:

```ini
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# AWS S3 (3-day document retention)
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=us-east-1
AWS_S3_BUCKET=study-platform-documents
S3_PRESIGNED_URL_EXPIRE_SECONDS=3600
DOCUMENT_RETENTION_DAYS=3

# AI Provider (NVIDIA Nemotron Ultra)
OPENROUTER_API_KEY=your-openrouter-api-key
NEMOTRON_MODEL=nvidia/nemotron-4-340b-instruct

# Quotas and Restrictions
MONTHLY_DOCUMENT_LIMIT=10
MAX_FILE_SIZE_MB=15
MAX_PAGE_COUNT=50
ENVIRONMENT=development
DATABASE_BACKEND=supabase
ENABLE_DEV_AUTH=false
```

---

## Development Setup

### Using uv (Recommended)

```bash
# Install dependencies
uv sync

# Run the development server
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### Using standard pip and virtual environment

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -e .
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Interactive API documentation will be available at:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

---

## Running Automated Tests

Run the test suite using pytest:

```bash
uv run pytest -v
```

To run with coverage reporting:

```bash
uv run pytest --cov=app tests/
```

---

## Architectural Rules and Standards

1. **Strict Source Grounding**: All generation prompts enforce `source_only = true`. AI responses are grounded exclusively on retrieved document chunks.
2. **Defensive Prompt Construction**: Retrieved chunks are treated as untrusted data and strictly isolated from system instructions.
3. **Decoupled Architecture**: File storage, extraction, chunking, embedding, retrieval, and generation are kept in separate services.
4. **Temporary Raw Document Retention**: Original objects expire after 3 days; generated study sets persist independently. Source chunks are removed with document metadata and expired documents are excluded from retrieval.

## Security Setup And Local Verification

Apply both migrations in order to the new Momo Supabase project using Supabase
MCP. Configure Google Auth, the backend JWT issuer/audience and signing settings,
and explicit production CORS origins. All application records belong to
`auth.users.id`; authenticated clients can only read their own rows. All writes
use verified FastAPI ownership checks plus database constraints. A server-role
key bypasses RLS and must remain secret.

The default database mode fails closed when Supabase is missing. For isolated
local development only, set `DATABASE_BACKEND=memory`; dummy authentication also
requires `ENABLE_DEV_AUTH=true`. Production rejects those options. Tests use
dedicated synthetic configuration and block outgoing sockets.

Run real local PostgreSQL/pgvector tests without hosted Supabase egress:

```bash
docker compose -f ../scripts/testing/compose.yml up -d --wait
LOCAL_TEST_DATABASE_URL=postgresql://postgres:local-test-only@127.0.0.1:55432/momo_security_test uv run pytest -q
docker compose -f ../scripts/testing/compose.yml down
```

The SQL suite resets schemas only in the dedicated loopback database named
`momo_security_test`. Without that environment variable it skips real database
checks; API and local ASGI tests still run. Never point tests at a hosted database.

Schedule the bounded retention task at least every five minutes, increasing
frequency/batch capacity when expiration volume grows:

```bash
uv run python -m app.workers.cleanup_worker
```

It removes at most 100 expired original objects per invocation and marks metadata
`EXPIRED` only after successful deletion. It never deletes generated sets or
items. Configure S3 lifecycle rules as a backstop when using S3. Monitor cleanup
failures and oldest overdue expiry; scheduling is required for physical deletion.

See [the security and verification report](../docs/BACKEND_DATABASE_SECURITY.md)
for agent report cards, test scope and production deployment limitations.
