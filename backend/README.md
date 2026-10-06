# AI Study Platform - Backend Service

Before choosing backend work, read the
[Production Readiness Checklist](../docs/PRODUCTION_READINESS_CHECKLIST.md).
It separates verified local security work from pending grounding, worker,
integration and deployment requirements. Update the relevant task ID and evidence
with each implementation; startup requires real Supabase configuration or explicit
local memory mode.

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

`APP_ENV` is required and has no default. The backend refuses to start without
it, and `ENVIRONMENT` is derived from it (do not set both).

| `APP_ENV` | Purpose | Supabase target | Test traffic |
| --- | --- | --- | --- |
| `local` | Developer machine | Loopback only (`127.0.0.1`/`::1`) or memory mode | All automated tests run locally |
| `test` | Automated pytest, e2e, load, stress and edge cases | Loopback only; sockets blocked; disposable pgvector container | Yes, zero Supabase egress |
| `staging` | Bounded synthetic smoke checks | Pinned to `momo-staging` (`zkouryrzhsgaeqyiwwyb`) | Smoke only; never load/stress |
| `production` | Real users | Pinned to `momo-prod` (`liyuyfqkbknxorzoekkq`) | None, ever |

Project refs are pinned in `app/config.py`. A staging process configured with
the production ref or URL (or the reverse) fails validation at startup, and
local/test refuse any hosted ref or non-loopback URL. Staging and production
also reject memory persistence, development identity, inline job execution,
local/mock embeddings, placeholder (`mock-`, `your-`, `replace-`, `placeholder`,
`changeme`) or blank secrets, placeholder CORS origins and non-HTTPS origins.
Startup errors never echo configuration values.

Local development:

```bash
cp .env.example .env   # APP_ENV=local, memory mode, mock providers
```

Templates for hosted services are `.env.staging.example` and
`.env.production.example`; they intentionally fail startup until secrets are
injected.

### Secret Injection And Rotation

- Never write real values into `.env*.example`, commits, CI logs or tickets.
  `.env` files are git-ignored; CI fails on tracked `.env` files or key material.
- Hosted processes receive `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
  `OPENROUTER_API_KEY` (and S3 keys if used) from the hosting platform's secret
  store as environment variables. Staging and production use separate secrets
  scoped to their own project; never share a key across environments.
- Managed JWTs are verified through the project's JWKS; leave
  `SUPABASE_JWT_SECRET` empty unless a legacy HS256 secret is deliberately used.
- Rotation: create the new key in the provider dashboard (Supabase API keys,
  OpenRouter), update the hosting secret, roll API and worker processes, verify
  startup and a staging smoke check, then revoke the old key. Rotate immediately
  if a key appears in logs or history; rewriting history does not un-leak it.
- Mobile/web clients only ever receive the public anon key and API URL.

### Durable Workers And Scheduling

The API only enqueues work (`internal.background_jobs`, migration 006). Run one
or more separate worker processes in staging/production:

```bash
uv run python -m app.workers.runner
```

Workers claim jobs with `FOR UPDATE SKIP LOCKED`, hold renewable leases
(`JOB_LEASE_SECONDS`, heartbeat every `JOB_HEARTBEAT_SECONDS`), retry up to
`JOB_MAX_ATTEMPTS`, and dead-letter exhausted jobs with a controlled user-facing
failure. A killed worker's jobs are reclaimed after its lease expires. SIGTERM
drains in-flight jobs for up to `WORKER_DRAIN_SECONDS`. Each worker also runs
retention cleanup and orphaned-work recovery every `CLEANUP_INTERVAL_SECONDS`
and logs `RETENTION_OVERDUE` when the oldest unexpired original is overdue by
more than `CLEANUP_OVERDUE_ALERT_SECONDS`. Local/test may set
`INLINE_JOB_EXECUTION=true`, which runs queued jobs in-process through the same
lease path after the response is sent.

Expensive-operation rate limits (generation, chat, math, images, signed upload,
registration) are stored in PostgreSQL and shared across replicas and restarts.
They key on the verified user ID only (forwarding headers are not trusted) and
fail closed with `503 RATE_LIMIT_UNAVAILABLE` if shared state is unreachable.

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

Apply all migrations in `migrations/` in order to the intended Momo Supabase
project using Supabase MCP. Configure Google Auth, the backend JWT issuer/audience and signing settings,
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
checks locally; with `REQUIRE_PG_INTEGRATION=1` (set in CI) a missing database
fails instead. Never point tests at a hosted database.

The worker runner schedules retention cleanup. For an external scheduler, the
one-shot task is still available:

```bash
uv run python -m app.workers.cleanup_worker
```

It removes at most 100 expired original objects per invocation and marks metadata
`EXPIRED` only after successful deletion. It never deletes generated sets or
items. Configure S3 lifecycle rules as a backstop when using S3. Monitor cleanup
failures and oldest overdue expiry; scheduling is required for physical deletion.

See [the security and verification report](../docs/BACKEND_DATABASE_SECURITY.md)
for agent report cards, test scope and production deployment limitations.
