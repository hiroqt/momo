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
|   `-- 001_initial_schema.sql # PostgreSQL schema, pgvector, and RLS policies
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
4. **Temporary Raw Document Retention**: Uploaded documents are deleted after 3 days; generated study sets and vector indices remain permanent.
