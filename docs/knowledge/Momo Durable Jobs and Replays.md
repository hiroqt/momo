---
tags: [momo, backend, jobs, idempotency]
---
# Momo Durable Jobs and Replays

Parent: [[Momo Public Readiness]]. Related: [[Momo Database]], [[Momo Backend Security]], [[Momo Deployment]].

## What a request key means

A key identifies one user action. Persist it before sending and reuse the same key/details after a timeout or lost response. A new intentional action needs a new key. The backend scopes each key to the cryptographically verified owner; it never accepts a client user ID as authority.

- Generation create: one key produces one job. Replays return its actual status; changed settings conflict. Failed generations require the explicit retry endpoint. Existing completed jobs can be replayed after original source expiry; a fresh job requires READY/unexpired evidence.
- Folder create: one key produces one folder. A rename does not change that identity. A deletion leaves a request tombstone so an old offline request cannot recreate the folder. Changed payloads conflict. Migration 016 atomically charges the approved PRD price and records the replay; old queued free creates replay free. Wallets start at zero. The user approved +1 credit for each newly accepted client-attested correct-answer sync event, implemented by migration 017; this is currently the server earning path. A modified client can fake correctness under this MVP rule, and hosted earning/purchase remain unverified until the API is deployed.
- Calls without keys retain independent-create compatibility. The mobile generation flow now persists validated intent/key/receipt before send/navigation, restores unfinished work and acknowledges after an owned status GET. Native journey verification remains open. Folder mutation sync already sends its stable key.

## Embedding model transition

Migration 019 adds `embedding_v2` at 2048 dimensions and leaves the old 1536 column/RPCs intact. New ingestion publishes only v2 and tags the document version; retrieval ignores version-1 documents until their retained chunk text has been re-embedded. `backend/scripts/reindex_embeddings_v2.py` defaults to a count-only dry run, caps each execution, pages documents/chunks, embeds in batches of 64, and switches each document only after every v2 vector is present. Execute only with the approved staging environment/model; no hosted document data has been reindexed. Before deploying to a populated project, run the inventory and reindex, verify there are no READY/unexpired v1 rows, then deploy the v2 API. If reindex stops, that document remains on v1 and hidden from v2 retrieval until a retry succeeds. After v2 ingestion, rolling back to the old API loses retrieval for those new documents until they are re-embedded to an old compatible model. Migration 019 preserves both vector sets, so the data can be recovered.

## Bounded recovery

Queue jobs have ordinary worker attempt limits plus a lifetime automatic-orphan recovery counter. Active jobs do not consume the recovery batch. The counter is capped by the job's original configured max_attempts; later scheduler settings cannot increase it. At exhaustion the queue dead-letters and the incomplete subject fails safely. Expired, failed and completed subjects cannot be automatically revived.

A manual retry is a distinct authorized state transition, not an automatic reset after every replay. Dispatch authorization must be consumed transactionally with the queue reset; otherwise delayed requests can act on stale authorization. The continuation verification report records the final concurrency regression and its status.

## Evidence and open gates

[[docs/backend-readiness-2026-10-08|October 8 report]] and [[docs/PRODUCTION_READINESS_CHECKLIST|tracker]] contain exact local results. [[docs/API_CONTRACT_MATRIX|API contracts]] describe key alphabets, compatibility and safe conflict codes. Real PostgreSQL tests cover races, owner/client denial, rollback, recovery fairness and expiry. 178 mobile tests and a real-JWT loopback HTTP/file-SQLite replay smoke (8 invariant groups) cover client intent adoption, account isolation and restart receipts. Managed PostgREST, worker process kills/restarts and native navigation/Expo SQLite journeys remain open.

## Actual local Python worker recovery

SIGKILL after claim and after atomic generation publication before queue acknowledgment
now has local subprocess proof against PostgreSQL: restart yields a succeeded queue
with exactly one set/item; a completed job skips regeneration. Owner isolation and
retention after deleting the source pass.718 backend tests are green. The fixture
uses actual runner/queue/repository, deterministic content and a psql gateway adapter.
Real PostgREST/provider operation and document-ingestion process recovery remain open;
see [[docs/backend-readiness-2026-10-08|verification report]].

## Actual local TXT ingestion recovery

Four additional worker-process cases verify real TXT validation/SHA256/extraction/
chunking/local embeddings/publication across SIGKILL before/after indexing and
source deletion. Restart replaces partial indexes, reuses READY chunks without
fetching removed fixture bytes and cannot resurrect deleted sources.722 backend
tests pass. Storage is task-owned file data and gateway is psql; actual local
SDK/PostgREST, hosted storage/providers and OCR recovery remain open. Details in
[[docs/backend-readiness-2026-10-08|report]].

## Actual local SDK/gateway proof

Six process cases now pass in both psql and actual SupabaseSession/SDK/PostgREST
HTTP modes. Signed-user ownership/grant/signature checks pass;729 backend tests,
zero skips/failures. A real SDK startup defect was fixed using SyncClientOptions.
CI source now requires the local gateway. Managed Supabase Auth/Storage, actual AI
providers and native/deployed operation remain separate gates. Reproduce via
[[scripts/testing/README|local verification instructions]]; see
[[docs/backend-readiness-2026-10-08|report]] for image and review evidence.

## October 14 backend completion

The ordered schema through migrations 001–019 is applied to `momo-staging`.
Current generation replay, bounded orphan recovery, folder replay, atomic chunk
publication and generation finalization paths have local SQL/API/process tests;
the mobile generation flow persists and reuses its action key. The backend still
allows unkeyed generation requests for older-client compatibility, so those
requests create independent jobs. The latest full local PostgreSQL/PostgREST
gateway suite passes 868 tests with zero skips. Hosted API/worker execution,
native process/navigation recovery, provider calls and real-account replay remain
unverified. [[Momo Database Recovery]] records the local restore boundary; the
October 14 tracker records current ownership and exact gates.
