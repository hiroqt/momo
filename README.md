![Momo Header](./mobile/assets/header_momo.png)

# Momo AI Study Platform

A production-oriented educational platform that converts uploaded academic documents (PDF, DOCX, TXT, PPTX) into grounded, interactive study materials using NVIDIA Nemotron Ultra, Retrieval-Augmented Generation (RAG), FastAPI, and React Native (Expo).

The platform enforces a strict evidence-first model: educational content is derived exclusively from user-supplied source materials (`source_only = True`), never hallucinating facts or substituting missing concepts with ungrounded general model knowledge.

Governing specifications: [`ARD_PRD.md`](./ARD_PRD.md), [`ARCHITECTURE.md`](./ARCHITECTURE.md), [`AGENTS.md`](./AGENTS.md), [`SKILL.md`](./SKILL.md).

---

## Table of Contents

- [System Capabilities](#system-capabilities)
  - [Grounded RAG Study Set Generation](#grounded-rag-study-set-generation)
  - [Academic Level and Learner Focus Adaptation](#academic-level-and-learner-focus-adaptation)
  - [Ephemeral 3-Day Storage Decoupling](#ephemeral-3-day-storage-decoupling)
  - [Offline-First Architecture and Idempotent Sync](#offline-first-architecture-and-idempotent-sync)
  - [Step-by-Step LaTeX and Camera Math Solver](#step-by-step-latex-and-camera-math-solver)
  - [Conversational Momo AI Tutor with Citations](#conversational-momo-ai-tutor-with-citations)
  - [2D Educational Concept Diagrams and Illustrations](#2d-educational-concept-diagrams-and-illustrations)
  - [Library, Folders, and Progressive Economics](#library-folders-and-progressive-economics)
  - [Gamified Learning Economy and Customization](#gamified-learning-economy-and-customization)
  - [Web Showcase and Interactive Preview Chat](#web-showcase-and-interactive-preview-chat)
- [System Architecture and Component Topology](#system-architecture-and-component-topology)
- [Technology Stack](#technology-stack)
- [Repository Structure](#repository-structure)
- [Prerequisites](#prerequisites)
- [Backend Setup and Execution](#backend-setup-and-execution)
  - [Environment Configuration](#backend-environment-configuration)
  - [Installation with uv](#installation-with-uv)
  - [Database Migrations](#database-migrations)
  - [Running Backend Tests](#running-backend-tests)
- [Mobile Application Setup](#mobile-application-setup)
  - [Installation and Execution](#mobile-installation-and-execution)
  - [Mobile Environment Configuration](#mobile-environment-configuration)
- [Web Showcase Setup](#web-showcase-setup)
- [Complete API Reference](#complete-api-reference)
- [Security, Guardrails, and Rate Limiting](#security-guardrails-and-rate-limiting)
- [Architectural Invariants](#architectural-invariants)

---

## System Capabilities

### Grounded RAG Study Set Generation
- Multi-format synthesis: Generates flashcards with contextual hints, 4-option multiple-choice questions with answer rationales, true/false propositions with source justifications, identification terms, fill-in-the-blank items, timed practice exams, structured chapter outlines, and deep-dive Q&A pairs.
- Strict evidence isolation: Uploaded text chunks are injected into prompts inside delimited XML `<evidence>` blocks. The model treats source excerpts strictly as reference data, completely immune to prompt injection instructions embedded inside document text.
- Insufficiency reporting: If retrieved chunks do not contain adequate evidence for a requested topic, the pipeline returns a controlled `insufficient_source` status rather than fabricating plausible answers.
- Schema validation and deduplication: AI outputs are validated against Pydantic v2 schemas (`StudyItem`) and filtered against semantic duplicates before database persistence.

### Academic Level and Learner Focus Adaptation
- Academic level calibration: Tailors vocabulary, sentence complexity, and clinical or theoretical depth according to student level (`Grade 9` through `Grade 12`, `1st Year` through `4th Year` College, and `Grad`).
- Learner focus alignment: Directs generation toward specialized outcomes, such as NCLEX board examination pharmacology, civil procedure case law, algorithm complexity proofs, or general definition drills.

### Ephemeral 3-Day Storage Decoupling
- Strict 72-hour TTL: Original uploaded binary files in cloud storage (AWS S3 or Supabase Storage) are automatically purged after 3 days by lifecycle policies.
- Permanent study artifacts: Vector chunks, generated study sets, individual questions, and user progress logs persist indefinitely in PostgreSQL.
- Foreign key protection: Relationships between study sets and source documents use `ON DELETE SET NULL`, ensuring that document expiration never deletes user study sets.

### Offline-First Architecture and Idempotent Sync
- Zero-latency local study: Downloaded study decks and questions are persisted on device in Expo SQLite (`mobile/lib/storage/localDb.ts`). Flashcard flips, quiz responses, and score updates execute with 0ms latency without network connectivity.
- Offline mutation ledger: Client actions taken while disconnected are stored in an idempotent mutation queue (`mobile/lib/sync/mutationQueue.ts`) with client-generated UUID `event_id` keys.
- Idempotent backend reconciliation: When connectivity returns, `SyncEngine` submits batched events to `POST /api/sync/events`. The server applies `ON CONFLICT (event_id) DO NOTHING` to prevent duplicate XP attribution or corrupted study analytics.

### Step-by-Step LaTeX and Camera Math Solver
- Multimodal math input: Accepts handwritten equation photos (via device camera) or typed mathematical notation via `POST /api/math/solve`.
- Specialized math engine: Employs `ocr_service.py` and `math_engine.py` to classify problem categories (Algebra, Calculus, Discrete Math, Statistics), identify foundational theorems, derive step-by-step solutions with LaTeX equations, and provide conceptual rationales.

### Conversational Momo AI Tutor with Citations
- Dynamic agentic tutoring: Multi-turn conversational tutor (`/api/chat`) equipped with autonomous tool calling (`list_user_documents`, `search_documents`, `create_study_deck`, `generate_study_card`, `generate_diagram`, `get_learning_profile`, `generate_weakness_review`).
- Clickable citation pills: Responses cite exact document pages and sections, verified by `retrieval_service.py`.
- 1-tap card import: Standalone review cards generated during tutoring sessions include a single-tap import action (`POST /api/chat/import-card`) that commits the item into a persistent library deck.
- Adaptive weakness remediation: Momo analyzes historical quiz failures and synthesizes custom remedial decks targeting missed topics.

### 2D Educational Concept Diagrams and Illustrations
- Visual concept synthesis: Endpoint `POST /api/images/generate` translates complex mechanisms (Krebs cycle, binary search trees, OSI model layers) into structured 2D diagrams using `diagram_synthesizer.py` and renders them as base64 images.
- Grounded visual prompts: Accepts course context notes and specific student sub-topic requirements to produce syllabus-aligned illustrations.

### Library, Folders, and Progressive Economics
- Hierarchical library: Group study sets and notes into colored folders via `GET /api/folders` and `POST /api/folders`.
- Progressive folder economics:
  - First 3 folders: Free (0 credits).
  - 4th folder: 50 credits.
  - 5th folder: 75 credits.
  - Nth folder ($N \ge 3$): $50 + (N - 3) \times 25$ credits.
- Non-destructive unlinking: Deleting a folder unsets `folder_id` on contained study sets, preserving user study materials.

### Gamified Learning Economy and Customization
- Dual currency and vitality system: Users maintain 5 hearts (depleted by incorrect quiz attempts) and earn XP and Momo Coins through study accuracy.
- Daily study streaks: Tracked via `GET /api/stats/streak` based on consecutive UTC study days.
- Mascot shop (`mobile/app/shop.tsx`): Momo Coins unlock cosmetic skins, headwear, and thematic accessories.
- Academic Weapon Instagram sharing: Generates branded story cards displaying mastery scores, streak milestones, and reviewer titles (`AcademicWeaponStoryCard.tsx`, `shareStory.ts`).

### Web Showcase and Interactive Preview Chat
- Next.js 15 showcase: Located in `web/`, providing product overviews, interactive phone mockups, sound effects, and an interactive preview chat (`/api/momo-preview-chat`) for prospective students.

---

## System Architecture and Component Topology

```text
+-----------------------------------------------------------------------------------+
|                            Presentation Tier (Clients)                            |
|  - Mobile Client (mobile/): React Native 0.76+, Expo SDK 52+, Expo Router, SQLite |
|  - Web Showcase (web/): Next.js 15 App Router, React 19, Tailwind CSS             |
+-----------------------------------------+-----------------------------------------+
                                          |
                        HTTPS REST (Bearer JWT Auth)
                                          |
+-----------------------------------------v-----------------------------------------+
|                    Application & Transport Tier (FastAPI)                         |
|  - Endpoints: Auth, Documents, Generations, Study Sets, Sync, Folders, Math,      |
|    Stats, Chat, Images                                                            |
|  - Middleware: JWT Guard, Sliding Window Rate Limiter, Guardrail Sanitizer        |
+--------------------+------------------------------------+-------------------------+
                     |                                    |
      Enqueues Async Background Tasks             CRUD via Parameterized Repos
                     |                                    |
+--------------------v--------------------+ +-------------v-------------------------+
|     Domain Services & Background Workers| |         Data & Storage Tier           |
|  - DocumentWorker (Ingest, Chunk, Embed)| |  - Supabase PostgreSQL 15+            |
|  - GenerationWorker (RAG, Nemotron, Val)| |  - pgvector (1536-dim IVFFlat Index)  |
|  - Pluggable Storage (S3 / Supabase)    | |  - Ephemeral Object Storage           |
|  - MathEngine, DiagramSynthesizer       | |    (AWS S3 / Supabase, 3-Day TTL)     |
+--------------------+--------------------+ +---------------------------------------+
                     |
         HTTPS Structured JSON Prompts
                     |
+--------------------v--------------------------------------------------------------+
|                          External AI & Validation Tier                            |
|  - OpenRouter Gateway: NVIDIA Nemotron Ultra (nvidia/nemotron-4-340b-instruct)    |
|  - 1536-dimensional Embedding Models (nvidia/embeddings-nv-embed-qa-4)            |
|  - TypeSafe Jev (Semantic validation & grounding judgments)                       |
+-----------------------------------------------------------------------------------+
```

---

## Technology Stack

| Domain | Technology | Implementation Details |
| :--- | :--- | :--- |
| Mobile Application | React Native 0.76, Expo SDK 52 | File-based Expo Router, TypeScript, React 19 |
| Local Mobile Storage | Expo SQLite | Client-side study sets, questions, and mutation ledger |
| Mobile Animations | Lottie React Native | Vector animations (`.lottie.json`) and 3D Reanimated transforms |
| Web Showcase | Next.js 15 App Router | Server Components, React 19, Tailwind CSS, Motion |
| Backend Services | Python 3.11+, FastAPI, Uvicorn | Asynchronous REST API, Pydantic v2 schemas |
| Primary Database | Supabase PostgreSQL 15+ | Relational tables, Row-Level Security, parameterized queries |
| Vector Index | `pgvector` extension | 1536-dimensional cosine similarity indexing (`<=>`) |
| Storage Abstraction | BaseStorageService | AWS S3 or Supabase Storage with presigned direct PUT URLs |
| Large Language Model | NVIDIA Nemotron Ultra | `nvidia/nemotron-4-340b-instruct` via OpenRouter |
| Embeddings | NVIDIA / Local Embeddings | 1536-dimensional vectors for semantic RAG retrieval |
| Document Parsers | pypdf, python-docx, python-pptx | Structural parsing preserving page and slide metadata |

---

## Repository Structure

```text
.
|-- AGENTS.md                         # Operational rules for coding agents
|-- ARCHITECTURE.md                   # Master architecture specification and invariants
|-- ARD_PRD.md                        # Master Architecture & Product Requirements Document
|-- README.md                         # Main project documentation
|-- SKILL.md                          # Implementation workflows and domain guides
|-- backend/
|   |-- pyproject.toml                # Python project dependencies and test configuration
|   |-- uv.lock                       # Deterministic dependency lockfile
|   |-- .env.example                  # Backend environment variable template
|   |-- migrations/
|   |   `-- 001_initial_schema.sql    # Supabase PostgreSQL tables, RLS, and pgvector schema
|   |-- app/
|   |   |-- main.py                   # FastAPI entry point, middleware, and router registration
|   |   |-- config.py                 # Pydantic BaseSettings configuration
|   |   |-- dependencies.py           # Supabase JWT authentication and user context injection
|   |   |-- api/
|   |   |   `-- routes/               # Endpoint routers (auth, documents, generations, etc.)
|   |   |-- db/
|   |   |   |-- session.py            # Supabase database client instantiation
|   |   |   `-- repositories/         # Parameterized data access layer
|   |   |-- domain/                   # Core business entities and domain models
|   |   |-- schemas/                  # Pydantic v2 request and response schemas
|   |   |-- services/
|   |   |   |-- ai/                   # Nemotron Ultra provider, math engine, diagram synthesizer
|   |   |   |-- chat/                 # Momo conversational tutor service and tool executor
|   |   |   |-- embeddings/           # 1536-dim vector embedding generator
|   |   |   |-- extraction/           # Structural parsers (PDF, DOCX, TXT, PPTX) and chunkers
|   |   |   |-- ocr/                  # Optical character recognition service
|   |   |   |-- retrieval/            # RAG ranking, cosine similarity, and context assembler
|   |   |   |-- security/             # Sliding window rate limiter and guardrails sanitizer
|   |   |   |-- storage/              # Pluggable storage abstraction (S3 and Supabase drivers)
|   |   |   `-- validation/           # Grounding validator and duplicate detector
|   |   `-- workers/                  # Background worker tasks (document and generation workers)
|   `-- tests/                        # Comprehensive automated pytest suite
|-- mobile/
|   |-- package.json                  # React Native and Expo dependencies
|   |-- app.json                      # Expo application manifest
|   |-- app/                          # Expo Router file-based route hierarchy
|   |   |-- (auth)/                   # Onboarding and mascot introduction screens
|   |   |-- (tabs)/                   # Dashboard, Library, Profile, and Shop tabs
|   |   |-- chat.tsx                  # Momo conversational tutor interface
|   |   |-- create/[documentId].tsx   # Reviewer generation configuration
|   |   |-- documents/upload.tsx      # Document selection and presigned upload screen
|   |   |-- generation/[jobId].tsx    # Polling progress screen
|   |   |-- math/solve.tsx            # Camera and equation math solver screen
|   |   `-- study/[studySetId].tsx    # Flashcard, quiz, and practice exam runners
|   |-- components/                   # Modular UI components (glass, mascot, chat, study)
|   `-- lib/
|       |-- api/                      # Typed REST client modules
|       |-- storage/                  # Expo SQLite driver and schema definitions
|       `-- sync/                     # Mutation queue and offline sync engine
`-- web/                              # Next.js 15 App Router showcase and preview chat
```

---

## Prerequisites

- Python 3.11 or higher
- `uv` package manager (recommended) or `pip` / `venv`
- Node.js 18.x or higher and npm 9.x or higher
- Access to a Supabase project (PostgreSQL 15+ with `pgvector` extension)
- Storage access: AWS S3 bucket or Supabase Storage bucket
- OpenRouter API key with access to `nvidia/nemotron-4-340b-instruct`

---

## Backend Setup and Execution

### Backend Environment Configuration

Navigate to the `backend/` directory and create `.env` from the template:

```bash
cd backend
cp .env.example .env
```

Configure the environment variables:

```ini
# Supabase Database and Authentication
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
SUPABASE_JWT_SECRET=your-supabase-jwt-secret

# Storage Provider Configuration ('supabase' or 's3')
STORAGE_PROVIDER=supabase
SUPABASE_STORAGE_BUCKET=documents

# AWS S3 Configuration (Required if STORAGE_PROVIDER=s3)
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=us-east-1
AWS_S3_BUCKET=study-platform-documents
S3_PRESIGNED_URL_EXPIRE_SECONDS=3600
DOCUMENT_RETENTION_DAYS=3

# AI Provider Configuration (NVIDIA Nemotron via OpenRouter)
OPENROUTER_API_KEY=your-openrouter-key
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
NEMOTRON_MODEL=nvidia/nemotron-4-340b-instruct

# Embedding Engine Configuration ('local', 'openrouter', or 'supabase')
EMBEDDING_PROVIDER=local
EMBEDDING_MODEL=nvidia/embeddings-nv-embed-qa-4

# Product Quotas and Constraints
MONTHLY_DOCUMENT_LIMIT=10
MAX_FILE_SIZE_MB=15
MAX_PAGE_COUNT=50

# Rate Limiting (Requests per minute per user/IP)
RATE_LIMIT_CHAT_PER_MINUTE=20
RATE_LIMIT_GENERATION_PER_MINUTE=5
RATE_LIMIT_MATH_PER_MINUTE=10
RATE_LIMIT_GLOBAL_PER_MINUTE=60

ENVIRONMENT=development
```

### Installation with uv

Install dependencies and start the development server:

```bash
cd backend
uv sync
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

The API will be accessible at `http://localhost:8000`. Interactive OpenAPI documentation is available at `http://localhost:8000/docs`.

### Database Migrations

Apply the database schema to your Supabase PostgreSQL instance:
1. Open the Supabase project dashboard and navigate to the **SQL Editor**.
2. Paste the contents of `backend/migrations/001_initial_schema.sql`.
3. Execute the SQL script to create tables, foreign keys, `pgvector` indexes, and Row-Level Security (RLS) policies.

### Running Backend Tests

Run the full pytest suite:

```bash
cd backend
uv run pytest -v
```

The automated test suite verifies:
- `test_extraction_and_chunking.py`: File parsing, sliding window chunking, and metadata provenance.
- `test_embeddings_and_rag.py`: Vector embeddings and pgvector cosine distance retrieval.
- `test_grounding_validation.py`: Grounding validator and citation consistency.
- `test_quota_and_lifecycle.py`: 10-document monthly quota and 3-day S3 retention decoupled from study sets.
- `test_api_endpoints.py`: HTTP status codes, schema validation, and error contract format.
- `test_generation_profile.py`: Academic level and learner focus prompt adaptations.
- `test_folders.py`: Library folder operations and progressive credit pricing calculations.
- `test_full_generation_pipeline.py`: End-to-end asynchronous generation lifecycle.

---

## Mobile Application Setup

### Installation and Execution

Navigate to the `mobile/` directory and install dependencies:

```bash
cd mobile
npm install
```

Start the Expo development server:

```bash
npm start
```

Target execution options:
- iOS Simulator: Press `i` in the terminal or run `npm run ios`
- Android Emulator: Press `a` in the terminal or run `npm run android`
- Web Preview: Press `w` in the terminal or run `npm run web`

### Mobile Environment Configuration

Configure `mobile/.env`:

```ini
EXPO_PUBLIC_API_URL=http://localhost:8000
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

When running on a physical mobile device via Expo Go, replace `localhost` with your workstation's LAN IP address (for example, `http://192.168.1.100:8000`).

---

## Web Showcase Setup

Navigate to the `web/` directory and install dependencies:

```bash
cd web
npm install
npm run dev
```

The Next.js showcase will be accessible at `http://localhost:3000`.

---

## Complete API Reference

All requests must supply standard Bearer JWT credentials (`Authorization: Bearer <supabase_jwt>`). Responses adhere to consistent HTTP status codes and structured RFC-style error payloads:

```json
{
  "error": {
    "code": "ERROR_IDENTIFIER",
    "message": "Human-readable technical description."
  }
}
```

### Endpoint Inventory

| Method | Endpoint | Description | Rate Limit |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | System health status check | Global (60/min) |
| `GET` | `/api/me` | Retrieve authenticated user profile | Global (60/min) |
| `POST` | `/api/documents/upload-url` | Validate monthly quota and issue presigned PUT URL | Global (60/min) |
| `POST` | `/api/documents` | Register uploaded document and enqueue async worker | Global (60/min) |
| `GET` | `/api/documents` | List all active uploaded documents for user | Global (60/min) |
| `GET` | `/api/documents/{id}` | Retrieve specific document metadata and status | Global (60/min) |
| `GET` | `/api/documents/{id}/status` | Poll document processing state (`UPLOADED`, `READY`, `FAILED`) | Global (60/min) |
| `DELETE` | `/api/documents/{id}` | Delete document record and purge cloud storage object | Global (60/min) |
| `POST` | `/api/generations` | Trigger RAG study set generation job | 5 requests/min |
| `GET` | `/api/generations/{id}` | Poll generation job progress percentage and stage | Global (60/min) |
| `POST` | `/api/generations/{id}/retry` | Restart failed generation job cleanly | 5 requests/min |
| `GET` | `/api/study-sets` | List all persistent study sets for user | Global (60/min) |
| `POST` | `/api/study-sets` | Create custom study set container | Global (60/min) |
| `GET` | `/api/study-sets/{id}` | Retrieve full study set and grounded study items | Global (60/min) |
| `PATCH` | `/api/study-sets/{id}` | Update study set title, description, or folder ID | Global (60/min) |
| `DELETE` | `/api/study-sets/{id}` | Delete study set and associated study items | Global (60/min) |
| `POST` | `/api/sync/events` | Idempotent batch submission of offline study events | Global (60/min) |
| `GET` | `/api/folders` | List user folders with calculated reviewer counts | Global (60/min) |
| `POST` | `/api/folders` | Create new folder with credit pricing enforcement | Global (60/min) |
| `GET` | `/api/folders/{id}` | Retrieve folder metadata | Global (60/min) |
| `PATCH` | `/api/folders/{id}` | Update folder name or color hex | Global (60/min) |
| `DELETE` | `/api/folders/{id}` | Delete folder (study sets are retained with `folder_id = NULL`) | Global (60/min) |
| `POST` | `/api/math/solve` | Step-by-step LaTeX solution for image or typed formula | 10 requests/min |
| `GET` | `/api/stats/streak` | Retrieve active study dates and consecutive day streak | Global (60/min) |
| `GET` | `/api/chat/sessions` | List conversational chat sessions | Global (60/min) |
| `POST` | `/api/chat/sessions` | Initiate new chat session with Momo tutor | Global (60/min) |
| `GET` | `/api/chat/sessions/{id}` | Retrieve chat session history and messages | Global (60/min) |
| `POST` | `/api/chat/sessions/{id}/messages` | Send message to Momo; executes RAG and tool calls | 20 requests/min |
| `POST` | `/api/chat/import-card` | 1-tap import of generated chat study card into library | Global (60/min) |
| `POST` | `/api/images/generate` | Synthesize 2D educational concept diagram | 5 requests/min |
| `POST` | `/api/momo-preview-chat` | Web showcase interactive demo chat endpoint | 10 requests/min |

---

## Security, Guardrails, and Rate Limiting

1. Sliding Window Rate Limiting:
   - Evaluated per authenticated user and per client IP using `app/services/security/rate_limiter.py`.
   - Distinct limits protect expensive inference endpoints (Generation: 5/min, Images: 5/min, Math: 10/min, Chat: 20/min, Global: 60/min).
2. Prompt Injection Defense:
   - System prompts establish that document text constitutes reference evidence only.
   - All untrusted document excerpts are enclosed in XML tags: `<evidence>...</evidence>`.
   - `guardrails_service.py` inspects incoming queries and instructions, neutralizing attempts to override system personas or disclose backend prompts.
3. Secret Scrubbing:
   - Output sanitization regex scans outgoing model responses, blocking inadvertent leakage of database connection strings, API tokens, internal hostnames, or authentication keys.
4. Server-Side Quota Enforcement:
   - Monthly upload allowances (10 documents per month) are verified at the API level prior to generating presigned upload URLs and re-checked upon document registration.

---

## Architectural Invariants

Developers and autonomous agents must preserve these six system invariants:

1. Ephemeral Document Retention: Original S3/storage documents expire after 3 days. Generated study sets and knowledge items persist indefinitely. Foreign keys linking study sets to documents must use `ON DELETE SET NULL`.
2. Strict Grounding: System prompts must enforce `source_only = True`. Missing evidence must trigger a controlled `insufficient_source` signal. Never supplement answers from general model knowledge.
3. Server-Enforced Identity: User identity must be derived exclusively from validated JWT tokens. Client-provided `user_id` values must never be accepted as authorization.
4. Direct-to-Storage Uploads: Document bytes must never pass through the FastAPI HTTP cycle. Clients must upload directly via presigned PUT URLs.
5. Offline-First Study: Study set review and quiz completion must operate with 0ms latency in offline mode via local Expo SQLite. Progress synchronization must be idempotent via unique `event_id` keys.
6. Server-Side Secrets: Cloud credentials and API keys must remain strictly in backend environment variables and must never be distributed to client bundles.
