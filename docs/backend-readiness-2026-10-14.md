# Momo backend readiness — October 14, 2026

**Status: not ready for public launch.** This pass completed local backend hardening and deployment preparation, then applied and inspected the ordered schema on the user-selected `momo-staging` Supabase project. It did not deploy the API or worker, run real Google sign-in, upload hosted bytes, call an AI provider, query `momo-prod`, or run hosted load tests.

## Decisions and boundaries

- Login is Google OAuth only. The user selected verification by Supabase Auth at sign-in followed by signed Supabase JWT validation on each API request; no live Google/Auth lookup is made for every request.
- The user selected `momo-staging`, authorized resuming it and the staging migrations, reported Google OAuth configured there, and selected Render for hosting preparation.
- Hosting target is Render. The Blueprint is prepared, but no service was created or deployed. Production and public release remain outside this pass.
- `docs/knowledge/` is the configured Obsidian vault. Its overview and canvas now link to the dated completion note.

## By task and module

| Task/module | Delivered | Still open |
| --- | --- | --- |
| AUTH-01 backend identity | `backend/app/dependencies.py` validates the Supabase token signature, algorithm, pinned issuer/audience, expiry, role and UUID subject, then requires signed Google provider and OAuth method claims. Password, anonymous, non-Google and unsupported methods are rejected. | Google OAuth is reported configured, but an actual staging sign-in, refresh/revocation and native redirect journey were not run. Disabling a Google account after token issuance does not trigger an immediate per-request Google recheck; the chosen policy relies on Supabase JWT expiry/revocation. |
| ENV-02 schema and security | Staging now records migrations 001–013. The 20 `public`/`internal` application tables have forced RLS; anon has no app-table SELECT, authenticated has no direct write grants, and internal tables have no anon/authenticated table grants. `documents` is private, limited to 15 MiB and PDF/DOCX/TXT/PPTX MIME types. Core app and queue tables had zero rows at inspection. | No managed PostgREST two-user/anonymous/RPC journey or migration rollback exercise. The 5 internal no-policy security notices are intentional deny-by-default and have no client grants. The performance advisor still reports 14 composite-FK coverage notices and 43 unused-index notices; catalog review found a valid leading-column index for each reported FK, and fresh empty staging usage is not a basis for dropping indexes. |
| Database indexes | Migration 013 adds `chat_messages(user_id)`, `study_items(user_id)` and partial `internal.upload_tickets(auth_ref)` indexes for Auth deletion/retirement paths. Local unforced plans selected all three for 1,000-row owner lookups. | Local synthetic query plans establish index selection, not production capacity. Do not remove indexes from the empty staging advisor output. |
| RET-01 storage and retention | Durable upload-ticket lifecycle from migration 012 is now applied to staging; no app rows were present. | Supabase path-only deletion is not generation-safe, so automatic physical expiry remains fail-closed. Legacy/unregistered object inventory and hosted 72-hour deletion proof are incomplete. Generated sets must remain independent of original-file deletion. |
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

No staging fixture rows were created. Catalog verification found all 20 application tables in `public`/`internal` have RLS enabled and forced. Anon has no SELECT on public app tables; authenticated has no INSERT/UPDATE/DELETE grants; internal tables expose no table privileges to either client role. Authenticated `SELECT` on public tables is restricted by owner policies. The `documents` bucket catalog shows `public=false`, 15,728,640-byte limit and the four expected MIME types. This is catalog evidence, not a real Storage API upload/read test.

Supabase security advisor: 5 INFO `rls_enabled_no_policy` findings for internal tables `background_jobs`, `folder_requests`, `generation_requests`, `rate_limit_events` and `upload_tickets`; no anon/authenticated grants are present. [Advisor details](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

Performance advisor: 14 composite-FK notices remain. The catalog check found an existing valid index beginning with the first FK column for each notice; these selective scalar-ID indexes cover parent-reference lookup, while the advisor asks for complete composite coverage. 43 unused-index notices reflect staging's fresh, empty workload; no indexes were dropped. [FK advisor](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys) · [unused-index advisor](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index).

The initial attempt to record migration 008 hit a duplicate migration version because the tool generated the same-second version as migration 007. The DDL itself had succeeded. After checking its table, indexes, constraints, RPCs and policies in the catalog, a no-op migration call recorded 008 under a unique version. The staging ledger now has the ordered 001–013 names. No DDL was replayed.

## Local verification

- Full backend/API/database/gateway suite with loopback-only disposable PostgreSQL and PostgREST: **819 passed, 0 skipped, 0 failed**, 32 existing Starlette deprecation warnings (157.23s). JUnit: `/tmp/momo-backend-2026-10-14-final2.xml`; the no-skips gate reported 819 tests.
- Ruff and mypy: **138 Ruff files** and **75 Python source files** passed.
- Mobile: lint passed; **181 tests passed**. No mobile code changed during the final index migration.
- `docker build -t momo-backend:2026-10-14 backend` passed. Network-isolated non-root real-SDK construction failed closed on denied database I/O as expected. The non-root scanned-PDF OCR smoke preserved text/page metadata. `/health` and `/ready` both returned 200 through a `PORT`-bound container, which then stopped cleanly.
- Migration 013 query plans on synthetic local tenant data selected `chat_messages_owner_idx`, `study_items_owner_idx` and `upload_tickets_auth_ref_idx` for 1,000 rows each; plans were unforced and no time threshold was used.
- `git diff --check` passed. No hosted CI run or public deployment occurred.

## Public launch blockers

1. Deploy the prepared Render API and worker only after providing real staging CORS origin and secrets in the host. Keep development auth, memory persistence and inline jobs off. Add database/worker health, queue and cleanup alerts, cost limits, drain behavior and an operating plan.
2. Run a bounded staging journey with real Google OAuth and two synthetic users through `/api/me`, upload signing, actual private Storage upload, registration/quota, worker processing and owner-isolated study retrieval. Verify invalid/expired JWT denial and service-only RPC denial. Keep provider AI calls separately bounded and approved.
3. Resolve generation-safe physical object deletion for Supabase Storage, inventory old/unregistered objects and observe actual `uploaded_at + 72h` deletion. Keep automatic cleanup fail-closed until it cannot delete a replacement object.
4. Verify current OpenRouter/Nemotron generation and embedding model/dimension configuration against real controlled staging calls; prove source-only grounding, schema/evidence validation, safe provider failures and every advertised format.
5. Complete Auth profile creation, logout/account switching and account deletion including stored objects; qualify native Android/iOS flows and offline/reconnect sync.
6. Resolve economy/regen policy, clean remote CI, managed backup/restore and migration/app rollback, release-device/accessibility/performance QA, privacy/support/store details and an explicit release decision.

The canonical tracker is [Production Readiness Checklist](PRODUCTION_READINESS_CHECKLIST.md). Obsidian links are in `docs/knowledge/Momo Backend Completion 2026-10-14.md` and `docs/knowledge/Momo Readiness Map.canvas`.
