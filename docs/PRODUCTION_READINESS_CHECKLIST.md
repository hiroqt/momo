# Momo Production Readiness Checklist

Last audited: **October 6, 2026 (Asia/Manila)**. Code baseline: **896d534 on main** plus the
uncommitted October 6 four-team integration (see [integration report](../.agents/tasks/momo-readiness-2026-10-06/integration-report.md)).
Overall status: **NOT PRODUCTION READY**. No Momo hosted environment is verified.

This is the canonical task and progress tracker. Requirements remain governed by
[ARD_PRD.md](../ARD_PRD.md), with boundaries in [ARCHITECTURE.md](../ARCHITECTURE.md)
and engineering rules in [AGENTS.md](../AGENTS.md) and [SKILL.md](../SKILL.md).
This checklist records implementation evidence; it cannot override the PRD.

## Read This Before Choosing Work

1. Read the PRD, this checklist, and the relevant source before implementing.
2. Choose an unchecked task whose dependencies are satisfied. Claim its ID in the
   active-work table before editing. Do not invent an unrelated next feature.
3. Inspect the current branch and working tree. The baseline above is a snapshot;
   re-check source and tests if subsequent commits change the relevant module.
4. Resolve a PRD conflict explicitly. Implement to the existing PRD or obtain an
   approved PRD revision; do not turn a conflicting prototype into a requirement.
5. Implement the smallest complete task and verify its listed acceptance criteria.
6. Update its checkbox, status, evidence, commit/report, and verification date in
   the same change. An implementation without verification stays PARTIAL.
7. Report blockers precisely. If a task needs a project, credential, product
   decision, or physical device, name what is missing and continue independent
   work when possible. Never invent a deployment, test result, or credential.

Do not calculate a production-readiness percentage from the checked boxes.
Security, grounding, data durability, and deployment gates are not interchangeable.

### Status Rules

| Status | Checkbox | Meaning |
| --- | --- | --- |
| DONE_LOCAL | Checked | Acceptance passed in the recorded local/test environment only. |
| DONE_STAGING | Checked | Acceptance also passed against the intended staging services/build. |
| DONE_PROD | Checked | Deployed and verified in the intended production environment. |
| PARTIAL | Unchecked | Code exists, but requirements or verification remain incomplete. |
| TODO | Unchecked | Required work is not delivered in the audited scope. |
| NOT_VERIFIED | Unchecked | No adequate evidence; absence of evidence is not proof of absence. |
| IN_PROGRESS | Unchecked | Claimed work is active; record owner, branch, and next action. |
| BLOCKED_INPUT | Unchecked | A named external decision/input is required. |

Checked local tasks do not close their corresponding hosted or release gates.
Never mark a parent feature done merely because a child task passed.

### Active Work

Confirmed first wave: PRD mismatches, AI safety and environment setup. Parallel implementation is active. Hosted projects use hiroqt/Singapore; only local staging rehearsals are authorized now. Production test traffic is prohibited. Google OAuth is unavailable.

| Task ID | Owner/chat | Branch | Status | Last update | Blocker or next action |
| --- | --- | --- | --- | --- | --- |
| API-01 | Team B; integration | main | PARTIAL | 2026-10-06 | Contract matrix + tests done; `POST /api/folders` Idempotency-Key and chat/image bounds open. |
| ECON-01 | Team B (server), Team C (client); integration | main | PARTIAL / BLOCKED_INPUT | 2026-10-06 | Server ledger + `/api/economy/*` registered; regen interval, refill price, XP table, coin/credit naming, reward path and folder-charge activation need product decisions. |
| AI-01 / AI-02 / AI-04 / DOC-02 / CHAT-01 | Team A; integration | main | AI-01 DONE_LOCAL; others PARTIAL | 2026-10-06 | TypeSafe calibration, embedding model vs VECTOR(1536), math vision fallback policy (BLOCKED_INPUT). |
| AUTH-01 / OFF-01 / OFF-02 / SYNC-01 | Team C; integration | main | OFF-01/OFF-02 DONE_LOCAL; AUTH-01/SYNC-01 PARTIAL | 2026-10-06 | Google OAuth client, redirect allow-list and staging anon key missing; native journeys in QA-01. |
| ENV-01 / ENV-02 / WORK-01 / WORK-02 / SEC-01 / RET-01 / CI-01 | Team D; root owns MCP | main | WORK-01/SEC-01 DONE_LOCAL; others open | 2026-10-06 | Next: ENV-02 apply 001-006 to momo-staging per [rollout plan](../.agents/tasks/momo-readiness-2026-10-06/staging-rollout-plan.md); never momo-prod. |
| Integration / QA | integration step | main | DONE_LOCAL (local suite only) | 2026-10-06 | 653 backend (0 skipped), 150 mobile, 25 web tests; ruff/mypy whole backend clean. See [overall summary](../.agents/tasks/momo-readiness-2026-10-06/OVERALL_SUMMARY.md). |

Fresh parallel discovery/baseline: [October 6 report](parallel-readiness-baseline-2026-10-06.md). 181 backend tests (zero skipped), 67 mobile tests, 25 web tests, client types, isolated web build and local workloads passed. No implementation or hosted gate closed.

## Verified Work Already Delivered

These checkboxes reflect recorded local evidence, not a deployed application.
The [backend/database report](BACKEND_DATABASE_SECURITY.md) contains the detailed
agent report cards and validation scope. Commits are visible on main.

- [x] **DONE-01 / DONE_LOCAL: Tenant schema and RLS.** Migration 002 provides
  Auth ownership, forced owner-read RLS, client-write denial, composite ownership
  relationships, private document bucket limits, and indexes. Evidence:
  [migration](../backend/migrations/002_tenant_security.sql),
  [PostgreSQL tests](../backend/tests/test_postgres_rls.py), commit `b67e188`.
- [x] **DONE-02 / DONE_LOCAL: Backend JWT verification.** Unsigned tokens and
  implicit dummy identity are rejected; signature/issuer/audience/expiry/role/UUID
  checks exist. Evidence: [auth dependency](../backend/app/dependencies.py),
  [security tests](../backend/tests/test_backend_security.py), commit `090ed82`.
- [x] **DONE-03 / DONE_LOCAL: Bounded database I/O.** Reused Supabase transport,
  timeouts, asynchronous offloading and cancellation-safe query permits exist.
  Live failures do not switch persistence to memory. Evidence:
  [session](../backend/app/db/session.py), security tests.
- [x] **DONE-04 / DONE_LOCAL: Atomic quota registration.** Concurrent document
  registration enforces the monthly cap; same-document retries do not consume it
  again, and invalid writes roll quota back. Evidence: migration 002 and PG tests.
- [x] **DONE-05 / DONE_LOCAL: Owner-scoped sync persistence.** Database sync and
  learning updates are atomic; uniqueness is `(user_id,event_id)` and ownership
  references are validated. Evidence: [sync repo](../backend/app/db/repositories/sync_repo.py), PG/API tests.
- [x] **DONE-06 / DONE_LOCAL: Generation-job finalization.** The job path commits
  set/items/completion atomically; concurrent finalizers reuse one set, and late
  worker updates cannot downgrade completion. Evidence:
  [generation repo](../backend/app/db/repositories/generation_repo.py), PG tests.
  This does not establish equivalent safety for chat imports/deck creation.
- [x] **DONE-07 / DONE_LOCAL: Upload validation and integrity.** Canonical UUID
  paths, object-size checks, actual byte checks, archive expansion bounds, page
  rejection, and internal SHA-256 hashes exist. Evidence:
  [document worker](../backend/app/workers/document_worker.py),
  [storage tests](../backend/tests/test_storage_security.py).
- [x] **DONE-08 / DONE_LOCAL: Retention task implementation.** Bounded cleanup
  deletes originals before marking EXPIRED and preserves generated material.
  Evidence: [cleanup worker](../backend/app/workers/cleanup_worker.py),
  [cleanup tests](../backend/tests/test_cleanup_worker.py). Scheduling is open.
- [x] **DONE-09 / DONE_LOCAL: Scoped retrieval and aggregates.** PostgreSQL
  retrieval filters ownership/expiry, bounds results and omits vectors; folder
  counts, activity dates and learning statistics are computed server-side.
  Evidence: migration 002 and PG tests. Real semantic embedding quality is open.
- [x] **DONE-10 / DONE_LOCAL: Listing pagination and mobile compatibility.**
  Bounded server lists and mobile page collection preserve older records and
  reject partial-page failures. Evidence: [page collector](../mobile/lib/api/pagination.ts),
  [pagination tests](../mobile/__tests__/apiPagination.test.ts), commit `746b464`.
- [x] **DONE-11 / DONE_LOCAL: Error handling at audited boundaries.** Request
  validation excludes echoed input; database and audited provider errors use
  controlled messages. Evidence: [main](../backend/app/main.py),
  [error privacy tests](../backend/tests/test_api_error_privacy.py). Full provider/log audit is open.
- [x] **DONE-12 / DONE_LOCAL: Local security/regression/load infrastructure.**
  Recorded run: 181 backend tests, including 22 PG tests; 2,000 ASGI requests and
  400 SQL queries. Hosted provider sockets are blocked. Evidence:
  [test recipe](../scripts/testing/README.md), backend report, commit `78d1f1d`.
- [x] **DONE-13 / DONE_LOCAL: Study and quiz interaction improvements.**
  Recall gating, grading, option shuffling, answer/reveal race guards, timers,
  actual result metrics and long-content layouts have documented development
  simulator checks. Evidence: [study/quiz report](momo-study-quiz-enhancement-report.md).
- [x] **DONE-14 / DONE_LOCAL: Mobile pages, motion and story export.** Dashboard,
  Library, AI, Settings, preview Shop, onboarding motion and native PNG handoff
  have documented simulator evidence. Evidence:
  [UI report](momo-mobile-ui-enhancement-report.md),
  [onboarding design](momo-onboarding-design.md). Real login/payment readiness is not implied.
- [x] **DONE-15 / DONE_LOCAL: Latest recorded mobile validation.** 67 unit tests
  and TypeScript checking passed in the security-change session. Backend mypy
  covered 32 files with imports skipped; scoped Ruff passed. Counts are historical
  results, not a coverage percentage or a fresh run for future changes.

## Module Readiness Map

| Module / PRD reference | Current assessment | Missing release evidence or functionality | Next task IDs |
| --- | --- | --- | --- |
| Supabase schema / sections 7, 8 security contract | DONE_LOCAL | Intended hosted project/migration/advisor checks | ENV-01, ENV-02 |
| Backend auth / invariant 3, section 8.1 | DONE_LOCAL | Real Google-issued JWT flow, profile and session lifecycle | AUTH-01, AUTH-02 |
| Upload/extraction / section 6.1 | PARTIAL | Managed upload protocol, real OCR, worker recovery | DOC-01, DOC-02, WORK-01 |
| Retention / invariant 1 | PARTIAL | Scheduler, monitoring, orphan uploads and hosted deletion proof | RET-01 |
| Embeddings/retrieval / section 6.2 | PARTIAL | Configured semantic model, relevance and dimension evaluation | AI-03 |
| Generation / section 6.2 | PARTIAL (2026-10-06: source-only DONE_LOCAL) | Calibrated evidence verification, real-model evaluation | AI-02, AI-04, FORMAT-01 |
| Tutor/card imports / section 6.3 | PARTIAL / PRD conflict | Non-source paths, rejected-item backfill and direct import validation | AI-01, CHAT-01 |
| Math/camera / section 6.4 | PARTIAL | Real OCR/vision, verified answers, fail-closed provider behavior | AI-04, MATH-01 |
| Images/diagrams / section 6.5 | PARTIAL | Hosted provider/rendering and factual-versus-creative labels | IMAGE-01 |
| Library/folders / section 6.6 | PARTIAL | Atomic imported-item append/count, durable offline mutations, credit charging | CHAT-01, OFF-01, SYNC-01, ECON-01 |
| Hearts/XP/coins/cosmetics / section 6.7 | PARTIAL / policy BLOCKED_INPUT (2026-10-06) | Five hearts aligned; server ledger exists; approved policy values and client wiring | ECON-01 |
| Offline sets/sessions / invariant 5 | DONE_LOCAL (2026-10-06) | Native release-build kill/airplane-mode journeys | OFF-01, OFF-02, QA-01 |
| Offline sync / section 8.5 | Backend DONE_LOCAL; client PARTIAL | Durable UUID queue, batches <=100, exact acknowledgments and recovery | SYNC-01, API-01 |
| Onboarding/mobile UX / section 6.8 | DONE_LOCAL for reported preview flows | Release devices, accessibility, real-account flows | AUTH-01, QA-01 |
| Web showcase / section 6.9 | NOT_VERIFIED in this audit | Current build/tests, honest preview boundary and deployment | WEB-01 |
| Deployment/operations / DoD | TODO / NOT_VERIFIED | CI, deployment, observability, restores and rollback | CI-01, OPS-01, OPS-02, RELEASE-01 |

## Confirmed Gaps And Requirement Conflicts

These findings come from source inspection at the baseline. They are not new
product requirements and must not be silently normalized into the PRD.

| Finding | Evidence | Required resolution |
| --- | --- | --- |
| Client identity is a dummy token; onboarding completes guest flow | [API client](../mobile/lib/api/client.ts), [welcome](../mobile/app/(auth)/welcome.tsx) | AUTH-01; real Supabase Google sessions for hosted data |
| Ordinary study sets and event queue are memory-only; native SQLite store accepts previews only | [localDb](../mobile/lib/storage/localDb.ts), [preview store](../mobile/lib/storage/previewStore.native.ts) | OFF-01/OFF-02; do not claim full offline durability |
| Library mutations are memory-only and may be discarded after three failed retries; answer sync sends the entire queue | [mutation queue](../mobile/lib/sync/mutationQueue.ts), [sync engine](../mobile/lib/sync/syncEngine.ts) | SYNC-01; durable, bounded, recoverable, idempotent events |
| Generation schema permits false source-only; chat can build synthetic-source decks and restore rejected raw items | [generation schema](../backend/app/schemas/generation.py), [chat service](../backend/app/services/chat/chat_service.py) | AI-01; PRD invariant 2 and validation rules remain mandatory |
| Grounding validator tests attribution presence, not claim support, and can append an MCQ answer to options | [validator](../backend/app/services/validation/grounding_validator.py) | AI-02/FORMAT-01; citation fields alone do not establish grounding |
| OCR defaults to fabricated mock text | [OCR service](../backend/app/services/ocr/ocr_service.py), [PDF extractor](../backend/app/services/extraction/pdf_extractor.py) | DOC-02; missing extraction must fail or run real OCR |
| Embedding service defaults to deterministic word hashes; configured embedding model is not passed into the OpenRouter constructor | [embedding service](../backend/app/services/embeddings/embedding_service.py) | AI-03; configured semantic model and schema dimension must agree |
| AI math/chat paths retain mock fallbacks, and provider selection can choose a mock when credentials are absent | [AI provider](../backend/app/services/ai/ai_provider.py) | AI-04; no production fabricated success |
| Jobs and rate-limit history are process-local | [document routes](../backend/app/api/routes/documents.py), [generation routes](../backend/app/api/routes/generations.py), [limiter](../backend/app/services/security/rate_limiter.py) | WORK-01/SEC-01; local atomic save is not durable job dispatch |
| PRD states five hearts; client starts with fifteen and local wallet balances | [CreditsContext](../mobile/context/CreditsContext.tsx), PRD section 6.7 | ECON-01; follow PRD or obtain an explicit revision |
| PRD advertises sync/events, a study-set creation route, and full detail items; current routes differ | [sync routes](../backend/app/api/routes/sync.py), [study routes](../backend/app/api/routes/study_sets.py), PRD sections 8.4/8.5 | API-01; reconcile contracts and compatibility explicitly |
| API profile fabricates a name/email fallback rather than loading the real profile | [auth route](../backend/app/api/routes/auth.py) | AUTH-02; do not display invented account facts |

Status of the findings above on October 6, 2026 (uncommitted four-team integration, local
evidence only; rows kept for history). Dummy client identity is replaced by a Supabase PKCE
session service, but the hosted journey is BLOCKED_INPUT (AUTH-01). Ordinary sets, sessions,
events and library mutations are durable in account-partitioned SQLite (OFF-01/OFF-02 DONE_LOCAL,
SYNC-01 client). `source_only=false` is rejected, and the validator checks chunk support and never
repairs an MCQ (AI-01 DONE_LOCAL, AI-02 PARTIAL). Mock OCR, embedding and AI fallbacks fail closed
outside dev/test (DOC-02/AI-03/AI-04 PARTIAL with named inputs). Jobs and rate limits use
PostgreSQL (WORK-01/SEC-01 DONE_LOCAL). The five-heart baseline is enforced in the client wallet and
the server ledger (ECON-01 PARTIAL, policy BLOCKED_INPUT). Sync/events, study-set creation and
detail items are reconciled (API-01 PARTIAL). `/api/me` no longer invents facts (AUTH-02 PARTIAL).

## What To Work On Next

**First coding task: AI-01.** It can be completed locally with mocked providers;
it removes known source-only/validation bypasses before real users upload notes.
**First infrastructure task: ENV-01.** Project selection is pending. The previous
decision was local preparation for a new Momo project, not deployment to dtr,
run-app, or yhel-os. Do not repurpose those projects or create paid resources by
assuming an organization/region. Collect the missing target choices when doing it.

| Wave | Recommended sequence | Work that may proceed independently |
| --- | --- | --- |
| 1: Close safety gaps | AI-01 -> AI-02; AI-04; DOC-02 | ENV-01 planning, AUTH-01 implementation, OFF-01 design |
| 2: Connect the real path | ENV-01 -> ENV-02; AUTH-01 -> AUTH-02; DOC-01; AI-03 | WORK-01, SEC-01, CI-01 local setup |
| 3: Durable end-to-end study | WORK-01 -> WORK-02; OFF-01 -> OFF-02 -> SYNC-01; CHAT-01 | RET-01 deployment, API-01, FORMAT-01 |
| 4: Complete PRD capabilities | ECON-01; MATH-01; IMAGE-01; WEB-01 | SEC-02, OPS-01, OPS-02 |
| 5: Release qualification | QA-01 -> QA-02 -> RELEASE-01 | Documentation/evidence cleanup; no new untracked feature scope |

These waves are a recommendation, not permission to skip dependencies. Provider,
job system, hosting and wallet implementation choices must fit the existing
architecture; record the concrete design before introducing new infrastructure.

## Open Task Checklist

All tasks below are **unchecked** at this snapshot. Owner labels identify the
responsible role, not an already-running agent. Evidence required to close a task
is listed under Acceptance. Add dates, commits and reports after actual completion.

### AI-01: Enforce Source-Only And Remove Validation Bypasses

- [x] **DONE_LOCAL (2026-10-06); hosted gate open. Owner: AI/backend. Dependencies: none.**
- Scope: generation schema, AI provider, chat service, chat import route; PRD invariant 2 and sections 6.2/6.3.
- Acceptance: reject `source_only=false` on grounded-study APIs; disable unapproved source-free study generation; never backfill discarded raw items; require validated owned evidence before imports/persistence. Empty/insufficient source returns a controlled result without fabricated content. Creative images and standalone math retain their separately specified scope.
- Evidence: adversarial API/worker/chat/import tests prove no rejected or unsupported item is saved; report the exact entry points covered.
- Evidence 2026-10-06 (local only): Team A ([report](../.agents/tasks/momo-readiness-2026-10-06/team-a-report.md)): `source_only` is `Literal[True]`; mock fallbacks removed; validator output is the only persisted list; imports/decks require owned READY unexpired chunks (memory + `persist_chat_deck` RPC). E2E: `source_only=false` -> 422, empty evidence -> `INSUFFICIENT_SOURCE` with no set, invalid MCQ -> `VALIDATION_FAILED` with no set, injected document text stays inside escaped evidence ([integration report](../.agents/tasks/momo-readiness-2026-10-06/integration-report.md)).

### AI-02: Validate Typed Items And Actual Evidence Support

- [ ] **PARTIAL; release blocker. Owner: AI/backend. Dependencies: AI-01. BLOCKED_INPUT: TypeSafe/Jev calibration budget and labeled corpus.**
- Scope: schemas, grounding validator, synthesis/retrieval contracts, worker/chat validation; PRD sections 3/6.2 and AGENTS rules 13-17.
- Acceptance: schema-validate every item, bind citations to actual retrieved chunks owned by the user, reject missing/fabricated/contradictory/unsupported references, validate answer/explanation support, and retain provenance. Implement bounded TypeSafe judgments where required by the PRD; preserve Nemotron generation. Reject or review uncertain results, with thresholds evaluated on labeled fixtures rather than copied blindly.
- Evidence: schema/type/fabricated citation/negation/partial-support/injection/duplicate and controlled-insufficiency cases. Use the [TypeSafe skill](../.agents/skills/typesafe-ai/SKILL.md) and current [citation-check documentation](https://docs.typesafe.ai/cookbooks/citation_check); typed output alone is not proof of truth. Ordinary tests mock providers.
- Evidence 2026-10-06 (local only): deterministic chunk-support checks (answer/explanation coverage, polarity, MCQ exactly 4 options) in place; thresholds are provisional. Open: relation-blind short answers (A-5), reviewer over-rejection (A-6), unverified `hint` passthrough (A2-1).

### AI-03: Wire And Evaluate Real Semantic Embeddings

- [ ] **PARTIAL; release blocker. Owner: retrieval/backend. Dependencies: ENV-01, AI-04. BLOCKED_INPUT: embedding model choice — PRD `nvidia/embeddings-nv-embed-qa-4` is unverified on OpenRouter and commonly 1024-dim vs schema VECTOR(1536).**
- Scope: embedding service/config, chunks repo and vector RPC; PRD sections 1/6.2.
- Acceptance: honor configured model/provider, validate vector count/order/dimension and finite values, prevent local word-hash fallback in production, and batch/cache safely. Confirm model availability and 1536-dimensional compatibility; identify any PRD conflict before changing models/schema. Re-embedding strategy records model/version and prevents mixed indexes.
- Evidence: mocked transport failure/shape tests plus a small approved staging relevance corpus with measured retrieval quality and cost. No hosted load test; ANN indexes need measured justification.
- Evidence 2026-10-06 (local only): configured model honored, batches of 64, count/order/1536-dim/finite validation, fail-closed outside dev/test. Mixed-index prevention (per-chunk model column) open.

### AI-04: Fail Closed Across Production AI Providers

- [ ] **PARTIAL; release blocker. Owner: AI/backend. Dependencies: none. BLOCKED_INPUT: approved model policy for the math-photo vision fallbacks.**
- Scope: AI/embedding/OCR/image configuration and provider boundaries.
- Acceptance: production rejects absent/placeholder credentials and mock providers; timeout/quota/malformed output produces controlled failure. Provider fallback stays within approved model policy and never changes grounded evidence into general knowledge or mocked success. Remove raw provider payloads from logs.
- Evidence: production-config tests for all paths, bounded retry/timeout tests and redaction checks. Verify current provider/model contracts before integration changes; do not substitute a different generation model silently.
- Evidence 2026-10-06 (local only): generation/chat/math/embedding/OCR fail closed with bounded retries and no payload logging; chat/math -> 503 `AI_UNAVAILABLE`, worker -> `PROVIDER_UNAVAILABLE`. Image provider unchanged.

### ENV-01: Select And Configure The New Momo Environments

- [ ] **PARTIAL / BLOCKED_INPUT; release blocker. Owner: infrastructure. Missing: hosting target, server secret injection, Google OAuth client + `aistudy://auth/callback` redirect allow-list, staging/prod anon keys, allowed origins.**
- Scope: dedicated development/staging/production configuration, server secrets and public client configuration.
- Acceptance: record intended project refs and environment ownership without secret values; configure service credentials, JWT issuer/audience and allowed origins; production disables development identity/memory. Define secret injection/rotation and separation of staging from production. Existing unrelated Supabase projects remain untouched.
- Evidence: configuration/startup smoke report with redacted configuration categories. MCP connection by itself does not configure `.env` or deploy anything.
- Evidence 2026-10-06 (local only): `APP_ENV` required; staging/production refs pinned (`zkouryrzhsgaeqyiwwyb` / `liyuyfqkbknxorzoekkq`), cross-pointing refused at startup; local/test loopback-only so tests cause zero Supabase egress; managed envs reject memory/dev auth/inline jobs/mock providers/placeholder secrets. 84 environment-isolation tests.

### ENV-02: Apply And Verify Hosted Database Contracts

- [ ] **NOT_VERIFIED; release blocker. Owner: database (root via Supabase MCP). Dependencies: ENV-01.**
- Scope: migrations 001/002 through Supabase MCP; RLS/grants/RPCs/storage settings.
- Acceptance: audit any existing records, apply ordered migrations to the chosen environment, check advisors, verify two real users and anon cannot access/mutate foreign data, and verify service-only RPCs through managed PostgREST. Confirm metadata-only queries and migration rollback strategy.
- Evidence: migration IDs, sanitized advisor findings/remediations, bounded synthetic smoke report and cleanup. No hosted stress/load tests or original-document downloads for general diagnostics.
- Evidence 2026-10-06 (local only): ordered bundle 001-006 with hashes, advisors, metadata-only verification and a two-user synthetic smoke + cleanup prepared in the [staging rollout plan](../.agents/tasks/momo-readiness-2026-10-06/staging-rollout-plan.md). Not applied by the integration step; momo-prod untouched.

### AUTH-01: Implement Real Supabase Google Sessions On Mobile

- [ ] **PARTIAL; release blocker. Owner: mobile/auth. Hosted journey BLOCKED_INPUT: Google OAuth client, Supabase redirect allow-list, staging anon key.**
- Scope: auth/session service, secure token persistence, deep links, routing and API client.
- Acceptance: Google login/cancel/error, token refresh, expired session, logout, cold start and guest preview work; remove default dummy identity from hosted builds. Server identity always comes from verified tokens. Public client configuration contains no elevated key.
- Evidence: unit tests and staging iOS/Android auth journeys including redirect failures, revoked/expired tokens and restart. Pure implementation can start before hosted choices are complete.
- Evidence 2026-10-06 (local only): Team C ([report](../.agents/tasks/momo-readiness-2026-10-06/team-c-report.md)): PKCE GoTrue session service, chunked SecureStore, refresh/single-flight 401/revocation/cold start/account switch/logout; elevated keys rejected. Unit tests only; no device run.

### AUTH-02: Real Profiles And Account Data Isolation

- [ ] **PARTIAL; release blocker. Owner: auth/mobile/backend. Dependencies: AUTH-01, ENV-02.**
- Scope: users/profile persistence, `/api/me`, local caches, logout/account deletion.
- Acceptance: real profile facts replace invented name/email; local data is partitioned by verified account and cleared/isolated on logout/account switch. Verify account deletion removes owned records and original objects without affecting other users; separately preserve study sets on ordinary source deletion.
- Evidence: user A -> logout -> user B journey proves no cached A data; deletion and ownership tests, documented data lifecycle.
- Evidence 2026-10-06 (local only): `/api/me` returns only verified/persisted facts (nulls otherwise; mobile type now nullable). Open: populate `public.users` from Supabase Auth (trigger/upsert), device logout -> other-account journey.

### DOC-01: Verify Direct Upload With Managed Storage

- [ ] **PARTIAL; release blocker. Owner: storage/mobile/backend. Dependencies: AUTH-01, ENV-02.**
- Scope: signed upload URL contract, mobile uploader, registration and storage driver.
- Acceptance: verify the actual Supabase signed-upload HTTP method/headers/body/token/expiry, or the configured S3 protocol, on native clients. Test 15 MB boundary, MIME mismatch, wrong owner/path, missing upload, repeated registration, interrupted upload and provider failure. Never stream live original bytes through FastAPI.
- Evidence: bounded synthetic native upload -> registration -> processing journey with object/metadata cleanup. Do not assume generic PUT semantics suit every provider.
- Evidence 2026-10-06 (local only): local journey upload-url -> mock signed PUT -> registration -> durable ingestion -> READY covered over ASGI; oversized (422/400), size mismatch, 413 body cap and unsupported type rejected. Managed signed-upload protocol on native clients still unverified.

### DOC-02: Real OCR And Safe Extraction Failures

- [ ] **PARTIAL; release blocker. Owner: extraction/backend. Remaining: real scanned-document fixture corpus through Tesseract.**
- Scope: OCR abstraction and PDF/DOCX/TXT/PPTX extractors; PRD section 6.1 and AGENTS rules 10/11.
- Acceptance: real scanned/low-text OCR preserves page/slide metadata; mock OCR is test-only. Reject corrupt/encrypted/oversized archives or binary parsing failures safely instead of decoding binary bytes as valid lecture text. Enforce 50 pages on scans as well as normal extraction; bound parsing resources.
- Evidence: fixture corpus for all formats, scans, empty material, hostile archives and extraction failures. No invented OCR text can reach generation.
- Evidence 2026-10-06 (local only): encrypted/corrupt/spoofed PDF and corrupt DOCX/PPTX fail with safe messages end to end (5 e2e cases); archive guard bounds members/expansion; mock OCR refused outside dev/test.

### WORK-01: Durable Job Dispatch And Separate Workers

- [x] **DONE_LOCAL (2026-10-06); deployment tracked in OPS-01. Owner: backend/infrastructure.**
- Scope: request job creation, durable queue/claiming, worker execution and deployment.
- Acceptance: API returns promptly; parsing/OCR/embedding/generation do not block the API event loop; jobs survive API/worker restarts. Use bounded concurrency, leases/heartbeat, retry limits and recovery for stale jobs. Store owned status/progress and sanitized failures.
- Evidence: process-kill/restart, queued-job recovery and concurrent worker tests. Atomic finalization exists but does not replace durable dispatch.
- Evidence 2026-10-06 (local only): Team D ([report](../.agents/tasks/momo-readiness-2026-10-06/team-d-report.md)): `internal.background_jobs` with leases, heartbeat, retry limits, stale-lease recovery, SKIP LOCKED claiming, separate `python -m app.workers.runner`. Integration stress: 16 concurrent PG workers claimed 200 jobs exactly once. Note D-1: generation handler marks its own FAILED state, so queue retries do not apply to generation (manual retry route).

### WORK-02: Idempotent Ingestion And Recovery

- [ ] **PARTIAL; release blocker. Owner: backend. Dependencies: WORK-01.**
- Scope: registration scheduling, document processing/chunk writes and generation retries.
- Acceptance: concurrent registration/re-delivery schedules or claims one logical ingestion; retries replace/upsert indexes coherently without duplicate chunks or READY -> FAILED races. Reuse successful processing where safe. Retry only failed attempts; deleting a source during work gives a controlled outcome while published sets remain usable.
- Evidence: double delivery, partial indexing, crash between stages, lost responses, expiry/deletion and simultaneous finalizer tests.
- Evidence 2026-10-06 (local only): one logical ingestion per document, chunk replacement on retry, READY/EXPIRED downgrade guard (DB trigger verified in e2e), deletion-during-work no-op. Open: D-2 enqueue failure after job persist can yield a duplicate generation on client retry; D-3 orphan recovery has no cap; chunk delete+insert not one RPC. Memory dead-letter now mirrors the SQL COMPLETED guard (D-4 fixed).

### RET-01: Schedule And Prove Physical Original Deletion

- [ ] **PARTIAL; release blocker. Owner: infrastructure/storage. Dependencies: ENV-01, ENV-02, DOC-01.**
- Scope: cleanup scheduler, S3 lifecycle if used, storage inventory and alerts.
- Acceptance: enforce 72-hour original retention, monitor overdue expirations and cleanup failure, handle orphan signed uploads that were never registered, and retry deletion safely. Bound batch capacity to volume. Remove bytes through the storage provider, not only metadata; verify sources disappearing cannot remove generated sets/items.
- Evidence: aged synthetic objects, unregistered objects, failed deletion/retry, scheduler execution and oldest-overdue alert report. Record scheduling granularity and observed deletion timing.
- Evidence 2026-10-06 (local only): worker schedules cleanup every 900 s (batch 100) plus `RETENTION_OVERDUE` alert; e2e proves expiry keeps generated sets in memory and PG paths. Open: unregistered orphan uploads, hosted deletion proof, measured timing.

### OFF-01: SQLite Persistence For Ordinary Study Data

- [x] **DONE_LOCAL (2026-10-06); native airplane-mode journey tracked in QA-01. Owner: mobile/offline.**
- Scope: localDb, SQLite migrations/repositories for sets/items/folders/sessions/events.
- Acceptance: ordinary generated sets persist across process death and can be read offline; account partitioning, transactions, versioned migrations and corrupt-data handling exist. Preserve provenance and sets after source expiry. Preview-only storage is not the production repository.
- Evidence: actual downloaded set -> kill app -> airplane mode -> reopen/read/practice; migration/rollback, account-isolation and low-storage tests.
- Evidence 2026-10-06 (local only): versioned forward-only SQLite migrations with rollback, account partitions, corrupt-data fail-closed, low-storage message (node:sqlite, file-backed reopen). Mobile suite 150/150.

### OFF-02: Durable Study Sessions And Resume

- [x] **DONE_LOCAL (2026-10-06); release-build journeys tracked in QA-01. Owner: mobile/study.**
- Scope: study/quiz routes, session state, results and pending events.
- Acceptance: save committed answers/results/timer state transactionally, resume after restart without double rewards or lost answers, preserve correct/review/skipped semantics, and prohibit offline AI generation. Handle source expiry and offline deletion without deleting cached generated material accidentally.
- Evidence: restart midway, offline completion, repeated taps/timeouts, resume/restart, expired source and reconnect journeys on release builds.
- Evidence 2026-10-06 (local only): answer + sync event + wallet snapshot committed in one SQLite transaction; resume restores order/answers/timers; replay/concurrent taps award once; reveal charged once after durable write.

### SYNC-01: Durable Bounded Client Sync And Mutation Ledger

- [ ] **PARTIAL; release blocker. Client DONE_LOCAL; server `Idempotency-Key` on `POST /api/folders` and a two-device journey remain.**
- Scope: sync engine, mutation queue, session references and API acknowledgments.
- Acceptance: stable UUID events survive restart; flush batches of at most 100; remove only exactly acknowledged events. Persist retry state, handle transient failures without silent discard, and resolve authorization/conflicts explicitly. Make folder creation and other offline mutations idempotent, not only answer events; preserve dependencies/client-to-server IDs.
- Evidence: 101+ queued events, lost response/replay, reconnect/app kill, mixed invalid/valid references, two accounts/devices and duplicate folder-create tests. Backend atomic sync is already delivered.
- Evidence 2026-10-06 (local only): client batches <=100, exact acknowledgments, durable held queue + attention sheet, persisted backoff. Integration fix: hosted `process_sync_batch` rejections now map to the per-event codes the client isolates (42501 -> 404 `STUDY_ITEM_NOT_FOUND`, 22023 -> 422 `VALIDATION_ERROR`). E2E: 101 events in 100+1 batches, replay ignored, >100 rejected, foreign reference 404 (memory and PG).

### API-01: Reconcile PRD, Clients And REST Contracts

- [ ] **PARTIAL; release blocker. Owner: API/docs/mobile. Dependencies: none for contract audit.**
- Scope: OpenAPI, PRD sections 8.1-8.10, client methods, schemas and routes.
- Acceptance: explicitly resolve sync/events versus sync, missing advertised study-set creation/full-detail behavior, upload field names, UUID paths and response fields. Preserve existing clients with documented compatibility where needed. Apply bounds to body/text/image inputs and consistent safe errors; never silently edit requirements to match prototypes.
- Evidence: contract matrix, OpenAPI/API/client contract tests and approved documentation updates.
- Evidence 2026-10-06 (local only): [contract matrix](API_CONTRACT_MATRIX.md) + OpenAPI tests (Team B); integration added `page_count` to `GET /api/documents/{id}/status` (PRD 8.2). Recorded deviations: `/api/me` exposes `id` (PRD says `user_id`; documented as aligned); oversized `upload-url` returns 422 `VALIDATION_ERROR` from the schema bound instead of `DOCUMENT_TOO_LARGE`.

### CHAT-01: Grounded Atomic Chat Decks And Imports

- [ ] **PARTIAL; release blocker. Owner: tutor/backend. Dependencies: AI-01, AI-02, API-01.**
- Scope: chat tools, card import route and study repository append/count operations.
- Acceptance: imports cannot accept unvalidated arbitrary factual cards; server verifies owned provenance and allowed types. Save deck/items atomically and append imported cards without overwriting old local items or drifting counts. Use retry-safe identifiers; citation/tool arguments never grant cross-user access.
- Evidence: duplicate import/lost response, multiple imports, bad citation, foreign source, tool injection, rejected items and rollback tests. Do not claim generation-job finalizer covers this separate path.
- Evidence 2026-10-06 (local only): atomic deck RPC with deterministic set id (12 concurrent PG calls -> one set). Open: server-issued reference for importing model-generated cards; `generate_study_card` ignores expiry (A2-2).

### FORMAT-01: Verify Every Required Study Format

- [ ] **PARTIAL; release blocker. Owner: generation/mobile. Dependencies: AI-02, API-01.**
- Scope: all PRD section 6.2 types, schemas, generation requirements and study rendering.
- Acceptance: flashcards, four-option single-answer MCQ, true/false, identification, fill-in-the-blank, practice exams, summaries, Q&A and explanations follow count/difficulty/format and source metadata. Resolve current reviewer aliases explicitly; never fix invalid MCQ by appending extra choices. Mixed types and insufficient evidence have defined outcomes.
- Evidence: per-format schema/provider fixtures plus real saved-content native journeys; distinguish mock-provider tests from a bounded real-model evaluation.
- Evidence 2026-10-06 (local only): all 14 formats round-trip mock -> validator; MCQ exactly four options; e2e invalid MCQ variants never persisted. Native rendering and real-model evaluation open.

### SEC-01: Shared Expensive-Operation Rate Limits

- [x] **DONE_LOCAL (2026-10-06); managed multi-replica validation in OPS-01/staging. Owner: backend/infrastructure.**
- Scope: rate limiter and upload/generation/chat/math/image entry points.
- Acceptance: limits hold across replicas/restarts, cover expensive signed upload/processing paths, and use verified identity/trusted proxy handling. Decide controlled behavior when shared state is unavailable; preserve the quota transaction and retry headers.
- Evidence: local multi-instance concurrency, restart and dependency-failure tests; no hosted load/stress traffic.
- Evidence 2026-10-06 (local only): PostgreSQL sliding window shared across connections (24 concurrent -> exactly 5 allowed), upload/registration covered, verified identity only, 503 fail-closed, unchanged 429 body/headers.

### SEC-02: Release Security And Privacy Audit

- [ ] **NOT_VERIFIED; release blocker. Owner: security/backend/mobile. Dependencies: ENV-02, AUTH-02, AI-01, API-01.**
- Scope: all API/provider/worker logs, release bundles, secrets, headers and data lifecycle.
- Acceptance: audit raw provider/error logging beyond the previously tested boundaries; block secret-bearing output and redact signed URLs/tokens/content from logs. Verify HTTPS, CORS, request limits, prompt boundary separation, dependency risks, account isolation and retention. Hashing does not replace encryption or ownership. Test fixtures contain generated synthetic tokens only.
- Evidence: documented findings/resolutions, bundle/secret scans and adversarial tests. No absolute claim that all possible leaks are impossible.

### ECON-01: Authoritative Hearts, XP, Credits And Cosmetics

- [ ] **PARTIAL / BLOCKED_INPUT; release blocker. Missing decisions: heart regeneration interval, refill price, XP table, credits vs Momo Coins naming and earning, reward path from sync, folder-charge activation sequencing.**
- Scope: CreditsContext, study rewards, folder costs, shop grants and server ledger.
- Acceptance: reconcile fifteen local hearts with PRD five; enforce documented regeneration, rewards, conversion and folder credit costs server-side. Idempotent transactions prevent double rewards/spend and concurrent overdrafts; account-scoped balances survive restart/device switch. Preserve honest preview labels until grants are implemented. Do not invent real-money checkout unless approved requirements add it.
- Evidence: concurrent spend/replay/offline reconnect, time boundaries, logout/account switch and invalid balance tests; updated approved economy specification if behavior changes.
- Evidence 2026-10-06 (local only): PRD five hearts and corrected folder formula enforced in migration 005; `/api/economy/wallet|hearts/consume|hearts/refill` now registered in `main.py`; refill fails closed with `ECONOMY_POLICY_PENDING`. E2E/stress: 20 concurrent API spends -> exactly 5; PG 80 concurrent purchases over 40 keys -> exactly 33 at 30 credits; replays never double-apply. Client wallet still local preview (Team C).

### MATH-01: Verify Math And Camera Solver End To End

- [ ] **PARTIAL; release blocker. Owner: math/backend/mobile. Dependencies: AI-04, DOC-02, AUTH-01.**
- Scope: math API, real image OCR/vision and replaceable verification/solver service.
- Acceptance: recognized problem, typed steps, final answer and explanation are verified; malformed images, ambiguous/unreadable problems and provider failures produce controlled results. No mocked answer is presented as production success. Bound payloads and preserve user privacy.
- Evidence: labeled algebra/calculus/statistics examples, unreadable photos, wrong-result detection, camera permissions and native release journeys.

### IMAGE-01: Verify Images And Educational Diagrams

- [ ] **PARTIAL; release blocker. Owner: visuals/backend/mobile. Dependencies: AI-04, AUTH-01.**
- Scope: image API/provider, deterministic diagram renderer and native viewer/export.
- Acceptance: configured provider returns valid bounded media, diagrams render required labels, and creative imagery is never represented as source evidence. Validate untrusted prompt/context and failures, image sizes, accessibility and cancellation.
- Evidence: provider fixture validation, bounded staging smoke, label/content checks and native viewing/error journeys.

### WEB-01: Verify Showcase And Preview Deployment

- [ ] **NOT_VERIFIED; release blocker for the PRD web surface. Owner: web. Dependencies: ENV-01, AI-04, SEC-02.**
- Scope: Next.js showcase, preview chat, media assets, public configuration and deployment.
- Acceptance: run the current web build/type/tests; validate desktop/mobile layout and media; enforce preview/provider abuse controls and clearly separate demo output from a signed-in source-grounded account. No service/provider secret reaches client bundles.
- Evidence: current build/test output, browser journeys, safe preview failure and deployed synthetic smoke report. Do not extrapolate mobile evidence to web.

### CI-01: Reproducible Automated Release Checks

- [ ] **PARTIAL; release blocker. Owner: QA/infrastructure. Remaining: a clean GitHub Actions run (requires a push by the release owner).**
- Scope: tracked CI workflow, lockfiles, synthetic fixtures and local PG/pgvector jobs.
- Acceptance: run backend unit/API/real-DB checks, lint/type checks, mobile tests/type checks and web checks on clean environments. Ensure native flows/fixtures needed by reports are reproducible and tracked safely. Block secrets/caches/generated artifacts; hosted traffic is prohibited in normal tests. Fail if required integration silently skips.
- Evidence: clean CI run with named commands, counts, artifacts and environment versions. Broaden typing coverage deliberately; prior scoped mypy is not full-app strict typing.
- Evidence 2026-10-06 (local only): `.github/workflows/ci.yml` (actionlint-clean) with pgvector service, no-skip junit gate, secret/artifact scan. Integration pinned `ruff==0.16.10`/`mypy==2.4.0` as a uv dev group and cleared the legacy ratchet: whole backend ruff and mypy (72 files) pass.

### OPS-01: Deploy Services With Observability And Readiness

- [ ] **TODO; release blocker. Owner: infrastructure/backend. Dependencies: ENV-02, WORK-01, SEC-01, CI-01.**
- Scope: API/worker/scheduler deployment, HTTPS/domain, configuration and monitoring.
- Acceptance: reproducible release artifacts, dependency-aware readiness separate from liveness, bounded probes and structured privacy-safe correlation logs. Alert on failed/stale jobs, quota violations, AI spend, cleanup backlog and sync errors; define incident/runbooks and capacity objectives. Existing health endpoint alone does not prove DB/worker readiness.
- Evidence: staging rollout and dependency-failure/drain tests, dashboards/alert exercise and documented latency/error/cost targets. Use local synthetic load for capacity experiments.

### OPS-02: Backups, Restore And Rollback

- [ ] **NOT_VERIFIED; release blocker. Owner: database/infrastructure. Dependencies: ENV-02, OPS-01.**
- Scope: database backup/restore, schema rollout and app/worker compatibility.
- Acceptance: restore persistent generated material into an isolated target, verify owner security after restore, define recoverable migration/app rollback and approved recovery objectives. Backups must not silently extend temporary original-file retention beyond policy; document backup/access implications.
- Evidence: restore drill, restored-set checks, compatibility/rollback report and recovery runbook. Never run destructive reset fixtures against hosted application data.

### QA-01: Real-Account Native End-To-End Journeys

- [ ] **NOT_VERIFIED; release blocker. Owner: QA/mobile. Dependencies: AUTH-02, DOC-01, AI-02, AI-03, WORK-02, OFF-02, SYNC-01, FORMAT-01.**
- Scope: release builds using the staging backend and synthetic academic fixtures.
- Acceptance: Google login -> upload -> processing -> grounded generation -> study -> restart offline -> reconnect/sync -> source expiry -> retained set works on iOS/Android. Include two-user denial, counts, cancellation, process death, lost responses, invalid files, empty evidence and long-content/large-text cases.
- Evidence: dated device/build/environment matrix, saved scenarios and sanitized failure artifacts. UI tester-army/e2e or existing native tools may be used after checking their current contracts; existing preview simulator flows do not close this task.

### QA-02: Physical Devices, Accessibility And Performance

- [ ] **NOT_VERIFIED; release blocker. Owner: QA/mobile/web. Dependencies: QA-01, ECON-01, MATH-01, IMAGE-01, WEB-01.**
- Scope: supported physical devices, release builds and web viewports.
- Acceptance: screen-reader labels/focus, large text, compact/landscape, keyboard, reduced motion and media permissions pass. Measure release startup/scroll/input/memory/battery behavior against documented targets; verify signing, real network interruption and safe share/export results. Do not require automatic Instagram posting or invent paid checkout scope.
- Evidence: device/accessibility/performance matrix and resolved regressions; simulator functional checks are supporting evidence only.

### RELEASE-01: Production Launch Decision

- [ ] **TODO; release blocker. Owner: release lead. Dependencies: all applicable blockers above.**
- Scope: release configuration/builds, operational gates and public product claims.
- Acceptance: all required PRD features are verified or changed through an explicit approved PRD revision; signed iOS/Android builds, necessary store/internal distribution configuration, privacy/support information and correct environment targets are ready. Disable previews/dummy identity on hosted paths; define rollout and rollback. Obtain the concrete release decision before publishing.
- Evidence: completed release gate below, release artifact IDs, migration/version manifest, bounded production smoke results and rollback ownership. A passing local test count is not launch approval.

## Final Release Gate

- [ ] No unresolved PRD conflict; source-only and required study formats are enforced.
- [ ] Intended Supabase project, migrations, Auth, RLS, grants and private storage verified.
- [ ] Real-account native upload/generation/study/offline/reconnect journey verified.
- [ ] Grounding evaluation rejects unsupported content; mocks cannot run as production providers.
- [ ] Jobs survive crashes, shared rate limits hold, and retries cannot duplicate grants/content.
- [ ] Ordinary sets, sessions and pending mutations survive app restart and account switching safely.
- [ ] Originals are physically deleted on schedule; published generated sets remain accessible.
- [ ] Required tutor/math/images/economy/web capabilities meet their documented scope.
- [ ] CI, release-device accessibility/performance, secret scans and bounded staging checks pass.
- [ ] Monitoring, restores, incident response and rollout/rollback drills have dated evidence.
- [ ] Distribution/privacy/support requirements are complete for the selected launch channel.
- [ ] Release decision and post-deploy smoke evidence recorded; no unchecked mandatory blocker.

## Evidence And Handoff Template

Copy this into the task's report or change description, then update this file.

```text
Task ID:
Owner/chat and branch:
PRD requirement and scope:
Status before -> after:
Files/migrations/API contracts changed:
Commit(s) / review link:
Commands and exact results:
Environment/device/provider (local/mock/staging/production):
Acceptance criteria covered and remaining gaps:
Data/secret/egress implications and cleanup:
Blocker or unresolved requirement conflict:
Verification date:
Next eligible task ID and why its dependencies are satisfied:
```

Keep historical reports intact. Add a new dated evidence entry when behavior or
verification changes; do not overwrite an old result to imply it was rerun.
Do not add estimates, percentage completion or production guarantees without an
explicit basis. At this baseline, local checks passed and hosted/release gates
remain open.
