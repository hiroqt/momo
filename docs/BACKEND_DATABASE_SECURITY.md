# Backend And Database Security Report

Date: October 6, 2026. Scope: local preparation for a new Momo Supabase project.
No existing hosted project was modified. Supabase MCP was used to discover the
connected projects and consult current documentation; the user selected a new
local preparation rather than any of those projects.

## Agent Report Cards

| Agent | Responsibility | Delivered | Verification |
| --- | --- | --- | --- |
| Database | Schema, tenant integrity, RLS, queries | Ordered migration 002, Supabase Auth ownership, forced owner-read RLS, client write denial, composite ownership FKs, indexes, private upload bucket, quota/sync/learning/aggregate/retrieval/finalization RPCs | PASS: 22 real PostgreSQL integration tests, including concurrent finalization, rollback, grants, RLS and storage boundaries |
| Backend | Auth, connection lifecycle, repositories | Verified JWT claims and signatures, explicit local modes, cancellation-safe bounded SDK I/O, fail-closed persistence, repository ownership checks, atomic generation/sync analytics, pagination and database aggregates, safe errors | PASS: 37 focused security/pipeline checks; full regression suite, scoped Ruff and mypy checks |
| Testing | E2E/API, queries, load and stress | Network-denied pytest fixtures, API tenancy and lifecycle checks, real PostgreSQL policy/RPC integration, ASGI and SQL workloads, loopback-only guard, disposable Docker recipe | PASS: 181 combined backend tests; 2,000 ASGI requests and 400 SQL queries without errors or observed tenant leakage; zero hosted test traffic |
| Primary/integration | Storage, integrity, lifecycle, docs and review | Missing-object/provider failure rejection, actual byte/size/archive/page checks, SHA-256 persistence, bounded expiration worker, provider error redaction, mobile pagination compatibility, aligned governing/setup/security docs | PASS: 19 storage/cleanup/privacy checks; 181 combined backend tests, 67 mobile tests, TypeScript check, scoped Ruff/mypy and whitespace review |

## Combined Result

The backend no longer accepts unsigned JWTs or silently swaps failed live writes
into memory. Authentication derives identity from verified Supabase tokens.
Tenant relationships are constrained in PostgreSQL, so elevated backend writes
cannot link one user's records to another user's parents. Clients cannot mutate
quota counters, generated content, or sync history directly through the Data API.

The shared server client reuses HTTP connections, bounds concurrent SDK queries,
and moves blocking calls off the event loop. Database transactions enforce the
monthly cap, idempotent offline events, and corresponding learning updates.
Validated generation items, their study set, and job completion commit in one
idempotent transaction; retries return the existing set. Late workers cannot
downgrade completed jobs. Query permits remain held during request cancellation
until the SDK call finishes, preventing cancellation from exceeding concurrency.
Folder counts, learning summaries, activity dates and top-ranked source evidence
are computed in PostgreSQL to reduce returned data. Retrieval returns bounded
evidence, without embedding arrays, filtered by owner, document, and expiration.

`content_sha256` hashes uploaded bytes for internal integrity checks. It does
not encrypt study text, hide document content, or grant authorization. There is
no public hash lookup or global duplicate oracle. Passwords remain managed by
Supabase Auth; provider credentials remain in backend environment variables.

## Verification Evidence

Final parent verification: **181 backend tests passed, zero skipped**, including
22 real PostgreSQL tests, in 11.47 seconds. One existing Starlette HTTP422 constant
deprecation warning remains. **67 mobile tests passed**, including four pagination
checks, and `npm run lint` (TypeScript) passed. Changed backend security modules
passed scoped Ruff and mypy (`--check-untyped-defs --follow-imports skip
--ignore-missing-imports`); this is not a claim of strict whole-repository typing.
The final combined mypy check covered 32 source files. The temporary PostgreSQL
instance was stopped after verification; the reproduction recipe is retained.
`git diff --check` passed. No credentials, caches, or generated runtime files are
included in the committed changes. The implementation is organized as separate
database, backend, testing, mobile compatibility, and documentation commits on
`main`. No hosted deployment or remote push was performed.

| Workload | Requests / concurrency | Observed elapsed | Observed p95 |
| --- | --- | --- | --- |
| ASGI memory API load | 500 / 32 | 0.223 s | 0.483 ms |
| ASGI memory API stress | 1,500 / 128 | 0.688 s | 0.531 ms |
| Local PostgreSQL query load | 100 / 8 | 0.562 s | 53.983 ms |
| Local PostgreSQL query stress | 300 / 16 | 1.917 s | 163.692 ms |

Measurements vary by run. ASGI tests inject test identities and use memory
repositories. SQL timings include one `psql` process per request. These workloads
check bounded concurrency and tenant correctness; they do not measure managed
Supabase throughput, real TLS/network latency, or production worker capacity.

Coverage includes unsigned/expired/wrong-audience/wrong-issuer tokens, production
mock-mode rejection, cross-user reads/deletes/inserts/references, anonymous and
authenticated grants, service-only RPC execution and fixed search paths,
concurrent quota acceptance, retry idempotency, invalid-write quota rollback,
duplicate/changed sync events, atomic learning persistence, restricted storage
despite an existing broad policy, expired source filtering, vector result limits,
indexed listing plans, concurrent generation finalization and rollback,
source deletion persistence, malformed bytes, archive
expansion, safe error output, and cleanup retryability.

See [backend setup](../backend/README.md) for commands. Without
`LOCAL_TEST_DATABASE_URL`, PostgreSQL tests skip. The integration fixture resets
schemas only in a loopback database named `momo_security_test`; it rejects hosted
IPs, URLs with connection query options, and other database names. Test fixtures
override provider configuration before application imports and deny sockets.

[tester-army/e2e](https://github.com/tester-army/e2e) was evaluated. It focuses on
agent-driven web/mobile interactions. This backend/database task uses deterministic
pytest/httpx/SQL assertions; no model-driven test dependency was added.

Document, study-set, folder and chat-session listings accept `limit` (1..100)
and `offset` (0..100000), preserving their array response shape. Mobile list
helpers fetch successive pages and reject failures rather than returning partial
libraries. Concurrent changes can shift offset pages; a stable snapshot/cursor
contract remains a possible future improvement for very large active libraries.

## Deployment And Remaining Limits

1. Create/select the new Momo Supabase project, configure Google Auth and server
   secrets, and apply migrations 001 then 002 using Supabase MCP. Check security
   and performance advisors afterward. Do not apply these to unrelated projects.
2. For an existing database, audit invalid/orphaned ownership and duplicate chunks
   before migration. Validation aborts the transaction on inconsistent historical
   rows; no records are silently discarded. Migration 002 is versioned, not a
   repeatedly runnable reset script. Review locks/index build time on large data.
3. Configure HTTPS, the real JWT issuer/audience, explicit CORS origins, private
   storage and backup/access procedures. Service-role keys bypass RLS; server
   ownership filters and key isolation remain necessary. Demo clients must use
   real Supabase Google sessions for a hosted rollout; dummy tokens are rejected.
4. Schedule `python -m app.workers.cleanup_worker` at least every five minutes and
   monitor overdue expirations. It removes at most 100 originals per invocation,
   marking EXPIRED only after successful deletion. Adjust scheduling capacity to
   volume; S3 lifecycle is an additional backstop. Generated material is retained.
5. Existing document/generation jobs and rate limiting are process-local. Durable
   job dispatch, recovery, shared rate-limit state and multi-replica deployment
   tests remain operational requirements. These were not replaced in this change.
6. Managed Auth/Storage and PostgREST transport need a bounded deployment smoke
   test. Local PostgreSQL uses compatible auth/storage fixtures, not managed
   Supabase services. No hosted load/stress test should be run. Exact scoped
   vector retrieval should be benchmarked before adding ANN indexes.

This work strengthens the implementation and verifies the listed boundaries; it
does not assert that all possible information leaks or production failure modes
are impossible.

References: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security),
[RLS performance](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv).

## Subsequent Delivery Update

The five implementation commits were subsequently pushed to GitHub `main`, with
documentation head `896d534`. The push-protection finding in a guardrail fixture
was resolved using generated synthetic test data; its seven tests passed.
This did not deploy a Supabase project or rerun the entire test suite.

The later source audit and canonical remaining work are recorded in
[Production Readiness Checklist](PRODUCTION_READINESS_CHECKLIST.md), dated
October 6, 2026. It distinguishes the verified generation-job/security boundaries
above from unresolved chat/grounding, client identity, offline persistence and
release requirements. The original validation counts remain historical evidence.
