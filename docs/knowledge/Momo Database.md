---
tags: [momo, database, transactions]
---
# Momo Database

Parent: [[Momo Public Readiness]]. Related: [[Momo Authentication]], [[Momo Deployment]].

## Ordered schema

| Migration | Purpose |
| --- | --- |
| 001 | Initial tables/vector schema |
| 002 | Auth identity, forced tenant RLS, composite ownership, transactional quota/sync/generation, private storage and query indexes |
| 003 | Atomic chat imports/decks |
| 004 | Vector extension schema compatibility |
| 005 | Server economy ledger and transactional spends |
| 006 | Durable job leases/retries, shared rate limits and terminal document status guards |
| 007 | Atomic complete document-index publication and READY-only retrieval |
| 008 | Owner-scoped generation request replay and authorized retry dispatch |
| 009 | Lifetime budget for automatic orphan recovery |
| 010 | Owner-scoped folder replay and deletion tombstones |
| 011 | Atomic explicit retry authorization and queue reset |
| 012 | Durable upload tickets, actual-upload registration clock and cleanup outbox |
| 013 | Auth-deletion and ticket-retirement lookup indexes |

Migrations 001–004 were already recorded in `momo-staging`; user-authorized migrations 005–013 are now applied there. Staging is schema/catalog evidence only: no API or worker was deployed. Migration 008 DDL was catalog-verified after a generated ledger timestamp collision, then its name was recorded with a no-op reconciliation to avoid replaying DDL. Before a future production rollout, review migration002 existing-data validation, source-to-ledger parity, backup/restore and the worker drain window; never delete/reassign inconsistent rows to force success.

`publish_document_index` locks the owned document, validates chunks, and atomically replaces the index and marks READY. An invalid chunk rolls back the entire replacement. Duplicate publications keep the first READY index; expired sources cannot publish. Only the service role can call the function. Every application-facing call derives the owner from verified auth. RLS is an additional layer; service-role bypass means repository owner checks remain mandatory.

Current retrieval filters owner, READY state and expiry, bounds results to 50, and omits returned vectors. Migration 013 adds `chat_messages_owner_idx`, `study_items_owner_idx` and partial `upload_tickets_auth_ref_idx` for Auth account deletion and ticket cleanup lookups. Local unforced plans select all three. Staging's 14 remaining composite-FK advisor notices each have a valid index beginning with the FK's first ID column; 43 unused-index notices are from the fresh, empty workload and do not justify index removal. Hosted scale/selectivity and semantic relevance still need representative evidence. Exact vector scanning at scale needs a measured plan before choosing HNSW/IVFFlat and accounting for tenant/expiry filtering.

WORK-02 server request replay and recovery budgets have local implementation and tests. Mobile request keys/receipts persist in account-partitioned SQLite with local restart/real-JWT HTTP proof. Remaining: native navigation, deployment and managed worker failure journeys. ENV-02 now has staging migrations, grants, RLS and advisor inspection; managed PostgREST two-user proof remains. OPS-02 still needs managed restore/owner isolation, approved recovery objectives and app/migration rollback.

## Measured local access patterns

20 synthetic tenants with4,000 sets/20,000 items/20,000 chunks selected the existing
owner/order indexes under unforced EXPLAIN ANALYZE/BUFFERS. Library/items/chunks
returned50/5/100 rows with3/10/102 shared blocks. Migration013's three owner-only
lookups each selected their index with1,000 rows per owner (17/25/36 shared blocks).
See [[docs/backend-readiness-2026-10-08|October 8 report]] and
[[docs/backend-readiness-2026-10-14|October 14 report]]; these samples do not
establish production capacity or vector quality.

Local synthetic restore now checks persistent material, tenant security and preserved expiry. Read [[Momo Database Recovery]] for evidence limits and remaining recovery decisions.
