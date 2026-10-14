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
| 014 | Google-only Auth profile synchronization and backfill |
| 015 | Verified legacy storage destination and cleanup lookup |
| 016 | Atomic progressive folder charges integrated with durable request replay |
| 017 | Transactional +1 credit for newly accepted client-attested correct-answer sync |
| 018 | Delay retired upload purge until the approved 2h15 expiry fence and retry tombstone |
| 019 | Additive 2048-dimensional embedding v2 column and service-only publish/reindex/retrieval RPCs; preserves v1 |

Migrations 001–004 were already recorded in `momo-staging`; migrations 005–019 are now applied there. Staging is schema/catalog evidence only: no API or worker was deployed. Migration 008 DDL was catalog-verified after a generated ledger timestamp collision, then its name was recorded with a no-op reconciliation to avoid replaying DDL. Migration 016 (`20261014001721`) activates folder charges while preserving queued free creates. Migration 019 (`20261014101923`) is additive: it preserves 1536-dimensional vectors/RPCs and adds a nullable 2048-dimensional v2 column and fixed-search-path, service-role-only RPCs. Staging has zero documents and chunks. Before any deploy to a populated project, count READY/unexpired v1 documents and reindex them with the operator script; never mix model spaces or discard old vectors before v2 coverage is verified. A v1 API rollback after any v2 publication will not retrieve those new v2-only documents. Review backup/restore and worker drain before production migrations, and never delete/reassign inconsistent rows to force success.

`publish_document_index` locks the owned document, validates chunks, and atomically replaces the index and marks READY. An invalid chunk rolls back the entire replacement. Duplicate publications keep the first READY index; expired sources cannot publish. Only the service role can call the function. Every application-facing call derives the owner from verified auth. RLS is an additional layer; service-role bypass means repository owner checks remain mandatory.

Current v2 retrieval filters owner, READY state and expiry, bounds results to 50, and omits returned vectors. Migration 013 adds `chat_messages_owner_idx`, `study_items_owner_idx` and partial `upload_tickets_auth_ref_idx` for Auth account deletion and ticket cleanup lookups. Local unforced plans select all three. Staging's 14 remaining composite-FK advisor notices each have a valid index beginning with the FK's first ID column; 44 unused-index notices are from the fresh, empty workload and do not justify index removal. The v2 RPC currently exact-scans; pgvector's 2048-dimension `vector` exceeds the 2000-dimension ANN limit. Half-precision HNSW supports up to 4000 dimensions, but retrieval quality and filtered latency must be measured before adding that approximation. Hosted scale/selectivity remain unverified.

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
