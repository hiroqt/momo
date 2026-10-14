---
tags: [momo, storage, retention, security]
audited: 2026-10-14
status: partial
---
# Momo Upload Retention

Migration012 implements durable tickets before signing, atomic registration/quota using actual provider upload time+72h, cleanup leases/tombstones, account/source deletion responsibility and backlog monitoring. Existing registration replay checks expiry and cleanup ownership. New unticketed registration fails closed. Generated study material persists independently. Migrations012–013 are applied on the authorized `momo-staging`; its ticket and app tables were empty at inspection. Migration013 adds a partial `auth_ref` lookup index so Auth deletion cleanup can target live tickets.

Automatic physical deletion must target the observed generation. Local mocks compare metadata atomically; S3 requires a VersionId. Hosted Supabase path-only removal cannot provide that predicate, so automatic expiry fails closed. The storage provider has not been changed. Resolve this provider gate, version/lifecycle policy, legacy and unregistered inventory, scheduler timing and measured capacity before public launch.

Legacy tickets have unverified provider/bucket and historical clocks; they remain visible for explicit inventory/backfill. Confirmed absence is recorded while tombstones retain15-minute probes for late/recreated bytes. Provider outages are never absence.

Read [[docs/UPLOAD_RETENTION_DESIGN|lifecycle and rollout contract]], [[docs/backend-readiness-2026-10-08|October 8 evidence]] and [[docs/backend-readiness-2026-10-14|October 14 staging evidence]]. See [[Momo Database]], [[Momo Durable Jobs and Replays]], [[Momo Backend Security]], [[Momo Database Recovery]], [[Momo Backend Completion 2026-10-14]] and [[Momo Public Readiness]].

Local verification: 830 backend/API/PostgreSQL/PostgREST tests passed with zero skips, 182 mobile tests and lint passed, Ruff/mypy passed, and the non-root container passed SDK and two-page OCR checks. Focused ticket/gateway checks cover SDK RPC contracts. Staging metadata verifies schema and private bucket configuration, not hosted upload or physical deletion. These checks do not prove managed physical deletion timing.
