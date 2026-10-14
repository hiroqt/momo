# Database recovery preparation

Status: local synthetic restore verified; managed recovery and application rollback unverified. Owner: release/database lead. Task: OPS-02; release dependencies ENV-02 and OPS-01 remain open. This does not authorize hosted backup, restore or migration actions.

## Local drill

Use the isolated gateway stack and commands in [local verification](../scripts/testing/README.md). Run `tests/test_database_restore.py` with `LOCAL_TEST_DATABASE_URL` selecting only the dedicated loopback `momo_security_test` database. The test fixture resets only that disposable source; never point it at application data.

The drill creates a random target database exclusively. If creation fails, it does not overwrite or remove the existing target. A private custom-format archive is created with mode0600 before pg_dump writes it. pg_restore restores only into the newly created target, failing on errors. Assertions verify persistent generated sets/items, completed finalization replay, owner/foreign/anonymous access, client-write denial, service-only grants, forced RLS and preserved expired-source timestamps. Deleting the restored source leaves study items usable. Source records remain unaffected. The test cleans its target and archive in finally, including failure paths.

This drill shares the disposable cluster's global roles and pgvector binaries. It does not prove new-cluster role provisioning, managed snapshot/PITR support, encryption/access policy, recovery targets or the behavior of a deployed app/worker after cutover.

## Retention and data boundaries

Original object bytes are not included in the PostgreSQL backup. Database snapshots can contain document metadata, private object references, source-derived chunks, generated material and account references. Treat archives as private data; restore must preserve the original expires_at, never reset it to the restore timestamp. Expired originals must remain unavailable. Do not point a rehearsal at live object paths or run physical cleanup against shared storage.

Before managed backup use, select archive access/encryption/retention policy and determine how source-derived text, account deletion and metadata are handled in backups. The 72-hour original-file policy continues to apply independently of database recovery. The local test proves historical metadata and persistent study content behavior, not physical hosted deletion or backup-retention compliance.

## Required managed recovery decisions and evidence

1. Select the exact source project, isolated target and authorized operator. Record schema/app/worker/image versions and migration checksums. Scope credentials to the approved environment.
2. Approve recoverable data-loss and recovery-time objectives (RPO/RTO), backup schedule, retention, encryption/access controls and restore frequency. No numeric targets are assumed here.
3. Validate target roles, extension versions, RLS, grants, JWT issuer/audience and object-store boundaries before traffic. Run synthetic two-user/anonymous/service checks through the actual managed gateway.
4. Measure restore duration and recoverable transaction boundary; compare to approved objectives. Verify persisted study material, original expiry, orphan/cleanup backlog, idempotent jobs/sync and profile/account lifecycle.
5. Rehearse app/worker cutover, dependency failures, lease recovery and controlled rollback in an approved staging environment. Monitor queue/dead-letter/retention and explain any data divergence.
6. Record reviewed artifacts, operator ownership, exact commands/outcomes, failures and recovery actions. Obtain the concrete release decision before changing traffic.

## Schema/application rollback boundary

Migrations 001–016 are forward migrations. No general down-migration or arbitrary schema rewind is qualified. Do not roll an application/worker back to an older image while assuming compatibility with the newer RPC/data contract. The older recovery image also predates the SDK client-options startup fix.

The current-schema local restore proves that the existing finalization RPC remains callable and idempotent with restored generated data. A release must separately review backward read/write/RPC compatibility for its selected old/new app and worker revisions. Prefer an explicitly reviewed forward repair or an approved isolated restore/cutover plan when a change cannot be reversed without data loss. Do not delete/reassign inconsistent tenant records to make rollback work.

See [readiness tracker](PRODUCTION_READINESS_CHECKLIST.md), [October14 evidence](backend-readiness-2026-10-14.md), [October8 history](backend-readiness-2026-10-08.md) and [security boundaries](BACKEND_DATABASE_SECURITY.md).
