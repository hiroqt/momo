---
tags: [momo, database, recovery, operations]
audited: 2026-10-14
status: local-preparation
---
# Momo Database Recovery

OPS-02 local drill restores synthetic persistent study material into an exclusively created target database. Owner/foreign/anonymous access, direct-write denial, service-only grants and forced RLS are checked after restore. Expired-source timestamps remain historical; completed finalization replays and deleting restored sources preserve study items. Task-owned archive/target cleanup is bounded and runs on failures. The focused restore test passed in the October 14 committed backend pass.

The target shares global roles and extension binaries with the disposable source cluster. This proves selected local restore invariants, not managed backups, new-cluster recovery, RPO/RTO or app/worker rollback.

Original file bytes are outside PostgreSQL. Archives can still contain metadata, source-derived chunks, generated material and account references. Retention/access/encryption and deletion handling for backups need explicit decisions. Restoring metadata must never extend original expiry; rehearsal cleanup must not target shared object paths.

Staging now records ordered migrations 001–019; metadata verification does not establish a managed restore or rollback. Forward migrations do not imply a safe schema downgrade. Read [[docs/DATABASE_RECOVERY_RUNBOOK|recovery runbook]] for commands, required decisions and compatibility boundaries. See [[Momo Database]], [[Momo Deployment]], [[Momo Durable Jobs and Replays]], [[docs/backend-readiness-2026-10-14|October 14 evidence]] and [[Momo Public Readiness]]. Managed backup integrity, new-cluster recovery, RPO/RTO, migration rollback and app/worker rollback remain release gates.
