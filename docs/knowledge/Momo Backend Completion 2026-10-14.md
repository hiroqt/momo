---
tags: [momo, backend, auth, database, deployment, release-blocker]
audited: 2026-10-14
status: public-release-blocked
---
# Momo Backend Completion — 2026-10-14

Parent: [[Momo Public Readiness]]. Map: [[Momo Readiness Map.canvas]]. Full evidence: [[docs/backend-readiness-2026-10-14|dated backend report]]. Task ownership and acceptance: [[docs/PRODUCTION_READINESS_CHECKLIST|Production Readiness Checklist]].

## Decisions

- Login is Google OAuth only. Supabase Auth verifies the active Google account at sign-in; the API validates the signed Supabase JWT on each request. The user selected no live Google recheck per request.
- The user authorized resuming and applying database migrations to `momo-staging`, reported Google OAuth configured there, and selected Render for host preparation. The user also approved delaying retired-object purge until the two-hour upload URL expires plus a 15-minute grace period.
- `momo-prod` was not queried or changed. No staging API/worker deployment, hosted Google sign-in, object upload, AI-provider call, or hosted load test was performed.

## Completed by module

**Auth (AUTH-01):** `backend/app/dependencies.py` checks token signature/algorithm, configured issuer and audience, expiry, authenticated role and UUID subject. It accepts only signed Google provider and OAuth-method claims. Anonymous, password and non-Google identities fail. The API does not make an Auth service request on each call. Tests cover provider rejection. A real Google login, token refresh and device redirect remain unverified.

**Auth lifecycle (AUTH-02, local):** migration 014 adds Google-only Auth profile sync and a backfill for existing Google accounts. Trigger-first ordering serializes signups with the backfill; profile email collisions do not bind another Auth ID. Local migration 015 records the user-confirmed Supabase `documents` destination for pre-ticket uploads and indexes retired legacy cleanup. `DELETE /api/me` deletes only the verified subject through Auth Admin and treats exact `user_not_found` as an idempotent retry after a lost response. Mobile confirmation signs out and clears only that account's local SQLite data. Local PostgreSQL verifies legacy ticket claim after Auth deletion. Migrations 014/015 are applied to staging; catalog verification passed, while managed GoTrue behavior and physical Storage purge remain unverified. Logout/account-switch device proof remains open.

**Chat source expiry (CHAT-01, local):** `generate_study_card` now shares the READY-and-unexpired source filter used by deck tools, so expired/malformed-expiry documents stop before retrieval/embedding. Three parameterized regression cases passed; this closes the recorded A2-2 local gap, not the remaining provenance, native or hosted chat gates.

**Image provider configuration (AI-04, local):** managed startup requires a non-placeholder `OPENROUTER_IMAGE_MODEL`; the request boundary rejects placeholder OpenRouter keys/models before network. The selected model was not changed. Focused tests (119) and the full loopback PostgreSQL/PostgREST suite (867, zero skips) pass; Ruff 138, mypy 75 and diff check pass. No live provider call was made; AI-04 remains partial for the math-photo fallback policy and provider contract.

**OpenRouter image request contract (AI-04, local):** current public endpoint metadata for `google/gemini-3.1-flash-image` lists `resolution`, `aspect_ratio`, `n`, and `input_references`; the request no longer sends unsupported `quality`/`output_format`. The response MIME type is preserved so the existing validator fails closed when it is missing or unsupported. The regression test exposed and fixed HTTPX JSON parsing from a streamed `bytearray`. Provider tests: 33; full loopback PostgreSQL/PostgREST suite: 868 passed, zero skips; no-skip, Ruff 138, mypy 75 and diff check passed. No inference call. AI-04 remains partial for actual provider behavior and math-photo fallback policy.
**Scanned PDF OCR (DOC-02, local):** the actual Tesseract/Poppler runtime processed two synthetic raster-only pages in the non-root, network-isolated backend image. Ordered page numbers, OCR flags and distinct text were verified. This is a runtime smoke, not a representative corpus or OCR accuracy claim.

**Database (ENV-02):** staging migration ledger contains 001–018. All 20 `public` and `internal` application tables have forced RLS. Anonymous has no app-table reads, authenticated has no direct writes, and internal tables have no client grants. The private `documents` bucket has a 15 MiB cap and PDF/DOCX/TXT/PPTX allow-list. No app or queue rows were present. Migration 013 adds auth-deletion/retirement lookup indexes for chat messages, study items and upload tickets; local unforced plans selected them on synthetic data. Migration 015 adds the legacy retired-cleanup index; staging catalog verification found it, with zero legacy tickets to map.

**Economy (ECON-01, folder purchase):** the user approved PRD 6.6 pricing: folders 1–3 are free, followed by 50, 75, then +25 credits per folder. `POST /api/folders` now calls the existing atomic charge RPC. Migration 016 stores charged creates in the durable owner-scoped replay table and preserves pre-migration queued free requests on replay. The old RPC name delegates through the same charge path for API rollout compatibility. Local API, concurrent PostgreSQL, and legacy replay checks pass; migration `20261014001721` is applied to staging and the function/RLS grants are catalog-verified. Heart regeneration/refill stays pending.

**Economy (ECON-01, sync rewards):** the user approved +1 Momo Coin (stored as one credit) for each newly accepted correct-answer sync event, trusting the client-attested result for MVP. API validation and the database trigger require an owned study item; an `AFTER INSERT` trigger calls the existing wallet ledger RPC in the same transaction with `sync_correct:<event_id>` as the idempotency key. Duplicate sync events and non-correct outcomes earn nothing; historical events were not backfilled. Sync returns the server credit balance, and the mobile account wallet loads it on account load and reconciles it after sync with account/epoch checks; stale same-account GET responses cannot overwrite newer sync balances. Some mobile economy spends/exchanges remain local-only, so authoritative purchase flows and local previews still need reconciliation. Full local Postgres/PostgREST suite: 839 passed, zero skips/errors/failures; mobile TypeScript and 186 tests passed. Migration 017 is applied to staging as `20261014003950`; catalog confirms `SECURITY DEFINER`, fixed `search_path=pg_catalog, public`, anon/authenticated denied and service_role granted. A modified client can submit false correct results and farm coins; server-side answer adjudication remains open. Hosted API/client journey awaits Render deployment.

**Jobs/storage (WORK-02, RET-01):** durable jobs, request replay, bounded recovery and upload tickets are applied in staging and tested locally. The current Supabase JavaScript reference documents exact-version deletion, but the pinned Python `storage3` 2.31.0 interface accepts only paths; Supabase's S3 guide says bucket versioning is unsupported. Until the versioned wire behavior and selected bucket are verified, automatic deletion remains fail-closed. Legacy/unregistered object inventory and physical 72-hour deletion proof remain release blockers.

**Retired upload safety (RET-01, local + staging schema):** migration 018 makes user and Auth account deletion retain the upload ticket while waiting until `signed_until + 15 minutes`; it revokes a pre-existing cleanup lease and rechecks the deadline before authorizing purge. The document API hides the source immediately and delegates physical deletion/retries to the cleanup worker. Local regression coverage checks the early-claim denial and post-deadline eligibility; the SDK gateway smoke confirms no early claim. Staging migration `20261014015410` is applied and catalog-inspected. This does not resolve Supabase generation-safe deletion or prove actual Storage purge timing.

Final local verification for this follow-up: 869 backend tests passed with loopback PostgreSQL/PostgREST and zero skips; Ruff 138, mypy 75, mobile lint and 186 mobile tests passed. Staging function catalog checks passed. `signed_until` is recorded before the provider signing call; the configured Storage client timeout is 15 seconds versus the 15-minute grace, so exact signed-token expiry remains unobserved. No hosted object or signed upload was created.

**Render (OPS-01):** [[Momo Deployment]] now records the prepared Singapore API/worker Blueprint, health path, `PORT`, secret handling and shutdown behavior. The Docker image passed local SDK/OCR and port/readiness smokes. No Render services were created. CORS origin and actual secrets must be set in Render before deploy.

## Verification

- Latest after ECON-01: backend/API/database/gateway **839 passed, zero skipped/errors/failures**; Ruff 138 files and mypy 75 files passed; no-skip checker passed. The run used disposable loopback PostgreSQL and PostgREST and reported 34 existing Starlette 422 deprecation warnings.
- Latest after AI-04 image configuration: backend/API/database/gateway **867 passed, zero skipped/errors/failures** in `/tmp/momo-ai04-image-config.xml`; no-skip checker passed. Ruff 138 files, mypy 75 files and diff check passed. The 34 existing Starlette 422 deprecation warnings remain.
- Mobile lint passed and 186 tests passed. Canvas JSON and `git diff --check` passed.
- Non-root container passed network-isolated Supabase SDK fail-closed and scanned-PDF OCR checks; `/health` and `/ready` returned 200 through Render-style `PORT`.
- Staging Postgres 17 is active. The security advisor reports five INFO no-policy findings on private internal tables with no client grants. The performance advisor reports 14 composite-FK notices; catalog inspection found each child table has a valid leading-column index for parent lookups. Its 44 unused-index notices come from the fresh empty workload; indexes were not dropped.
- Migration 008's DDL was catalog-verified after a duplicate generated migration version; a no-op reconciliation recorded it without replaying DDL. Full record: [[docs/backend-readiness-2026-10-14|staging migration history]].

## Public launch gates

1. Deploy the API/worker to Render with real HTTPS CORS origins and secrets; qualify readiness, drain, monitoring, alerts, cost and capacity.
2. Exercise staging Google login and a bounded two-user API → signed private upload → worker → study-set journey; verify ownership, invalid/expired JWT denial and cleanup.
3. Resolve generation-safe Supabase object deletion and inventory legacy/unregistered objects; prove physical deletion at actual upload time + 72 hours.
4. Verify real Nemotron/embedding configuration, source-only grounded output, safe provider failures and advertised formats.
5. Verify managed Auth profile sync and deletion cleanup after staging migrations 014–017. Correct-answer rewards trust the client-attested result under the approved MVP rule and can be farmed by a modified client; server adjudication remains open. Keep heart regen/refill and XP policy pending. Finish native Android/iOS and offline/reconnect journeys, recovery/rollback, remote CI, release QA, privacy/support/store setup and launch approval.

No production capacity, physical deletion, hosted OAuth, AI quality or public launch claim follows from these local and metadata-only checks.
