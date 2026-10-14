# Momo backend readiness — October 14, 2026

**Status: not ready for public launch.** This pass completed local backend hardening and deployment preparation, then applied and inspected the ordered schema on the user-selected `momo-staging` Supabase project, including migration 019 for an additive 2048-dimensional embedding index. It did not deploy the API or worker, run real Google sign-in, upload hosted bytes, call an AI provider, query production data, or run hosted load tests.

## Decisions and boundaries

- Login is Google OAuth only. The user selected verification by Supabase Auth at sign-in followed by signed Supabase JWT validation on each API request; no live Google/Auth lookup is made for every request.
- The user selected `momo-staging`, authorized resuming it and the staging migrations, reported Google OAuth configured there, and selected Render for hosting preparation.
- Hosting target is Render. The Blueprint is prepared, but no service was created or deployed. Production and public release remain outside this pass.
- `docs/knowledge/` is the configured Obsidian vault. Its overview and canvas now link to the dated completion note.

## By task and module

| Task/module | Delivered | Still open |
| --- | --- | --- |
| AI-02 grounding | Short flashcard/QA/glossary answers now require same-sentence lexical support and explicit newline-labeled Q&A remains supported. Focused grounding/source-safety/format suites: 198 passed. | This is a limited lexical guard. Review reproduced same-sentence relation false accepts and the existing MCQ/identification compatibility path remains; labeled TypeSafe evaluation is still required. |
| AI-03 embeddings | User approved `nvidia/nemotron-3-embed-1b:free` at 2048 dimensions. Migration 019 adds nullable `embedding_v2`, version marker, and service-only v2 publish/reindex/finalize/search RPCs; old 1536 vectors and RPCs remain available. New API code uses v2. | Staging migration applied with no documents/chunks. No live provider or relevance/latency test. The v2 RPC uses exact scan without ANN; pgvector 0.8 supports ANN for halfvec up to 4000 dimensions, but conversion/indexing is pending a representative quality and latency decision. Before deploy to any populated project, preflight READY/unexpired v1 rows and reindex them; no production inventory or reindex was run. Rollback to old API after new v2 writes requires reindexing those new documents to an available v1-compatible model. |
| DOC-02 / CI-01 OCR runtime | `.github/workflows/ci.yml` now builds the production backend image and runs `container_ocr_smoke.py` as non-root with networking disabled and a read-only filesystem/tmpfs. | Local Docker build and exact runtime smoke pass; Ruby YAML parsing passes. A clean remote Actions run still needs a push; this is runtime coverage, not representative OCR accuracy evidence. |
| AUTH-01 backend identity | `backend/app/dependencies.py` validates the Supabase token signature, algorithm, pinned issuer/audience, expiry, role and UUID subject, then requires signed Google provider and OAuth method claims. Password, anonymous, non-Google and unsupported methods are rejected. | Google OAuth is reported configured, but an actual staging sign-in, refresh/revocation and native redirect journey were not run. Disabling a Google account after token issuance does not trigger an immediate per-request Google recheck; the chosen policy relies on Supabase JWT expiry/revocation. |
| ENV-02 schema and security | Staging now records migrations 001–019. The 20 `public`/`internal` application tables have forced RLS; anon has no app-table SELECT, authenticated has no direct write grants, and internal tables have no anon/authenticated table grants. `documents` is private, limited to 15 MiB and PDF/DOCX/TXT/PPTX MIME types. Core app and queue tables had zero rows at inspection. | No managed PostgREST two-user/anonymous/RPC journey or migration rollback exercise. The 5 internal no-policy security notices are intentional deny-by-default and have no client grants. The performance advisor reports 14 composite-FK coverage notices and 44 unused-index notices; catalog review found a valid leading-column index for each reported FK, and fresh empty staging usage is not a basis for dropping indexes. |
| ECON-01 economy | Folder charge/replay follows PRD pricing. By user approval, migration 017 adds +1 credit for each newly accepted client-attested correct event with an owned study item, in the same transaction. Sync returns server credits; mobile loads/reconciles the balance. | Staging schema only; no API deployed or hosted sync/purchase journey. Wallets start at zero and this approved sync reward is the current server earning path; a modified client can fake correctness and farm credits under the chosen MVP trust rule. Mobile spend/conversion remains local-only. Heart regeneration/refill and XP policy remain pending. |
| Database indexes | Migration 013 adds `chat_messages(user_id)`, `study_items(user_id)` and partial `internal.upload_tickets(auth_ref)` indexes for Auth deletion/retirement paths. Local unforced plans selected all three for 1,000-row owner lookups. | Local synthetic query plans establish index selection, not production capacity. Do not remove indexes from the empty staging advisor output. Migration 019 has no ANN index; measure tenant-filtered exact scans and retrieval quality before selecting halfvec/HNSW. |
| RET-01 storage and retention | Migration 018 is applied to staging. User/account retirement defers path deletion until `signed_until + 15 minutes`, revokes prior cleanup leases, and retains a 15-minute tombstone retry. This is eventual cleanup for unique, non-reissued paths. A fresh SDK check found the latest published Python `storage3` 2.32.0 still exposes only path-string deletion; the repository remains pinned to 2.31.0. | Supabase gives no documented maximum for an upload already in flight at URL expiry; hosted purge timing is unverified. Ordinary 72-hour expiry remains fail-closed because neither inspected Python SDK version exposes generation-conditional delete. Legacy/unregistered inventory and scheduler capacity remain open. Generated sets remain independent of original-file deletion. |
| AI-04 image provider configuration | Managed startup rejects blank/placeholder `OPENROUTER_IMAGE_MODEL`; request boundary rejects placeholder key/model before network. | No live provider contract/request or math-photo fallback verification. AI-04 remains partial. |
| WORK-02/API-01 jobs and replay | Durable job, generation/folder replay, bounded recovery and upload-ticket modules are locally covered by the complete backend suite; staging has migrations 006–012. | No hosted worker/API has run these contracts. Native process-death/restart, provider generation and managed storage journeys remain open. |
| OPS-01 Render | `render.yaml` defines a Singapore API and separate worker, `/ready`, disabled auto-deploy, platform-injected secrets and bounded shutdown. The Docker image accepts Render `PORT`. | No service is deployed. Enter the real HTTPS CORS origin and secret values in Render; choose an instance size; qualify readiness, worker drain, monitoring, alerts, provider/model configuration and operating cost. |

## Staging migration record

Project: `momo-staging`, ref `zkouryrzhsgaeqyiwwyb`, Singapore, Supabase PostgreSQL 17, `ACTIVE_HEALTHY` at the final check. Migrations 001–004 were already in the ledger. This pass applied:

Public signing metadata at the project's Auth JWKS endpoint reports one ES256/EC public key, matching the backend's asymmetric JWKS verification path and the Render template's blank `SUPABASE_JWT_SECRET`. This was a metadata-only read; no OAuth login or user token was used.

| Migration | Recorded version | Result |
| --- | --- | --- |
| 005 economy ledger | `20261013183414` | applied |
| 006 durable jobs | `20261013183423` | applied |
| 007 atomic document index | `20261013183425` | applied |
| 008 generation requests | `20261013183525` | DDL was applied and catalog-verified; an immediate ledger write collided with the generated 007 timestamp. After confirming every 008 object, the name was recorded with a no-op reconciliation instead of replaying DDL. |
| 009 bounded orphan recovery | `20261013183536` | applied |
| 010 folder request replay | `20261013183539` | applied |
| 011 authorized generation dispatch | `20261013183542` | applied |
| 012 upload tickets | `20261013183545` | applied |
| 013 auth cleanup indexes | `20261013184255` | applied |
| 014 Google profile sync | `20261013234934` | applied; trigger-first backfill |
| 015 verified legacy storage destination | `20261013234939` | applied; zero legacy tickets required mapping |
| 016 charged folder request replay | `20261014001721` | applied after local verification; both folder RPCs retain fixed search paths, deny anon/authenticated EXECUTE, and grant service-role EXECUTE; `internal.folder_requests` remains forced-RLS with no anon/authenticated SELECT |
| 017 correct-answer credit rewards | `20261014003950` | applied after full local verification; catalog confirms `SECURITY DEFINER`, fixed `search_path=pg_catalog, public`, anon/authenticated denied, service_role granted |
| 018 safe retired upload purge | `20261014015410` | applied after local verification; catalog confirms the signed-expiry gate in claim/prepare/retire/account-deletion functions and anon/authenticated EXECUTE denied |
| 019 embedding v2 | `20261014101923` | applied after the full local suite; `embedding_v2` is `vector(2048)`, staging remains 0 documents/0 chunks, and all four v2 functions have fixed search paths and service-role-only execution |

## API-01 generated media boundary

The user approved a maximum decoded image size of 15 MiB, PNG/JPEG/WebP formats,
and 16 megapixels. The image service validates provider and renderer base64,
MIME/signature, decoded size, and dimensions before returning output. OpenRouter
responses are streamed under a bounded encoded-body cap before JSON parsing.
Focused validation: 63 image/API/request-body tests, Ruff on changed files,
mypy across 75 source files, and `git diff --check` passed. No live provider or
hosted image request was made.

## AI-04 image provider configuration boundary

Managed configuration now requires a non-placeholder image model, and the
OpenRouter image provider uses the shared placeholder detector for both the key
and model before opening a network client. The model selection was not changed.
Focused environment/image tests passed (119); the full local loopback
PostgreSQL/PostgREST suite passed 867 tests with zero skips/errors/failures.
The no-skip gate, Ruff (138 files), mypy (75 files), and `git diff --check`
passed. No provider request was made; math-photo fallback policy remains blocked.

## AI-04 OpenRouter image request contract follow-up

The configured `google/gemini-3.1-flash-image` endpoint metadata was checked
through OpenRouter's public capability endpoint. It currently lists `resolution`,
`aspect_ratio`, `n`, and `input_references`, so the request no longer sends the
unlisted `quality` or `output_format` fields. The provider now retains the
response's `media_type` without assuming PNG, allowing the existing image
validator to reject missing or unsupported MIME types. A mocked response test
also found and fixed streamed JSON parsing of `bytearray` content by converting
it to `bytes` before passing it to HTTPX.

Focused image-provider tests passed **33 tests**. The full local loopback
PostgreSQL/PostgREST suite passed **868 tests with zero skips/errors/failures**;
the no-skip gate, Ruff (138 files), mypy (75 files), and `git diff --check`
passed. No inference request or paid provider traffic was sent. OpenRouter's
[endpoint metadata](https://openrouter.ai/api/v1/images/models/google/gemini-3.1-flash-image/endpoints)
is live and may change; AI-04 remains partial until provider behavior and the
math-photo fallback policy are verified.

Final local regression after this change: the required PostgreSQL/PostgREST suite
passed **837 tests with zero skips/errors/failures** in 65.78 seconds; the no-skip
gate passed. Full static checks passed (Ruff 138 files, mypy 75 files), and mobile
lint plus **182 tests** passed. The stack bound only to loopback and was removed
afterward. JUnit evidence: `/tmp/momo-local-gateway-after-image.xml`.

Post-apply catalog checks found the `auth_user_google_profile_sync` trigger and
`upload_tickets_legacy_cleanup_idx`; the migration ledger records 001–016 in
order. No fixture rows were created. The security advisor remains at five INFO
no-policy findings on internal tables without client grants. The performance
advisor reports 14 composite-FK notices and 44 unused indexes on the fresh
staging workload, including the new cleanup index; no indexes were dropped.

No staging fixture rows were created. Catalog verification found all 20 application tables in `public`/`internal` have RLS enabled and forced. Anon has no SELECT on public app tables; authenticated has no INSERT/UPDATE/DELETE grants; internal tables expose no table privileges to either client role. Authenticated `SELECT` on public tables is restricted by owner policies. The `documents` bucket catalog shows `public=false`, 15,728,640-byte limit and the four expected MIME types. This is catalog evidence, not a real Storage API upload/read test.

Supabase security advisor: 5 INFO `rls_enabled_no_policy` findings for internal tables `background_jobs`, `folder_requests`, `generation_requests`, `rate_limit_events` and `upload_tickets`; no anon/authenticated grants are present. [Advisor details](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

Performance advisor: 14 composite-FK notices remain. The catalog check found an existing valid index beginning with the first FK column for each notice; these selective scalar-ID indexes cover parent-reference lookup, while the advisor asks for complete composite coverage. 44 unused-index notices reflect staging's fresh, empty workload; no indexes were dropped. [FK advisor](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys) · [unused-index advisor](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index).

The initial attempt to record migration 008 hit a duplicate migration version because the tool generated the same-second version as migration 007. The DDL itself had succeeded. After checking its table, indexes, constraints, RPCs and policies in the catalog, a no-op migration call recorded 008 under a unique version. The staging ledger now has the ordered 001–016 names. No DDL was replayed.

## Local verification

- Earlier dependency/SDK refresh (2026-10-14): mobile `npm audit` reported 31 vulnerable package nodes (19 high, 12 moderate). `npm audit fix --dry-run` offered no compatible global changes; published `braces` 3.0.3 and `node-forge` 1.4.0 remain in vulnerable ranges. Inspected the published `storage3` 2.32.0 wheel: synchronous and asynchronous `remove` accept only path lists, with no object-version parameter. The lockfile remains at 2.31.0. No hosted Storage calls were made.

- At the profile-provisioning milestone, the full backend/API/database/gateway suite with loopback-only disposable PostgreSQL and PostgREST had **823 passed, 0 skipped, 0 failed**, with 32 existing Starlette deprecation warnings (227.53s). That was an earlier checkpoint; the later account-deletion run below verified 827 tests. JUnit from the profile checkpoint: `/tmp/momo-auth02-final-2026-10-14.xml`.
- Final integrated rerun after the chat-bound and folder-contract updates: **830 passed, 0 skipped, 0 errors, 0 failures** in 480.31s using disposable loopback PostgreSQL and local PostgREST, with 34 existing Starlette 422 deprecation warnings. `assert_no_skips.py` passed for `/tmp/momo-local-gateway-2026-10-14-final.xml`. Full static checks passed: Ruff 138 files, mypy 75 files. The non-root, network-isolated two-page OCR runtime smoke passed after an import-order fix.
- Folder-pricing integration rerun after migration 016: **832 passed, 0 skipped, 0 errors, 0 failures** in 379.71s against disposable loopback PostgreSQL and local PostgREST; `assert_no_skips.py` passed. It covers ordered migration application, route affordability/replay, concurrent ordinal pricing, legacy free-request replay, tombstones and wrapper compatibility. The 34 Starlette 422 deprecation warnings remain. Ruff 138 files, mypy 75 files and `git diff --check` passed again.
- Ruff and mypy: **138 Ruff files** and **75 Python source files** passed.
- Mobile: lint passed; **181 tests passed**. No mobile code changed during the final index migration.
- `docker build -t momo-backend:2026-10-14 backend` passed. Network-isolated non-root real-SDK construction failed closed on denied database I/O as expected. The non-root scanned-PDF OCR smoke preserved text/page metadata. `/health` and `/ready` both returned 200 through a `PORT`-bound container, which then stopped cleanly.
- Migration 013 query plans on synthetic local tenant data selected `chat_messages_owner_idx`, `study_items_owner_idx` and `upload_tickets_auth_ref_idx` for 1,000 rows each; plans were unforced and no time threshold was used.
- `git diff --check` passed. No hosted CI run or public deployment occurred.
- After the OCR runtime CI step was added: local `docker build` and the exact network-isolated non-root OCR smoke passed; Ruby YAML parse passed. The remote GitHub Actions workflow was not triggered.

## Public launch blockers

1. Deploy the prepared Render API and worker only after providing real staging CORS origin and secrets in the host. Keep development auth, memory persistence and inline jobs off. Add database/worker health, queue and cleanup alerts, cost limits, drain behavior and an operating plan.
2. Run a bounded staging journey with real Google OAuth and two synthetic users through `/api/me`, upload signing, actual private Storage upload, registration/quota, worker processing and owner-isolated study retrieval. Verify invalid/expired JWT denial and service-only RPC denial. Keep provider AI calls separately bounded and approved.
3. Resolve generation-safe physical object deletion for Supabase Storage, inventory old/unregistered objects and observe actual `uploaded_at + 72h` deletion. Keep automatic cleanup fail-closed until it cannot delete a replacement object.
4. Verify current OpenRouter/Nemotron generation and embedding model/dimension configuration against real controlled staging calls; prove source-only grounding, schema/evidence validation, safe provider failures and every advertised format.
5. Verify managed GoTrue profile synchronization after migrations 014/015. Complete logout/account switching and account deletion including stored objects; qualify native Android/iOS flows and offline/reconnect sync.
6. Correct-answer rewards trust the client-attested result under the approved MVP rule and can be farmed by modified clients; server adjudication remains open. Keep heart regeneration/refill and XP policy pending. Then close clean remote CI, managed backup/restore and migration/app rollback, release-device/accessibility/performance QA, privacy/support/store details and an explicit release decision.

The canonical tracker is [Production Readiness Checklist](PRODUCTION_READINESS_CHECKLIST.md). Obsidian links are in `docs/knowledge/Momo Backend Completion 2026-10-14.md` and `docs/knowledge/Momo Readiness Map.canvas`.

## AUTH-02 profile provisioning follow-up

Local migration 014 adds Google-only profile provisioning and a serialized
backfill for existing Google Auth users. PostgreSQL integration tests cover
backfill, profile updates, provider exclusion, email collision, and Auth delete
cascade. Migration 014 is applied to staging and its trigger/catalog entry are
verified, but the trigger uses `supabase_auth_admin` in the local fixture;
managed GoTrue behavior is not proven.
The local account-deletion flow now adds `DELETE /api/me` (verified JWT subject
only, Supabase Auth Admin, safe retry after a lost response) and mobile
account-scoped SQLite clearing. The user confirmed historical uploads used the
Supabase `documents` bucket. Migration 015 records that destination for
pre-ticket rows and indexes retired legacy cleanup; PostgreSQL verifies those
objects become claimable after Auth deletion. It is applied to staging, where
the legacy-ticket count was zero. Managed Auth cascade, physical object purge (including old
versions), and files without database inventory remain unverified. Final local
verification: final integrated backend/API/PostgreSQL/PostgREST run had 830
passed, zero skipped/errors/failures; Ruff 138 files and mypy 75 source files
passed; no-skip checker, mobile TypeScript lint, 182 mobile tests, Canvas JSON
validation, and `git diff --check` passed. The backend run used only loopback
PostgreSQL/PostgREST and reported 34 existing Starlette 422 deprecation warnings.

## CHAT-01 expiry follow-up

`generate_study_card` now uses the shared `_usable_source` predicate, rejecting
expired or malformed-expiry READY documents before semantic retrieval. The
parameterized regression passed for `generate_study_card`, `create_study_deck`,
and `generate_weakness_review` (3 passed); it asserts no retrieval/embedding or
model generation occurs. Ruff/mypy and `git diff --check` passed. This closes
the recorded local A2-2 expiry gap only; CHAT-01 provenance/device evidence and
all hosted behavior remain open.

## DOC-02 multi-page OCR follow-up

Extended `scripts/testing/container_ocr_smoke.py` to create a two-page raster-
only synthetic PDF. The actual Tesseract and Poppler binaries processed it in
the pinned non-root backend image under `--network none` and a read-only root
filesystem. Both pages returned in order with `is_ocr=true` and their distinct
expected text. This proves the runtime path for this synthetic sample, not
general OCR accuracy or support for a representative scan corpus.

## ECON-01 folder pricing follow-up

The user approved PRD 6.6 folder pricing and asked that heart regeneration/refill
remain pending. `POST /api/folders` now uses the existing atomic wallet charge
RPC for keyed offline requests and no-key compatibility calls. Migration 016
stores new charged creates in `internal.folder_requests`, returns existing
legacy requests without charging them again, preserves changed-payload and
deleted-folder conflicts, and routes the older RPC name through the charged
transaction during API rollout. Local memory/API and PostgreSQL concurrency,
wallet, and replay checks passed as part of the 832-test, zero-skip run. It is
applied to `momo-staging` as `20261014001721`; catalog checks confirmed both RPCs
remain service-role-only and the request table denies client reads. No staging
rows were created. Migration 017 now provides one credit for each newly accepted
client-attested correct-answer sync event; see the following section. Heart
settings remain unset.

## ECON-01 correct-answer reward follow-up

The user approved +1 Momo Coin for each newly accepted correct-answer sync event
and explicitly chose the MVP policy of trusting the client's `correct` result.
Each such event must reference an owned study item. Migration 017 attaches an
`AFTER INSERT` trigger to `sync_events`; it calls the existing transactional
wallet ledger with `sync_correct:<event_id>`, so event insertion and credit
application commit or roll back together. Duplicate event IDs and non-correct
results do not award coins. No historical events were backfilled.

The sync response includes `credits_balance`; the signed-in mobile wallet fetches
server credits on account load and reconciles after successful sync responses,
checking the active account and epoch before persistence. Local validation:
Postgres/PostgREST suite **839 passed, zero skips/errors/failures**, no-skip gate
passed; Ruff 138 files, mypy 75 files; mobile lint and 186 tests passed, including
the stale wallet GET race regression. Migration
`20261014003950` is applied to staging and the security catalog check passes. A
modified mobile client can lie about correctness and farm credits, a known risk
of the approved MVP rule. Render deployment and a hosted sync journey await the
API URL the user is configuring.

## SEC-02 math parser and log privacy follow-up

Restricted the SymPy parser to an allowlisted AST and namespace, with bounds on
input length, AST nodes, numeric exponents, and estimated symbolic expansion
(4,096 terms). Factorial function calls are rejected before parsing because
large factorials can monopolize the synchronous API worker; inverse-trig aliases
remain supported. Regression tests cover code-execution-shaped input, Python
attribute/subscript/comprehension syntax, expensive powers, factorial abuse and
the reviewed symbolic-expansion payload. Math, diagram and prompt-injection
logging no longer includes raw solver exception text, user topics/requirements,
or internal regex patterns.

The local PostgreSQL/PostgREST gateway suite passed **854 tests, zero skips,
errors or failures**; the no-skip gate passed. Ruff (138 files), mypy (75 files),
and `git diff --check` passed. This completes only the local math-parser task.
SEC-02 remains open for a full provider/worker log audit, release bundle and
dependency scans, hosted HTTPS/CORS, and complete object-retention/deletion
proof.

## SEC-02 provider logs and release artifact follow-up

Source review with parallel audits covered provider, document-worker, storage and
upload-cleanup logging. Sentinel regression tests verify that request prompts,
provider credentials and provider/storage exception details do not reach logs in
the reviewed image-provider, processing-worker and cleanup-worker failures.
Exception classes/statuses and sanitized or static messages remain available for
operations. This bounded audit does not prove every runtime log sink has been
reviewed. Some worker logs retain opaque document/job/study-set UUIDs for
operational correlation; the reviewed calls contain no user UUID, object key,
filename or document content.

`uv audit --locked` reports no known backend dependency vulnerabilities after
updating PyJWT and keeping multidict on patched 6.x. `npm audit --audit-level=high`
reports no known web dependency vulnerabilities. The mobile audit initially
reported 31 vulnerable package nodes (19 high, 12 moderate). A scoped Expo
Router override resolves its nested vulnerable query-string 7/decode-uri-component
0.2 chain to the app's query-string 9.5.1 and decoder 0.5.0. Since Router 57's
CommonJS build expects named exports, a version-guarded postinstall patch fixes
the two parser imports. Tests cover repeated query parameters and malformed
percent encoding. Clean `npm ci`, postinstall, Router smoke, 188 mobile tests,
and TypeScript lint passed. The current audit reports 28 package nodes (19 high,
9 moderate); `braces` and `node-forge` remain in vulnerable ranges without
patched releases. Android and iOS bundle exports and source maps confirmed the
old nested Router decoder is absent. No device deep-link test or signed store
artifact scan was run. Expo dependency compatibility check, web build, and the
selected-pattern scan of 106 generated bundle files passed; that scan found no
credential-shaped matches and is not a universal secret detector.

The full local backend/PostgreSQL/PostgREST suite passed **855 tests, zero
skips/errors/failures**; `assert_no_skips.py` passed, Ruff checked 138 files,
mypy checked 75 files, and `git diff --check` passed. SEC-02 remains a release
blocker until the mobile dependency path is resolved and Render HTTPS/CORS,
two-account isolation, and hosted retention/deletion are verified. No hosted
provider traffic was sent.

After the independent review strengthened the worker-log assertions, the final
focused provider/worker/storage test run passed **45 tests**; Ruff, mypy and
`git diff --check` passed again.

## SEC-02 final local audit

An adversarial model response could name an arbitrary chat tool. The backend
logged that value, echoed it in the unknown-tool error, persisted it in
`ToolCallRecord`, and replayed it in the next provider turn. Tool names are now
bounded by the existing `CHAT_TOOLS` allowlist; unsupported names become the
constant `unsupported_tool`, and unknown-tool responses contain no model value.
A sentinel API regression verifies the value is absent from logs and returned
metadata.

The landing site now sends baseline content-security directives (`base-uri`,
`object-src`, `frame-ancestors`), HSTS, `nosniff`, a referrer policy and a frame
denial header. Local configuration and build checks do not prove the deployed
host sends these headers. The site still needs response-header verification
after its hosting URL is available.

Independent mobile review found no defect in the inspected token paths: native
tokens use device-only SecureStore, web tokens remain memory-only, OAuth uses
PKCE, and hosted API origins require HTTPS. Remaining release risks are 28
mobile package-node advisories (19 high, 9 moderate), preview-chat's reliance on trusted proxy
handling and a shared/edge rate limiter, partial known-pattern secret scanning,
and unverified Render HTTPS/CORS, two-account isolation and hosted retention
and deletion. These are explicit deployment gates, not completed checks.

The chat-agent and source-safety suites passed **83 tests** (4 existing
Starlette deprecation warnings); Ruff passed for the changed Python files. Web
typecheck passed, all **25** web tests passed, and the production build passed.
The built local server returned all five configured headers on HTTP 200. This
does not verify the deployed HTTPS endpoint. No hosted traffic or secret values
were used.

## RET-01 local scheduler cadence

The persistent worker runs maintenance immediately after startup, then waits
`CLEANUP_INTERVAL_SECONDS` before the next pass. The default is now 300 seconds,
and each cleanup pass remains bounded to 100 tickets. The Render Blueprint
starts `python -m app.workers.runner`; the standalone cleanup command is a
one-shot option for an intentionally selected external scheduler. A local
worker-loop regression verifies maintenance runs again on the configured
interval. The worker-loop, cleanup-worker and environment/configuration suites
passed **127 tests**. Ruff checked 138 files, mypy checked 75, and
`git diff --check` passed.

This verifies configuration and loop behavior only. The hosted worker has not
been deployed, cleanup throughput has not been measured against production
volume, alert delivery has not been wired or observed, and physical provider
deletion timing remains unverified. Ordinary 72-hour Supabase deletion stays
fail-closed pending generation-safe provider support.

## AI-02 A2-1 generated hint grounding follow-up

Generated study hints now pass the same cited-chunk support and polarity check
used for claims before persistence. Unsupported, malformed, overlength, and
other-retrieved-chunk-only hints are omitted; a valid answer and study item remain
eligible. Regression tests cover a source-supported hint, unsupported hint
preserving the answer, and evidence found only in a different retrieved chunk.

Focused grounding/hardening tests passed **129 tests**. The full local
PostgreSQL/PostgREST suite passed **858 tests, zero skips/errors/failures**; the
no-skip gate passed, Ruff checked 138 files, mypy checked 75 files, and
`git diff --check` passed. The local gateway was stopped afterward. Independent
review found no actionable issues.

This closes only A2-1 locally. AI-02 remains partial: support checks are lexical
with provisional thresholds, labeled calibration/TypeSafe evaluation is still
open, and relation-blind short-answer/reviewer-rejection cases remain.

## RET-01 retired upload URL race follow-up

Migration 018 implements the approved purge delay: retired user-deletion and
Auth account-deletion tickets cannot be claimed until the recorded signed-upload
deadline plus 15 minutes. Retirement revokes any earlier cleanup lease, and the
cleanup preparation RPC checks the deadline again before authorizing provider
deletion. The document DELETE endpoint removes the source record/chunks from the
library immediately while retaining the ticket for the worker; generated sets
stay detached through the existing foreign key. The library confirmation now
describes the delayed storage purge.

Local PostgreSQL ticket/cleanup and API tests passed **36 tests**. The final
loopback PostgreSQL/PostgREST suite passed **869 tests, zero skips/errors/failures**;
Ruff checked 138 files, mypy checked 75 files, mobile lint and all 186 mobile
tests passed, and `git diff --check` passed. Staging migration `20261014015410` is applied;
catalog checks confirm all four affected functions contain the expiry gate and
anon/authenticated cannot execute the service RPCs. This addresses the signed
upload URL resurrection window only. Generation-safe Supabase deletion,
unregistered-object inventory and physical 72-hour deletion remain open.
The deadline timestamp is recorded immediately before the provider signing call;
the configured Storage client timeout is 15 seconds, below the 15-minute grace.
This bounds but does not directly observe the token's exact issuance/expiry time.
