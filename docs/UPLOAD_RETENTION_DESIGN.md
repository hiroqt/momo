# Upload retention and orphan cleanup

Status: migrations 012 and 018 and the transactional lifecycle are implemented; migration 018 is applied to staging. RET-01 remains a public-release blocker because no hosted physical deletion timing or full legacy/unregistered inventory has been qualified.

## Retention clock and responsibility

PRD sections1/6.1/7 require original binary expiry at actual upload+72hours. Signing, upload and registration are separate events. Migration002 previously used registration time; migration012 replaces that RPC with a provider-observation clock. Neither signing time nor registration time substitutes for object time.

The server persists an internal ticket before signing. It records verified owner, document UUID, private path, provider/bucket, expected type/size and signing deadline. Signing failure leaves a discoverable ticket. New unticketed registration fails closed. The local mock upload also requires an eligible owned ticket.

Registration verifies provider metadata, then atomically checks ticket ownership/state/lease, consumes quota, inserts the document and accepts immutable upload time/identity/version/ETag. Replay returns the existing document without charging again, but checks expiry and cleanup fencing first. Generation data remains independent of original binaries.

## Cleanup and concurrency

Service-only RPCs claim at most100 due tickets with SKIP LOCKED and120-second leases. Registration, preparation and retirement use the same document advisory-lock order before ticket row locks. Preparation closes registration before physical expiry removal; acknowledgment follows successful removal. Failed deletion leaves the outbox retryable. Null/stale lease tokens cannot acknowledge another worker's work.

Only structured confirmed object absence is absence. Cleanup can inspect empty or oversized objects up to5TiB from metadata without downloading them; registration still rejects files outside1–15MiB. Provider/configuration/metadata failure remains retryable and logs no private provider details. Confirmed absence is recorded for monitoring, while15-minute tombstone probes remain: URL expiry alone cannot prove an already-started transfer will never finish. Tickets retain origin user UUID when the auth reference is cleared; account deletion retires them without cascading away cleanup responsibility. Explicit source retirement marks the source expired and permits immediate original removal; generated sets/items persist.

Accepted source time is immutable. Observing changed/recreated bytes expires the accepted source instead of extending it. Those new bytes receive their own physical age cutoff unless the source/account was explicitly retired. Storage location mismatch fails closed.

## Physical deletion provider gate

A database lease does not fence an in-flight storage request after the lease expires. Automatic deletion must target the observed object generation:

- Local mocks compare full metadata and delete atomically under their storage lock. Identical recreated bytes have a new identity/time and survive a stale deletion.
- S3 automatic deletion requires a non-null VersionId and deletes that specific version. Explicit retirement inventories at most100 versions/delete markers per call and removes only exact-key versions; a truncated batch remains retryable. Cleanup HEAD absence also checks version inventory before acknowledging physical absence. Unversioned S3 fails closed; ETag alone cannot distinguish identical recreated bytes. Approve and verify bucket versioning, noncurrent-version inventory/lifecycle and required IAM before rollout. Privileged rewrites/old versions require inventory rather than an invented clock.
- Supabase's current JavaScript reference documents `remove([{path, versionId}])` for exact object-version deletion, but the pinned Python `storage3` 2.31.0 client exposes only `remove(list[str])` and sends path strings. Current Supabase guidance also says S3 bucket versioning is unsupported. Therefore ordinary 72-hour automatic expiry remains fail-closed: it must not use path-only deletion.
- Explicit document/account retirement follows a separate eventual-cleanup path. New ticket paths are unique, never reissued, and signed with `upsert=false`; migration 018 waits until the recorded two-hour URL deadline plus the user-approved 15-minute grace, revokes older leases, and rechecks eligibility. The worker can then remove that path and retains a tombstone that retries every 15 minutes. Supabase [documents two-hour signed-upload URLs](https://supabase.com/docs/reference/python/storage-from-createsigneduploadurl), [rejects overwrites by default](https://supabase.com/docs/guides/storage/uploads/standard-uploads), and supports deletion through its [Storage remove API](https://supabase.com/docs/guides/storage/management/delete-objects). Its docs do not set a maximum lifetime for an upload already in flight when its token expires. `signed_until` is also recorded before signing completes. Treat this as eventual best-effort purge, not a provider-guaranteed final deletion deadline or proof that bytes cannot briefly reappear. Legacy rows only enter this path when their Supabase `documents` destination is verified; untracked objects remain outside ticket cleanup.

This provider limitation is a release blocker, not proof of completed hosted retention. The current configured storage provider has not been changed.

## Migration and rollout

Apply migrations001–012 in order only on an explicitly selected target. The internal table has forced RLS, no anonymous/authenticated privileges and service-only RPC grants. Service-role server ownership checks remain necessary.

Existing registered records are backfilled as legacy tickets without fabricating their provider/bucket or claiming registration-derived time is actual object upload time. Unknown-origin legacy records are withheld from automatic cleanup and reported as unresolved. Pre-migration unregistered objects require an owned storage inventory; SQL cannot reconstruct them. Prepare a reviewed inventory/backfill and compatibility window, or require re-upload of old unticketed destinations. Never silently delete/reassign inconsistent tenant data or keep an indefinite registration bypass.

The persistent worker runs bounded cleanup and backlog reporting at startup and then every `CLEANUP_INTERVAL_SECONDS` (default 300 seconds). Cleanup claims at most 100 tickets per pass. The Render Blueprint starts this runner; the standalone cleanup command is available for an external scheduler when one is deliberately selected. Local tests verify the runner repeats maintenance at its configured interval. Hosted worker execution, backlog capacity, alert delivery and observed deletion timing still require deployment evidence. Tombstones are intentionally retained; a finite garbage-collection horizon requires evidence of upload-completion bounds.

## Local evidence and remaining proof

The dated [verification report](backend-readiness-2026-10-08.md) records the integrated test counts and commands. Local cases cover delayed registration, ownership/grants, quota rollback, concurrent replay/claim, stale/null leases, missing bytes versus outage, deletion failure, recreation, account deletion outbox and retained study material. PostgreSQL uses disposable loopback fixtures; SDK/storage contract tests do not establish managed Auth/Storage behavior.

Required hosted proof remains separately authorized: metadata and first-write contracts, generation-safe deletion, legacy/unregistered inventory, scheduled physical deletion and observed timing, missed-cleanup alerts, version/lifecycle behavior, measured batch capacity and recovery. See the [tracker](PRODUCTION_READINESS_CHECKLIST.md), [PRD](../ARD_PRD.md) and [recovery runbook](DATABASE_RECOVERY_RUNBOOK.md).

Provider basis: [AWS version deletion documentation](https://docs.aws.amazon.com/AmazonS3/latest/userguide/DeletingObjectVersions.html) confirms that key-only deletion creates a marker and can return404 while bytes remain. The implemented retirement path removes explicit versions instead.
