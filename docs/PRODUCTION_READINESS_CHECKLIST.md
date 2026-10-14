# Momo Production Readiness Checklist

Last audited: **October 14, 2026 (Asia/Manila)**. This pass started from
**07fa026 on main**; its backend changes are recorded in the task commits and
[October 14 evidence report](backend-readiness-2026-10-14.md). Historical October
6 and October 8 results below are preserved with their original scope and dates.
Overall status: **NOT PRODUCTION READY**. The staging database has migrations
001–018 and metadata/security checks; the API, worker and real-account journey
have not been deployed or verified.

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

October 14 work includes user-authorized staging schema changes and local backend verification. Historical team rows below retain their dated ownership/evidence and do not imply those teams are running now. No production changes or hosted load tests are authorized. The user reports Google OAuth is configured in staging; a real-account login remains unverified.

| Task ID | Owner/chat | Branch | Status | Last update | Blocker or next action |
| --- | --- | --- | --- | --- | --- |
| RET-01 defer retired upload purge | October 14 root + independent SQL and route reviews | main | DONE_LOCAL (deferred retirement only) | 2026-10-14 | User approved purge after signed URL expiry + 15 minutes. Migration 018 gates cleanup and fences older leases; document deletion hides the source immediately and leaves purge to the worker. Full local gateway suite: 869 passed, zero skips; Ruff 138, mypy 75 and mobile lint/186 tests pass. Staging migration `20261014015410` applied; function definitions/grants verified. The signed deadline is recorded just before provider signing (storage timeout 15s), with a 15m grace. Supabase generation-safe deletion, physical 72-hour purge, legacy inventory, scheduler and hosted Storage proof remain open. |
| WORK-02 local replay/recovery contract audit | October 14 root + WORK-02 gap audit | main | DONE_LOCAL (local contracts only) | 2026-10-14 | Migration 008 generation replay, 009 bounded orphan recovery, 010 folder replay, 007 atomic chunk publication and 002 atomic generation finalization are covered by current SQL/API/process tests. Mobile generation persists and reuses action keys. Unkeyed backend requests intentionally remain independent-create compatible. Full gateway suite: 868 passed, zero skips; native process/navigation and deployed worker/provider journeys remain open. Earlier “next local task” statements below describe their October 8 snapshot and are superseded. |
| AI-04 OpenRouter image request contract | October 14 root + OpenRouter contract audit; independent review | main | DONE_LOCAL | 2026-10-14 | Removed `quality` and `output_format`, which the live public endpoint metadata does not list for `google/gemini-3.1-flash-image`; use response `media_type` without a PNG fallback. Also fixed streamed JSON parsing to convert the `bytearray` to `bytes`. Provider tests: 33; full loopback PostgreSQL/PostgREST suite: 868 passed, zero skips; no-skip, Ruff 138, mypy 75 and diff check pass. No paid inference call. AI-04 remains PARTIAL for math-photo fallback policy and live provider behavior. |
| API-01 chat source identifier bound | October 14 root + API contract audit | main | DONE_LOCAL | 2026-10-14 | `ChatMessageCreate.document_id` is limited to 128 characters; both chat-send routes reject oversized IDs (2 parameterized API cases pass). Existing non-UUID identifiers remain accepted for compatibility. API-01 remains partial for native/hosted release journeys. |
| API-01 PRD/client contract reconciliation | October 14 root | main | DONE_LOCAL | 2026-10-14 | Refreshed the matrix against current routes/schemas/mobile callers, added `page_count` to the mobile status type, and fixed stale economy-router/folder-replay claims. Focused API/bounds tests (38) and mobile TypeScript pass. Native/hosted journeys remain open. |
| API-01 generated media bounds | October 14 root | main | DONE_LOCAL | 2026-10-14 | Enforced 15 MiB decoded image cap, PNG/JPEG/WebP validation, 16 MP ceiling, and bounded provider response streaming. 63 focused API/image/body-limit tests, Ruff, mypy 75 files, and diff check pass. Staging provider/native journeys remain open. |
| ECON-01 folder pricing activation | October 14 root + economy reviewer | main | PARTIAL | 2026-10-14 | User-approved pricing now runs through the atomic wallet RPC; migration 016 records charged creates and preserves existing offline replay/tombstone semantics. Full local suite: 832 passed, zero skips; Ruff 138/mypy 75 pass. Migration `20261014001721` is applied to staging and catalog-verified service-only. API is not deployed; wallet starts at 0 and no credit-earning path is approved, so paid folders remain inaccessible until an earning source is decided and deployed. Heart regeneration/refill remains pending. |
| ECON-01 correct-answer credit rewards | October 14 root + sync reward reviewer | main | DONE_LOCAL | 2026-10-14 | User approved +1 Momo Coin per newly accepted client-attested correct-answer event, requiring an owned study item. Migration 017 awards within sync transaction; duplicate IDs/non-correct outcomes do not pay. Mobile fetches/reconciles server balance on account load and sync, ignoring stale same-account reads. Some mobile spends/exchanges remain local-only and need full server reconciliation. Full gateway suite: 839 passed, zero skips; Ruff 138/mypy 75 and mobile lint/186 tests pass. Staging migration `20261014003950` applied; trigger catalog confirms fixed search_path and service_role-only execute. Client can still falsify correctness; hosted API journey is open. No historical backfill. |
| DOC-02 real OCR multi-page smoke | October 14 root + extraction/OCR audit | main | DONE_LOCAL | 2026-10-14 | Actual Tesseract/Poppler processed two raster-only synthetic pages in the non-root, network-isolated image; ordered page numbers, OCR flags and distinct recognized text passed. Representative scanned-document corpus and real-world OCR accuracy remain open. |
| CHAT-01 expired source guard | October 14 root + API-01 read-only audit | main | DONE_LOCAL | 2026-10-14 | `generate_study_card` now uses the existing READY-and-unexpired predicate. Focused tests prove expired READY sources skip retrieval/embedding and model generation. Other CHAT-01 provenance and native import gates remain open. |
| AUTH-02 account deletion | October 14 root + auth lifecycle audit + independent review | main | DONE_LOCAL | 2026-10-14 | `DELETE /api/me` deletes only the verified subject, treats Auth Admin `user_not_found` as a safe retry after a lost response, and the mobile clears that account's SQLite partition. Migration 015 assigns confirmed pre-ticket uploads to Supabase `documents`; staging application and local PostgreSQL cleanup-claim checks pass. Full hosted object purge and untracked-object inventory remain release blockers. |
| AUTH-02 profile provisioning | October 14 root + auth lifecycle audit + independent review | main | DONE_LOCAL | 2026-10-14 | Migration 014 installs a Google-only Auth profile trigger and safely backfills existing Google users; staging ledger/catalog verification passes. Local PostgreSQL verifies backfill, updates, provider exclusion, email collision and cascade. Managed GoTrue behavior and cross-account device proof remain. |
| SEC-02 math parser code execution boundary | October 14 root + security reviewers | main | DONE_LOCAL | 2026-10-14 | Hardened SymPy parsing with an allowlisted AST/restricted namespace, 2,000-character/256-node bounds, numeric exponent checks, 4,096-term expansion estimate, and factorial-call rejection; inverse-trig aliases remain supported. Tests reject Python execution syntax, attributes/subscripts/comprehensions, oversized/nested powers, factorial DoS, and symbolic expansion DoS. Full gateway suite: 854 passed, zero skips; no-skip gate, Ruff 138, mypy 75 and diff check pass. Removed raw solver exception, user topic/requirements and regex-pattern details from audited logs. Full SEC-02 audit remains open for provider/error logs, bundle/dependency scans and hosted HTTPS/CORS/data-lifecycle proof. |
| SEC-02 provider/worker log privacy audit | October 14 root + parallel reviewers | main | DONE_LOCAL | 2026-10-14 | Source review plus sentinel caplog tests cover OpenRouter image failures, document-worker provider failures and upload-cleanup storage failures; audited paths log exception class/static status and sanitized messages, not prompts, credentials, content, signed URLs or raw exception text. Full local gateway suite: 855 passed, zero skips/errors/failures; no-skip gate, Ruff 138, mypy 75, diff check pass. Local bundle exports were pattern-scanned; see readiness report. This does not close SEC-02: mobile dependency advisories, live HTTPS/CORS, account isolation and hosted retention/deletion remain release gates. |
| SEC-02 dependency and release artifact scan | October 14 root + parallel reviewers | main | PARTIAL | 2026-10-14 | Backend `uv audit --locked` and web `npm audit --audit-level=high` report zero known advisories; mobile retains 31 advisories (19 high, 12 moderate) in the Expo/RN graph, and automatic force fixes require a breaking major/downgrade, so none were applied. Expo dependency check, iOS/Android exports, web build and a 106-file known-pattern credential scan pass. No hosted URL, signed production build or device/store artifact was available. |
| SEC-02 final local audit | October 14 root + independent backend and mobile reviewers | main | DONE_LOCAL | 2026-10-14 | Reviewed backend/provider logs, mobile token storage and auth config, API runtime limits, release scans, chat model-tool boundary, web headers, and preview-chat proxy rate limits. Fixed unknown model tool names so raw values are not logged, returned, persisted, or replayed; added baseline landing-site CSP directives, HSTS, nosniff, referrer and framing headers. Chat/source suites: 83 passed; web typecheck, 25 tests, build and local HTTP header smoke passed; Ruff and diff checks pass. SEC-02 is still a public-release blocker: mobile has 31 advisories; no deployed header/proxy verification, Render HTTPS/CORS, two-account isolation, or hosted retention/deletion proof. Preview-chat rate limiting still requires a trusted host proxy and shared/edge limiter. |
| AI-02 A2-1 generated hint source support | October 14 root + backend audit; independent reviewer | main | DONE_LOCAL | 2026-10-14 | Optional hints are checked against the exact trusted chunk and omitted when unsupported; the otherwise-supported item remains. Regression tests cover supported, unsupported, and other-chunk-only hints. Focused grounding tests: 129 passed; full local gateway suite: 858 passed, zero skips; no-skip, Ruff 138, mypy 75 and diff check pass. AI-02 overall remains PARTIAL for labeled calibration and other evidence-support gaps. |
| RET-01 Supabase version-delete SDK audit | October 14 root + independent storage audit | main | DONE_LOCAL | 2026-10-14 | Current JS reference documents `{path, versionId}`, but locked Python storage3 2.31.0 only sends path strings; Supabase's S3 compatibility docs say bucket versioning is unsupported. The versioned wire behavior and selected bucket remain unverified, so cleanup stays fail-closed. Updated retention design; no hosted Storage calls. |
| AI-04 image provider managed configuration | October 14 root + AI/backend builder; independent reviewer | main | DONE_LOCAL | 2026-10-14 | Managed startup rejects blank/placeholder `OPENROUTER_IMAGE_MODEL`; the image provider rejects placeholder key/model before network. Six no-network provider cases and managed config matrices pass. Focused tests: 119; full loopback PostgreSQL/PostgREST suite: 867, zero skips; Ruff 138, mypy 75 and diff check pass. Math-photo fallback policy and live provider behavior remain open; AI-04 stays PARTIAL. |
| ENV-02 / AUTH-01 / AUTH-02 / OPS-01 | October 14 root + backend/database/review agents | main | PARTIAL | 2026-10-14 | Staging migrations 001–018 and forced-RLS/grant/bucket checks pass; local backend/mobile/container suites pass. Render Blueprint is prepared, not deployed. Next: user to share the Render HTTPS API URL after entering secrets/CORS; run bounded two-user Google/API/upload/worker smoke; finish profile/account lifecycle, operations and release gates. |
| RET-01 metadata/immutable-upload contract | October8 root + storage builder; independent reviewer | main | PARTIAL (prerequisites verified locally) | 2026-10-08 | Provider metadata/absence contract, first-write constraints and client upload headers;767 backend/181 mobile passed. Tickets/clock/orphan cleanup remain open. |
| RET-01 transactional lifecycle | October8 root + backend specialist + fixture specialist; independent reviewer | main | DONE_LOCAL lifecycle; RET-01 release PARTIAL | 2026-10-08 | Migration012/tickets, provider upload clock, registration/cleanup fences and deletion outbox.802 backend/181 mobile passed; provider deletion, legacy inventory and hosted timing/capacity remain gates. |
| RET-01 orphan lifecycle design | October8 root + backend specialist | main | PARTIAL (verified design gaps; implementation open) | 2026-10-08 | No durable signing record; registration resets72h clock. Provider timestamp/overwrite and race/rollout prerequisites documented. |
| OPS-02 local restore rehearsal | October 8 root; independent reviewer | main | PARTIAL (local synthetic restore verified) | 2026-10-08 | Restored persistent material/tenant security/expiry;730 backend tests. Managed recovery/RPO/RTO/app rollback unverified. |
| WORK-02 local SDK/gateway recovery | October 8 root; independent reviewer | main | PARTIAL (actual local transport verified) | 2026-10-08 | Real SDK/PostgREST13 process/security cases;729 full backend tests. SDK startup bug fixed; hosted services/providers/native gates open. |
| WORK-02 ingestion recovery | October 8 root; independent reviewer | main | PARTIAL (TXT crash boundaries verified locally) | 2026-10-08 | Four actual TXT pipeline kill/restart/source-deletion cases passed;722 backend tests. Local/managed PostgREST, semantic providers and hosted storage journeys open. |
| WORK-02 process recovery | October 8 root; independent review | main | PARTIAL (generation crash boundaries verified locally) | 2026-10-08 | Actual Python runner SIGKILL/restart before/after publication; unforced query plans;718 backend tests. Ingestion/full provider/PostgREST/deployed journeys open. |
| WORK-02 mobile generation intents | October 8 root + mobile builder; independent review | main | PARTIAL (client substeps verified locally) | 2026-10-08 | Durable intent/receipt, account-bound transport, serial polling/retry reconciliation; 178 mobile tests and real-JWT loopback replay passed. Native/process/hosted gates open. |
| WORK-02 / API-01 continuation | October 8 root + backend/database specialists | main | PARTIAL (server substeps verified locally) | 2026-10-08 | Generation request replay, bounded orphan recovery and folder replay; no economy activation or hosted changes. |
| WORK-02 / API-01 / AUTH-02 audit / OPS-01 prep | October 8 backend pass; root + backend/database specialists | main | PARTIAL (verified local substeps) | 2026-10-08 | Atomic index publication, READY-only retrieval, request bounds, auth regression coverage and OPS-01 deployment preparation. Hosted changes excluded by user. |
| API-01 | Team B; integration | main | PARTIAL | 2026-10-14 | Contract matrix + tests done; chat source IDs now have a 128-character bound. `POST /api/folders` uses the owner-scoped replay table and atomic PRD charge; native/hosted release journeys remain open. Credit earning is implemented locally and in staging schema; hosted API flow awaits Render URL/deployment. |
| ECON-01 | Team B (server), Team C (client); integration | main | PARTIAL | 2026-10-14 | PRD folder pricing and +1 coin per accepted client-attested correct sync answer are implemented and tested, including server-balance reconciliation. Correctness is not server-verified and can be farmed by a modified client. Heart regeneration/refill and XP table remain pending; hosted API and release journeys are open. |
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
| Upload/extraction / section 6.1 | PARTIAL; TXT crash recovery and container OCR DONE_LOCAL | Managed upload/OCR/storage/provider journeys and deployed recovery | DOC-01, DOC-02, WORK-02 |
| Retention / invariant 1 | PARTIAL; local scheduler/backlog alert exists | Orphan uploads, actual scheduled physical deletion and hosted timing proof | RET-01 |
| Embeddings/retrieval / section 6.2 | PARTIAL | Configured semantic model, relevance and dimension evaluation | AI-03 |
| Generation / section 6.2 | PARTIAL (2026-10-06: source-only DONE_LOCAL) | Calibrated evidence verification, real-model evaluation | AI-02, AI-04, FORMAT-01 |
| Tutor/card imports / section 6.3 | PARTIAL / PRD conflict | Non-source paths, rejected-item backfill and direct import validation | AI-01, CHAT-01 |
| Math/camera / section 6.4 | PARTIAL | Real OCR/vision, verified answers, fail-closed provider behavior | AI-04, MATH-01 |
| Images/diagrams / section 6.5 | PARTIAL | Hosted provider/rendering and factual-versus-creative labels | IMAGE-01 |
| Library/folders / section 6.6 | PARTIAL; atomic imports/offline mutations/server folder replay DONE_LOCAL | Trusted import provenance/expiry, two-device journey and approved credit policy | CHAT-01, SYNC-01, ECON-01 |
| Hearts/XP/coins/cosmetics / section 6.7 | PARTIAL / policy BLOCKED_INPUT (2026-10-06) | Five hearts aligned; server ledger exists; approved policy values and client wiring | ECON-01 |
| Offline sets/sessions / invariant 5 | DONE_LOCAL (2026-10-06) | Native release-build kill/airplane-mode journeys | OFF-01, OFF-02, QA-01 |
| Offline sync / section 8.5 | Backend/client substeps DONE_LOCAL; release PARTIAL | Real two-device/account/reconnect journeys with hosted ownership | SYNC-01, API-01, QA-01 |
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

**Next RET-01 gate: prove hosted timing and inventory for eventual retirement purge,
then qualify a generation-safe deletion contract for ordinary 72-hour expiry.**
Migrations 012 and 018 implement signing tickets, actual upload clocks,
registration/cleanup fencing and deletion/account outboxes. Supabase retired
tickets use delayed path deletion with a retained 15-minute retry tombstone;
ordinary expiry stays fail-closed. S3 requires versioning and bounded version
inventory. Unknown legacy origins require explicit verification.
WORK-02 generation/TXT crash recovery through actual local SDK/PostgREST is verified
for selected boundaries; managed storage/provider/native/deployed gates remain open.

**Hosted application setup remains ENV-01/ENV-02/AUTH-01/OPS-01.** The user
authorized database work only on `momo-staging` and selected Render for host
preparation. Migrations 001–016 and database metadata/security checks now pass
there; no API, worker, Google-account, Storage-byte or provider smoke was run.
`momo-prod` was not queried or changed. The Render Blueprint is prepared but not
deployed; CORS origins and host-managed secrets still need to be entered. The
historical waves remain dependency guidance.

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
- Evidence 2026-10-06 (local only): deterministic chunk-support checks (answer/explanation coverage, polarity, MCQ exactly 4 options) in place; thresholds are provisional. Open: relation-blind short answers (A-5), reviewer over-rejection (A-6), and labeled TypeSafe/Jev calibration.
- Evidence 2026-10-14 (local only): A2-1 no longer persists optional model hints unless deterministic support and polarity checks pass against the exact trusted chunk. Unsupported or other-chunk-only hints are dropped without discarding the supported study item. Focused tests (129) and the PostgreSQL/PostgREST suite (858, zero skips) pass; Ruff 138, mypy 75 and diff check pass. This does not replace semantic calibration or close AI-02.

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
- Evidence 2026-10-14 (local only): managed startup rejects a blank/placeholder `OPENROUTER_IMAGE_MODEL`; the OpenRouter image request boundary rejects placeholder key/model before opening a network client. Six no-network provider cases and managed-config parametrizations pass; focused suite 119 passed. Full loopback PostgreSQL/PostgREST suite: 867 passed, zero skips/errors/failures; no-skip checker, Ruff 138, mypy 75 and diff check pass. No live provider call. Math-photo fallback policy and broader model contract remain open.
- Evidence 2026-10-14 follow-up (local only): the public model endpoint lists `resolution`, `aspect_ratio`, `n`, and `input_references` for Gemini 3.1 Flash Image, not `quality` or `output_format`; the request now sends only supported selected fields and uses the returned MIME type without assuming PNG. The streaming response parser now converts its byte buffer to `bytes` before JSON parsing. Provider tests: 33; full local loopback PostgreSQL/PostgREST suite: 868 passed with zero skips/errors/failures; no-skip gate, Ruff 138, mypy 75 and diff check pass. No paid inference call. This does not close AI-04 provider behavior or math-photo policy.

### ENV-01: Select And Configure The New Momo Environments

- [ ] **PARTIAL; release blocker. Owner: infrastructure.** Staging Supabase and Render are selected; staging Google OAuth is reported configured. Actual redirect/native validation, Render secret injection, staging/prod public keys, allowed HTTPS origins and production separation still require completion.
- Scope: dedicated development/staging/production configuration, server secrets and public client configuration.
- Acceptance: record intended project refs and environment ownership without secret values; configure service credentials, JWT issuer/audience and allowed origins; production disables development identity/memory. Define secret injection/rotation and separation of staging from production. Existing unrelated Supabase projects remain untouched.
- Evidence: configuration/startup smoke report with redacted configuration categories. MCP connection by itself does not configure `.env` or deploy anything.
- Evidence 2026-10-06 (local only): `APP_ENV` required; staging/production refs pinned (`zkouryrzhsgaeqyiwwyb` / `liyuyfqkbknxorzoekkq`), cross-pointing refused at startup; local/test loopback-only so tests cause zero Supabase egress; managed envs reject memory/dev auth/inline jobs/mock providers/placeholder secrets. 84 environment-isolation tests.

### ENV-02: Apply And Verify Hosted Database Contracts

- [ ] **PARTIAL; release blocker. Owner: database (root via Supabase MCP). Dependencies: ENV-01.** Staging migrations and metadata checks pass; the managed API/account authorization smoke and rollback exercise remain open.
- Scope: migrations 001/002 through Supabase MCP; RLS/grants/RPCs/storage settings.
- Acceptance: audit any existing records, apply ordered migrations to the chosen environment, check advisors, verify two real users and anon cannot access/mutate foreign data, and verify service-only RPCs through managed PostgREST. Confirm metadata-only queries and migration rollback strategy.
- Evidence: migration IDs, sanitized advisor findings/remediations, bounded synthetic smoke report and cleanup. No hosted stress/load tests or original-document downloads for general diagnostics.
- Evidence 2026-10-06 (local only): ordered bundle 001-006 with hashes, advisors, metadata-only verification and a two-user synthetic smoke + cleanup prepared in the [staging rollout plan](../.agents/tasks/momo-readiness-2026-10-06/staging-rollout-plan.md).
- Evidence 2026-10-14 (staging schema only): user-authorized migrations 005–016 applied to `momo-staging`; ledger now records 001–016. All 20 public/internal app tables have forced RLS; anon has no app-table SELECT; authenticated direct writes and client grants on internal tables are absent. The `documents` bucket is private with a 15 MiB limit and the four expected MIME types. The Google profile trigger, legacy cleanup index, and migration 016 service-only folder charge RPCs are catalog-verified; no legacy rows needed mapping. Security advisor reports five INFO no-policy notices on internal tables (intentional deny-by-default); performance advisor reports 14 composite-FK notices and 44 unused-index notices on a fresh empty staging workload. Core app tables and new request/ticket queues contained zero rows. Migration 008's DDL was catalog-verified after a migration-ledger timestamp collision and then recorded via a no-op ledger reconciliation. No managed PostgREST two-user smoke, OAuth login, API/worker deployment or storage-byte inventory was performed; `momo-prod` untouched. See [October 14 evidence](backend-readiness-2026-10-14.md) and the private [staging rollout record](../.agents/tasks/momo-readiness-2026-10-06/staging-rollout-plan.md).

### AUTH-01: Implement Real Supabase Google Sessions On Mobile

- [ ] **PARTIAL; release blocker. Owner: mobile/auth.** User reports staging Google OAuth configured; actual login journey, redirect behavior and native device proof remain unverified.
- Scope: auth/session service, secure token persistence, deep links, routing and API client.
- Acceptance: Google login/cancel/error, token refresh, expired session, logout, cold start and guest preview work; remove default dummy identity from hosted builds. Server identity always comes from verified tokens. Public client configuration contains no elevated key.
- Evidence: unit tests and staging iOS/Android auth journeys including redirect failures, revoked/expired tokens and restart. Backend now accepts signed Google Supabase identities only; it does not recheck Google on each API request, per the selected sign-in verification + Supabase JWT policy.
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
- Evidence 2026-10-14 (local only): actual Tesseract/Poppler OCR ran on a two-page raster-only synthetic PDF inside the non-root backend image with networking disabled. Both ordered page numbers, `is_ocr` flags and distinct text assertions passed. This is a runtime smoke, not a representative OCR quality corpus.

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
- Evidence 2026-10-08 (local only): migration012 persists issued tickets, atomic actual-upload+72h registration/quota, fenced cleanup and source/account outboxes;802 backend/181 mobile tests pass with no skips. Automatic mocks/S3version deletion are generation-safe; hosted Supabase automatic deletion fails closed. Legacy/unregistered inventory, selected-provider rollout, capacity/index measurements and hosted timing remain open. See [retention rollout](UPLOAD_RETENTION_DESIGN.md) and [report](backend-readiness-2026-10-08.md).
- Evidence 2026-10-14 (local + staging schema): migration018 waits until `signed_until + 15 minutes` before retired user/account-deletion tickets can be claimed, revokes any earlier lease, and rechecks the deadline when preparing a purge. The worker uses path deletion for retired ticket paths and retains a 15-minute retry tombstone; a new regression test verifies repeated path deletion and no metadata-generation delete (cleanup-worker suite: 5 passed). Generated sets remain detached by the existing FK. This is eventual cleanup: Supabase provides no documented maximum for an upload already in flight at token expiry, and `signed_until` is captured before signing returns. Full local PostgreSQL/PostgREST suite: 869 passed, zero skips; Ruff 138, mypy 75, mobile lint/186 tests pass. Staging migration `20261014015410` and function/privilege catalog checks pass. Ordinary 72-hour Supabase expiry still fails closed because Python `storage3` has no generation-conditional delete. Legacy/unregistered inventory, actual purge timing, scheduler capacity and hosted Storage proof remain open.
- Evidence 2026-10-06 (local only): worker schedules cleanup every 900 s (batch 100) plus `RETENTION_OVERDUE` alert; e2e proves expiry keeps generated sets in memory and PG paths. Historical gaps: unregistered orphan uploads, hosted deletion proof, measured timing. Migration012 now covers issued orphans locally; provider/runtime gates remain.

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

- [ ] **PARTIAL; release blocker. Folder replay is implemented server-side and the mobile sends a stable key; a two-device journey remains.**
- Scope: sync engine, mutation queue, session references and API acknowledgments.
- Acceptance: stable UUID events survive restart; flush batches of at most 100; remove only exactly acknowledged events. Persist retry state, handle transient failures without silent discard, and resolve authorization/conflicts explicitly. Make folder creation and other offline mutations idempotent, not only answer events; preserve dependencies/client-to-server IDs.
- Evidence: 101+ queued events, lost response/replay, reconnect/app kill, mixed invalid/valid references, two accounts/devices and duplicate folder-create tests. Backend atomic sync is already delivered.
- Evidence 2026-10-06 (local only): client batches <=100, exact acknowledgments, durable held queue + attention sheet, persisted backoff. Integration fix: hosted `process_sync_batch` rejections now map to the per-event codes the client isolates (42501 -> 404 `STUDY_ITEM_NOT_FOUND`, 22023 -> 422 `VALIDATION_ERROR`). E2E: 101 events in 100+1 batches, replay ignored, >100 rejected, foreign reference 404 (memory and PG).
- Evidence 2026-10-14 (local/staging schema only): folder requests use owner-scoped replay and an atomic charge RPC; the mobile persists and sends a mutation key. Migration 016 is applied to staging. No hosted API or two-device journey has run.

### API-01: Reconcile PRD, Clients And REST Contracts

- [ ] **PARTIAL; release blocker. Owner: API/docs/mobile. Dependencies: none for contract audit.**
- Scope: OpenAPI, PRD sections 8.1-8.10, client methods, schemas and routes.
- Acceptance: explicitly resolve sync/events versus sync, missing advertised study-set creation/full-detail behavior, upload field names, UUID paths and response fields. Preserve existing clients with documented compatibility where needed. Apply bounds to body/text/image inputs and consistent safe errors; never silently edit requirements to match prototypes.
- Evidence: contract matrix, OpenAPI/API/client contract tests and approved documentation updates.
- Evidence 2026-10-14 (local only): [contract matrix](API_CONTRACT_MATRIX.md) reconciles current PRD routes with FastAPI schemas and mobile callers. `GET /api/documents/{id}/status` returns `page_count` and the mobile type now includes it; economy router is registered. Image/text fields and request/response sizes have documented bounds. Recorded deviations: `/api/me` exposes `id` (the verified subject); oversized `upload-url` returns 422 `VALIDATION_ERROR` from the schema bound instead of `DOCUMENT_TOO_LARGE`. API-01 remains partial for native/hosted journeys.

### CHAT-01: Grounded Atomic Chat Decks And Imports

- [ ] **PARTIAL; release blocker. Owner: tutor/backend. Dependencies: AI-01, AI-02, API-01.**
- Scope: chat tools, card import route and study repository append/count operations.
- Acceptance: imports cannot accept unvalidated arbitrary factual cards; server verifies owned provenance and allowed types. Save deck/items atomically and append imported cards without overwriting old local items or drifting counts. Use retry-safe identifiers; citation/tool arguments never grant cross-user access.
- Evidence: duplicate import/lost response, multiple imports, bad citation, foreign source, tool injection, rejected items and rollback tests. Do not claim generation-job finalizer covers this separate path.
- Evidence 2026-10-06 (local only): atomic deck RPC with deterministic set id (12 concurrent PG calls -> one set). Open: server-issued reference for importing model-generated cards. The A2-2 expiry gap was fixed locally on 2026-10-14: `generate_study_card` now rejects expired or malformed-expiry READY sources before retrieval; 3 parameterized regression tests passed with no retrieval or provider call.

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

- [ ] **PARTIAL / BLOCKED_INPUT; release blocker.** PRD folder pricing is approved and implemented (see October 14 activation row above). Remaining decisions: heart regeneration interval, refill price, XP table, credits vs Momo Coins naming and earning, and reward paths from sync.
- Scope: CreditsContext, study rewards, folder costs, shop grants and server ledger.
- Acceptance: reconcile fifteen local hearts with PRD five; enforce documented regeneration, rewards, conversion and folder credit costs server-side. Folder charge activation and durable replay are locally tested and migration 016 is applied to staging. Idempotent transactions prevent double rewards/spend and concurrent overdrafts; account-scoped balances survive restart/device switch. Preserve honest preview labels until grants are implemented. Do not invent real-money checkout unless approved requirements add it.
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
- Evidence 2026-10-14 (local only): user-approved output contract is ≤15 MiB decoded, PNG/JPEG/WebP, ≤16 MP. Both renderer/provider results are base64/MIME/signature/dimension checked; OpenRouter body streaming is capped before JSON parse. 63 focused image/API/request-bound tests pass. Live provider, staging and native viewer journeys remain open.

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

- [ ] **PARTIAL; release blocker. Owner: infrastructure/backend. Dependencies: ENV-02, WORK-01, SEC-01, CI-01.** Render configuration and local container probes are prepared; no hosted services are deployed.
- Scope: API/worker/scheduler deployment, HTTPS/domain, configuration and monitoring.
- Acceptance: reproducible release artifacts, dependency-aware readiness separate from liveness, bounded probes and structured privacy-safe correlation logs. Alert on failed/stale jobs, quota violations, AI spend, cleanup backlog and sync errors; define incident/runbooks and capacity objectives. Existing health endpoint alone does not prove DB/worker readiness.
- Evidence: staging rollout and dependency-failure/drain tests, dashboards/alert exercise and documented latency/error/cost targets. Use local synthetic load for capacity experiments.
- Evidence 2026-10-14 (local preparation): Render Blueprint defines Singapore staging API and separate worker, secrets as platform variables, `/ready`, disabled auto-deploy, and 60-second shutdown. The built non-root image passed SDK fail-closed, scanned-PDF OCR and `PORT`/health/readiness/graceful-stop smoke. No Render service was created; origin, secrets, provider/model configuration, monitoring, capacity and hosted worker behavior remain open.

### OPS-02: Backups, Restore And Rollback

- [ ] **PARTIAL (local restore only); release blocker. Owner: database/infrastructure. Dependencies: ENV-02, OPS-01.**
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

## October 8 local backend pass

[Evidence report](backend-readiness-2026-10-08.md): 678 backend tests passed with zero
skips, Ruff and mypy over 74 files clean; container API and real scanned-PDF OCR smoke
passed locally. WORK-02 now publishes complete chunks and READY state atomically
through migration 007, rejects foreign/expired publication, and preserves first
successful indexes. Retrieval requires READY/unexpired sources. API-01 adds 10 MiB
whole-body limits and schema bounds. Asymmetric JWT regression tests and a bounded
`/ready` database probe plus non-root image support AUTH/OPS preparation.

WORK-02/API-01/AUTH-02/OPS-01 remain PARTIAL: generation enqueue retry identity,
orphan recovery caps, folder replay, profile/account lifecycle, hosted auth,
worker deployment and monitoring remain open. Migration 007 is local only. No
hosted gates or release decision closed. Next eligible local task WORK-02
(generation retry identity and orphan recovery), then API-01 folder replay.
Obsidian: [linked readiness map](knowledge/Momo%20Public%20Readiness.md).

### October 8 continuation evidence

WORK-02/API-01: migrations 008–011 add owner-scoped generation/folder request replay,
a durable explicit-retry dispatch marker and automatic recovery lifetime budgets.
Folder deletion tombstones prevent stale offline recreation. Reconciliation locks
queue before subject, skips active jobs before the batch cap, and cannot reset its
lifetime counter without an explicit manual retry. Whole local backend suite: 703
passed, zero skipped (32 existing Starlette deprecation warnings); Ruff and mypy over 74
files passed. [Contracts](API_CONTRACT_MATRIX.md) and [report](backend-readiness-2026-10-08.md).

WORK-02 remains PARTIAL: mobile generation must persist/send keys across retries,
and deployed process-crash journeys remain unverified. API-01 folder replay server
substep is DONE_LOCAL; SYNC-01 still needs two-device staging proof. No economy
activation, hosted migration or production traffic. Next eligible local task is
WORK-02 mobile request intent persistence and replay adoption. Other release gates
remain unchanged and open.

Final continuation verification (October 8 local only): 713 backend tests passed with
zero skips/errors/failures; Ruff and mypy over 74 files clean. Migration 011 consumes
retry authorization and resets queue state transactionally, rejects stale/missing
subjects, and removes tentative queued work on rejection. Independent review has
no remaining actionable findings for this pass. Final container/OCR smoke and
credential-pattern scan passed. Earlier 678/703 results above are historical
substeps. Obsidian map: 6 notes/8 valid links between canvas nodes, all wikilinks
resolve. WORK-02 client key adoption and native/process/hosted verification remain
open; no release gate was closed by these local counts.

## October 8 mobile generation intent continuation (local only)

WORK-02 client substeps: save account-owned action key/settings before POST; persist
received job before navigation; restore pending draft or received job on reopen;
acknowledge only after an owned status GET. Account epoch and route guards prevent
late results from updating another account/source. Transport uses one deadline
across refresh/fetch/JSON/401, preserves headers and forbids mutation port fallback.
Polling is serial; uncertain explicit retry delivery resumes status reads without
repeating POST. Corrupt intents fail closed; offline drafts send no AI request.

Verification: `npm test --prefix mobile` **178 passed**, zero skips/failures;
`npm run lint --prefix mobile` (repository TypeScript) passed. Local real-JWT
FastAPI/file-SQLite replay smoke: **8 invariant groups, 4 generation POSTs**; lost
response/reopen reuses same key/job, received receipt avoids another POST, owned
acknowledgment permits new intentional work, verified second owner gets404.
Harness configuration/tokens and fixtures were removed; no hosted/provider traffic.
See [report](backend-readiness-2026-10-08.md) and [harness instructions](../scripts/testing/README.md).
WORK-02 stays PARTIAL: native Expo SQLite/navigation and deployed worker process
kill/restart journeys remain unverified. Hosted setup/auth/storage/operations and
public release gates remain open under the user's local-only scope.

## October 8 Python worker recovery and query-plan continuation

WORK-02 local proof now kills the actual Python JobRunner after a durable claim and
after atomic generation publication before queue acknowledgment. Restart reclaims
the expired lease (test clock advanced in disposable SQL), completes attempts2,
retains one set/item and skips the generation processor for already-completed jobs.
Foreign-user denial and source-deletion retention are verified. Actual queue,
handler and GenerationRepository are used; psql replaces PostgREST and deterministic
content replaces the model. This does not prove complete provider/OCR/ingestion or
deployed gateway/process operation. Next local WORK-02 step is document-ingestion
process recovery.

Schema access evidence:20 synthetic tenants,4,000 sets,20,000 items,20,000 chunks;
ANALYZE +unforced EXPLAIN ANALYZE/BUFFERS for exact repository library/items/chunks
shapes uses existing owner/order indexes. Sample rows50/5/100, shared blocks3/10/102
and execution0.021/0.053/0.163ms. These are one local sample, not capacity targets.
No speculative index/migration was added.

Final:718 backend tests passed in41.61s, zero skipped/errors/failures
(`/tmp/momo-oct08-process-final.xml`, no-skip verifier passed);32 existing Starlette
deprecation warnings. Ruff whole backend and mypy74 app files passed. Tests now
pin local provider choices and override stale dotenv ENVIRONMENT with an empty
derivable value;84 environment-isolation tests pass without weakening production
configuration validation. Atomic-index rows received a typing annotation only.
Independent review query-shape finding fixed; no remaining actionable findings in
the reviewed scope. Dedicated Docker PG stack removed; no hosted/provider traffic.

## October 8 actual TXT ingestion crash recovery

WORK-02 now has four more actual Python subprocess cases: SIGKILL before atomic
index publication or after publication before queue acknowledgment, each with source
present or deleted before restart. Actual DocumentWorker validates bytes, persists
SHA256, extracts TXT, chunks, computes local embeddings and invokes the atomic
publisher. Only private-object transport (task-owned file) and PostgREST transport
(psql adapter) are replaced. An old partial index is replaced without duplicate
chunk positions; READY sources skip storage/extraction and keep chunk IDs even when
fixture bytes are removed. Deleted sources remain absent, queue succeeds without
storage reread, and foreign-owner chunk reads are denied. This proves selected TXT
process boundaries; OCR/formats, semantic providers, real storage and PostgREST/SDK
recovery remain separate gates.

Focused six process cases passed; full backend **722 passed in43.43s**, zero
skips/errors/failures,32 existing Starlette warnings. JUnit
`/tmp/momo-oct08-ingestion-final.xml`; no-skip verifier passed. Ruff backend and
mypy74 app files passed. Independent review: no actionable findings in the new
fixture/test scope. Disposable PG container/network removed. Next safe local
WORK-02 verification is actual SDK/local PostgREST transport; managed environments
remain excluded by the user's local-only scope. No production code change was
required in this continuation.

## October 8 actual Supabase SDK/PostgREST continuation

Local gateway overlay now runs pinned PostgREST12.2.3/nginx1.27.5 with synthetic
JWTs, loopback ports and an internal gateway network. Worker child processes allow
only the exact selected loopback socket. Six recovery cases run through both psql
and the actual SupabaseSession/SDK/HTTP gateway. One additional signed-user gateway
case proves owner reads, foreign denial, anonymous denial, authenticated write and
service-RPC denial, and invalid-signature rejection. The auth.uid fixture now
supports PostgREST JSON claims alongside direct psql test claims.

The real SDK exposed a production startup defect: generic ClientOptions lacks
the synchronous client's required storage/httpx attributes in the locked version.
Server session now uses SyncClientOptions; auto refresh/session persistence stay
disabled. Actual gateway recovery and rebuilt image construction exercise the fix.
CI source starts/stops the isolated gateway and requires PG/gateway integration
with zero skips; no GitHub run/push occurred.

Final:729 passed in51.83s, zero skips/errors/failures,32 existing Starlette warnings;
`/tmp/momo-oct08-gateway-final.xml` plus no-skip verifier. Ruff backend/helper and
mypy74 passed. New image `momo-backend:oct08-gateway`, manifest list
`sha256:d237059bd68ca1655d3e6c98aaa97a391a31c463a46d242d5e869261815c80f0`,
passed non-root/network-isolated real SDK construction/fail-closed database denial
and actual scanned-PDF OCR. Independent review found no actionable defects in
session/gateway/CI/recovery scope. All stack containers/networks removed.

WORK-02 remains PARTIAL for managed services/providers/full native/deployed journeys.
This removes the psql transport substitution gap locally; it does not close ENV-02
or hosted Supabase Auth/Storage. Remaining safe local preparation includes RET-01
orphan-upload lifecycle design and OPS-02 isolated restore/rollback rehearsal;
dependency/hosting/product inputs remain explicit before dependent release work.

## October8 local database recovery preparation

OPS-02 local-only rehearsal: custom-format pg_dump/pg_restore into an exclusively
created random target in the disposable cluster. Restored sets/items, completed
finalization replay, owner/foreign/anonymous reads, denied client writes, service-only
grants and forced RLS pass. Expired timestamps remain unchanged; deleting restored
source metadata preserves items and does not affect the source DB. Archive is
created0600 and target/archive cleanup runs in finally. No original object bytes
are backed up by this drill. Source-derived text/account metadata backup policy
requires explicit decisions. Roles/extensions share the disposable cluster.

Full **730 passed in50.62s**, zero skips/errors/failures,32 existing warnings;
`/tmp/momo-oct08-restore-final.xml` no-skip verifier passed. Ruff and mypy74 passed.
Independent review found no actionable test defects. No production code change in
this continuation. Disposable stack/target/archive removed. Added
[recovery runbook](DATABASE_RECOVERY_RUNBOOK.md) and Obsidian recovery node (7nodes,
11edges). Managed backups/new-cluster recovery, approved RPO/RTO/access/retention,
app-worker rollback and ENV-02/OPS-01 dependencies remain unverified. Remaining safe
local preparation includes RET-01 orphan-upload lifecycle; hosted setup requires
separate inputs/approval.

## October8 upload/orphan lifecycle discovery

Source audit verifies unregistered signed objects have no durable cleanup record;
cleanup scans only existing documents. Registration RPC ignores input upload time
and resets72h at registration, extending retention when registration is delayed.
A ticket-issued+72h shortcut would instead shorten retention and conflicts with
PRD uploaded_at+72h. Storage currently exposes size only; S3 PUT overwrite and
actual metadata/identity semantics must be settled in implementation.

[Upload retention design](UPLOAD_RETENTION_DESIGN.md) defines durable signing
tickets, observed object age/identity, transactional registration/quota, bounded
cleanup leases, source/account-deletion responsibility, legacy inventory and
strict-rollout contract. Backend specialist independently reviewed these gaps
and prerequisites. No new provider policy, schema or deletion was applied.
RET-01 stays PARTIAL. Next local implementation starts with verified provider
metadata/immutable-upload contract, then the complete transactional ticket slice;
managed inventory/scheduling/physical deletion remain separate approval gates.
Existing730 backend test evidence is unchanged, not a new verification of this
proposed design.

## October8 storage metadata/immutable-upload prerequisites

Validated object metadata now exposes aware UTC upload time and optional identity/
version/etag; missing/malformed/naive/implausibly future timestamps fail closed.
Confirmed missing objects are distinguished from bucket/config/403/timeout failures
using structured provider errors only. S3 URLs sign If-None-Match:*; Supabase signing
explicitly disallows upsert. Mocks capture initial time atomically and reject overwrite.
API returns upload_headers; native/web helpers validate/forward only known constraints,
keep session tokens off provider URLs, authenticate canonical relative mock API paths,
and stop registration on failed PUT. Raw provider errors/URLs are not logged/displayed.
Local mock PUTs alone allow bounded15MiB bodies; other requests retain10MiB.

Final **767 backend passed in51.47s**, zero skips/errors/failures,32 existing warnings;
`/tmp/momo-oct08-storage-final.xml` no-skip verifier passed. **181 mobile tests** and
TypeScript passed; Ruff/backend and mypy74 passed.56 focused storage cases and API
size/ownership/overwrite regressions passed. Independent review cap mismatch fixed;
no remaining actionable findings in reviewed changes. SDK mock transports and actual
locked botocore signing prove contract code, not hosted object behavior.

Image `momo-backend:oct08-storage`, manifest list
`sha256:f6f1edacfc8bd58d234d5c769c98187b7590e08ff459ef404ff8cf96c410183e`,
passed non-root/network-isolated SDK fail-closed and scanned-PDF OCR smoke.
Disposable stack removed. **Registration still resets the72h clock; durable tickets
and orphan cleanup are not implemented by these prerequisites.** RET-01 remains
PARTIAL; next coherent slice is the reviewed transactional ticket lifecycle.

## October 14 backend, auth, database and Render preparation

Claimed ENV-02/AUTH-01/AUTH-02/OPS-01. User authorized resuming and using the
pinned `momo-staging` project, reports its Google OAuth provider configured, and
selected Render. No production operation was performed.

Staging was `ACTIVE_HEALTHY` on Supabase PostgreSQL 17, Singapore. Migrations
005–016 were applied after confirming the existing 001–004 ledger. The ordered
ledger now contains 001–016. Migrations 014/015 install the Google profile
trigger and confirmed Supabase legacy-storage destination/index; catalog checks
found both objects and zero legacy tickets to map. Migration 016 activates the
approved folder charge and replay transaction. Migration 008's DDL had completed before a generated
ledger timestamp collision; its objects were inspected, then the migration was
recorded through a no-op reconciliation rather than replaying the DDL. Catalog
checks report 20 public/internal app tables with forced RLS; no anonymous SELECT,
authenticated direct writes or internal client grants; private `documents`
bucket with 15 MiB and PDF/DOCX/TXT/PPTX MIME restrictions; and zero rows in the
core app, generation, sync, upload-ticket and request-queue tables.

Migration 013 adds three owner/auth-reference B-tree indexes for Auth account
deletion and ticket retirement. Unforced local `EXPLAIN ANALYZE` chose each index
for its intended 1,000-row synthetic owner lookup. The staging advisor now reports
14 composite-FK coverage notices; catalog review found a valid index whose leading
column matches the first FK field for each. It also reports 44 unused-index
notices on the fresh staging workload, which is insufficient evidence to remove
them. Five security INFO notices identify internal tables with RLS and no
policies; those tables are also inaccessible to anon/authenticated by grants.
See the [staging rollout record](../.agents/tasks/momo-readiness-2026-10-06/staging-rollout-plan.md).

Backend auth verifies the Supabase JWT signature, pinned issuer/audience, expiry,
authenticated role and UUID subject, then accepts only signed Google OAuth
identities. It does not call Supabase Auth on every API request, matching the
selected sign-in verification + Supabase JWT policy. Tests cover non-Google,
anonymous, password and unsupported-auth-method rejection. This does not verify
a real Google account or revoke an already-issued Supabase session immediately
if Google later disables that account.

Latest full local regression after ECON-01 sync rewards: backend **839
passed, zero skipped/errors/failures** on loopback PostgreSQL/PostgREST; the no-skip
gate passed, Ruff 138 files and mypy 75 source files passed, and mobile lint plus
**186 tests** passed. Render preparation defines a Singapore API and separate database-backed worker,
with staged secrets injected by Render, `/ready`, disabled auto-deploy and 60-second
shutdown. Local verification: backend **819 passed, zero skipped** (real local PG
and gateway required), Ruff 138 files, mypy 75 source files, mobile lint plus
**181 tests**, non-root SDK fail-closed and scanned-PDF OCR container smokes, and
`PORT`/`/health`/`/ready`/SIGTERM smoke. Render services were not created. The
configuration still needs the real HTTPS CORS origin, secret values and chosen
instance size; no provider traffic was sent.

Release gates remain open: real Google login and native journeys; managed
PostgREST two-user/anonymous/RPC smoke; Render deploy and API/worker drain/alerts;
Supabase Storage physical deletion is not generation-safe and legacy/unregistered
object inventory is incomplete; actual model/embedding availability and grounded
generation have not been proven; profile lifecycle/account deletion, economy
policy, clean remote CI, managed restore/RPO/RTO, device QA, privacy/support/store
setup and production rollout remain. The result is **not production ready**.
See [dated backend report](backend-readiness-2026-10-14.md) and the linked
[[Momo Backend Completion 2026-10-14]] Obsidian note.

### AUTH-02 profile and account deletion follow-up

Migration 014 now provisions `public.users` from verified Google Auth rows, with
display-only sanitized name/avatar metadata. It installs the trigger before the
existing-user backfill so Auth writes serialize through migration commit; email
collisions never associate a second Auth ID. Local-only PostgreSQL tests cover
pre-existing-account backfill, profile update, non-Google/email-less exclusion,
collision handling, and Auth deletion cascade. The trigger fixture simulates
`supabase_auth_admin`; managed GoTrue execution remains unverified. This does
not finish AUTH-02: managed Auth behavior, physical object deletion,
untracked-object inventory, and logout/account-switch device proof remain release
gates. Migrations 014/015 are applied to staging, but managed Auth behavior and
physical Storage deletion remain unverified.
Verification 2026-10-14: final integrated backend/API/PostgreSQL/PostgREST run
had 830 passed with zero skips/errors/failures, Ruff 138 files, mypy 75 source
files, no-skip check, mobile type/lint and 182 tests, Canvas JSON validation,
and `git diff --check`.
