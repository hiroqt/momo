---
tags: [momo, backend, auth, database, deployment, release-blocker]
audited: 2026-10-14
status: public-release-blocked
---
# Momo Backend Completion — 2026-10-14

Parent: [[Momo Public Readiness]]. Map: [[Momo Readiness Map.canvas]]. Full evidence: [[docs/backend-readiness-2026-10-14|dated backend report]]. Task ownership and acceptance: [[docs/PRODUCTION_READINESS_CHECKLIST|Production Readiness Checklist]].

## Decisions

- Login is Google OAuth only. Supabase Auth verifies the active Google account at sign-in; the API validates the signed Supabase JWT on each request. The user selected no live Google recheck per request.
- The user authorized resuming and applying database migrations to `momo-staging`, reported Google OAuth configured there, and selected Render for host preparation.
- `momo-prod` was not queried or changed. No staging API/worker deployment, hosted Google sign-in, object upload, AI-provider call, or hosted load test was performed.

## Completed by module

**Auth (AUTH-01):** `backend/app/dependencies.py` checks token signature/algorithm, configured issuer and audience, expiry, authenticated role and UUID subject. It accepts only signed Google provider and OAuth-method claims. Anonymous, password and non-Google identities fail. The API does not make an Auth service request on each call. Tests cover provider rejection. A real Google login, token refresh and device redirect remain unverified.

**Database (ENV-02):** staging migration ledger contains 001–013. All 20 `public` and `internal` application tables have forced RLS. Anonymous has no app-table reads, authenticated has no direct writes, and internal tables have no client grants. The private `documents` bucket has a 15 MiB cap and PDF/DOCX/TXT/PPTX allow-list. No app or queue rows were present. Migration 013 adds auth-deletion/retirement lookup indexes for chat messages, study items and upload tickets; local unforced plans selected them on synthetic data.

**Jobs/storage (WORK-02, RET-01):** durable jobs, request replay, bounded recovery and upload tickets are applied in staging and tested locally. Supabase automatic object deletion is still fail-closed because path removal is not tied to an object generation. Legacy/unregistered object inventory and physical 72-hour deletion proof remain release blockers.

**Render (OPS-01):** [[Momo Deployment]] now records the prepared Singapore API/worker Blueprint, health path, `PORT`, secret handling and shutdown behavior. The Docker image passed local SDK/OCR and port/readiness smokes. No Render services were created. CORS origin and actual secrets must be set in Render before deploy.

## Verification

- Backend/API/database/gateway: 819 passed, zero skipped; Ruff 138 files and mypy 75 files passed.
- Mobile lint passed; 181 mobile tests passed.
- Non-root container passed network-isolated Supabase SDK fail-closed and scanned-PDF OCR checks; `/health` and `/ready` returned 200 through Render-style `PORT`.
- Staging Postgres 17 is active. The security advisor reports five INFO no-policy findings on private internal tables with no client grants. The performance advisor reports 14 composite-FK notices; catalog inspection found each child table has a valid leading-column index for parent lookups. Its 43 unused-index notices come from the fresh empty workload; indexes were not dropped.
- Migration 008's DDL was catalog-verified after a duplicate generated migration version; a no-op reconciliation recorded it without replaying DDL. Full record: [[docs/backend-readiness-2026-10-14|staging migration history]].

## Public launch gates

1. Deploy the API/worker to Render with real HTTPS CORS origins and secrets; qualify readiness, drain, monitoring, alerts, cost and capacity.
2. Exercise staging Google login and a bounded two-user API → signed private upload → worker → study-set journey; verify ownership, invalid/expired JWT denial and cleanup.
3. Resolve generation-safe Supabase object deletion and inventory legacy/unregistered objects; prove physical deletion at actual upload time + 72 hours.
4. Verify real Nemotron/embedding configuration, source-only grounded output, safe provider failures and advertised formats.
5. Finish profile/account lifecycle, native Android/iOS and offline/reconnect journeys, recovery/rollback, remote CI, economy policy, release QA, privacy/support/store setup and launch approval.

No production capacity, physical deletion, hosted OAuth, AI quality or public launch claim follows from these local and metadata-only checks.
