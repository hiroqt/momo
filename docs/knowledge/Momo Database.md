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
| 020 | Bounded, read-only storage object inventory RPCs for reconciliation; service-role only |
| 021 | Covering indexes for 14 composite owner foreign keys; owner-filtered study-item order query uses its composite index |

Migrations 001–004 were already recorded in `momo-staging`; migrations 005–021 are now applied there. Staging is schema/catalog evidence only: no API or worker was deployed. Migration 008 DDL was catalog-verified after a generated ledger timestamp collision, then its name was recorded with a no-op reconciliation to avoid replaying DDL. Migration 016 (`20261014001721`) activates folder charges while preserving queued free creates. Migration 019 (`20261014101923`) is additive: it preserves 1536-dimensional vectors/RPCs and adds a nullable 2048-dimensional v2 column and fixed-search-path, service-role-only RPCs. Migration 020 adds bounded read-only inventory RPCs. Migration 021 is recorded as `20261015012926` and adds 14 indexes covering staging's owner-composite foreign keys; rollback drops the indexes only. The advisor now reports zero unindexed foreign keys and 58 unused indexes on the empty workload (44 existing plus the 14 new indexes). Staging has zero documents and chunks. Before any deploy to a populated project, count READY/unexpired v1 documents and reindex them with the operator script; v2 retrieval excludes documents not finalized as v2. Never mix model spaces or discard old vectors before v2 coverage is verified. A v1 API rollback after any v2 publication will not retrieve those new v2-only documents. Review backup/restore and worker drain before production migrations, and never delete/reassign inconsistent rows to force success.

October 15 source-of-truth pass: `ARD_PRD.md`, `ARCHITECTURE.md`, and the root setup README now reflect the approved `nvidia/nemotron-3-embed-1b:free` 2048D target, additive v1/v2 rollout, and rollback constraint. This documentation alignment does not verify provider availability, retrieval quality/cost, or production legacy-vector inventory. The existing [[Momo Readiness Map.canvas]] already links this database note, so no graph edge changed.

`publish_document_index` locks the owned document, validates chunks, and atomically replaces the index and marks READY. An invalid chunk rolls back the entire replacement. Duplicate publications keep the first READY index; expired sources cannot publish. Only the service role can call the function. Every application-facing call derives the owner from verified auth. RLS is an additional layer; service-role bypass means repository owner checks remain mandatory.

Current v2 retrieval filters owner, READY state and expiry, bounds results to 50, and omits returned vectors. Migration 013 adds `chat_messages_owner_idx`, `study_items_owner_idx` and partial `upload_tickets_auth_ref_idx` for Auth account deletion and ticket cleanup lookups. Local unforced plans select all three. Migration 021 removes all 14 unindexed composite-FK advisor findings; its new study-item and document-chunk indexes are selected by local owner-filtered query plans. The local rollback/reapply rehearsal removed and restored exactly those 14 indexes while preserving row counts in all 23 tables and every FK definition/validation state; all 14 indexes were valid/ready after reapply. The 58 unused-index notices on staging come from an empty workload and do not justify index removal. The v2 RPC currently exact-scans; pgvector's 2048-dimension `vector` exceeds the 2000-dimension ANN limit. Half-precision HNSW supports up to 4000 dimensions, but retrieval quality and filtered latency must be measured before adding that approximation. Hosted scale/selectivity and hosted rollback remain unverified.

October 15 local ANN probe: `scripts/testing/run_vector_ann_probe.py` builds only temporary data/indexes in the disposable `momo_security_test` database. On 20,000 deterministic synthetic 2048D vectors (100 tenants, 200 vectors each), exact owner-B-tree top-10 took 0.925 ms. A forced global halfvec HNSW scan took 20.6 ms and overlapped the exact top-10 by 1/10 with both `ef_search=40` and 200; when both indexes were available the planner used the owner B-tree plus exact sort. This single synthetic query is a filtered-search pathology signal, not a semantic or production-scale result; do not generalize the recall or latency. No ANN index was added. Keep exact retrieval pending a representative, human-reviewed per-user evaluation and explicit latency/capacity target. Local extension was pgvector 0.8.7; staging is 0.8.2. Supabase documents halfvec HNSW up to 4000 dimensions and iterative filtered scans from pgvector 0.8.0 ([HNSW index guide](https://supabase.com/docs/guides/ai/vector-indexes/hnsw-indexes), [pgvector README](https://github.com/pgvector/pgvector#half-precision-indexing)).

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

## Internal-schema local RLS regression (2026-10-15)

The local PostgreSQL suite now asserts all five internal tables (`background_jobs`, `folder_requests`, `generation_requests`, `rate_limit_events`, `upload_tickets`) exist with RLS enabled and forced. It verifies anon/authenticated cannot use the `internal` schema or access table privileges, `service_role` retains required CRUD, and direct client SELECT/INSERT are denied. Focused `test_postgres_rls.py`: 28 passed with zero skips; Ruff and `git diff --check` pass. This is local catalog/runtime regression evidence only; managed PostgREST two-user/RPC checks and rollback remain open. See [[Momo Public Readiness]] and [[Momo Readiness Map.canvas]].
