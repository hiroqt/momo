# Local Backend Verification

All performance and security tests run locally. Python sockets are denied during
tests, provider credentials are replaced before collection, and legacy feature
tests use scoped FastAPI dependency injection for identity. Authentication tests
exercise the real verifier separately. No production authentication bypass is
enabled by the test suite.

From the repository root:

```sh
uv run --project backend pytest backend/tests -q
```

For real SQL, pgvector, RLS and RPC verification, create a disposable PostgreSQL
database named `momo_security_test`, with a PostgreSQL superuser and pgvector.
The supplied Docker Compose service binds only to loopback and stores data in
memory. It requires an available Docker daemon and `psql` on the host.

```sh
docker compose -f scripts/testing/compose.yml up -d --wait
LOCAL_TEST_DATABASE_URL=postgresql://postgres:local-test-only@127.0.0.1:55432/momo_security_test uv run --project backend pytest backend/tests -q
docker compose -f scripts/testing/compose.yml down
```

The integration fixture resets `public` and `auth` schemas **only** in that
dedicated database. It rejects hosted URLs, DNS hostnames (including localhost),
connection-option query strings and alternate database names before invoking
`psql`. Existing PostgreSQL connection environment variables are removed. A
minimal local `auth.users`, `auth.uid()` and role fixture reproduces the database
authorization contract; this does not exercise Supabase's hosted Auth, Storage
service or PostgREST gateway.

Coverage includes real migrations, RLS on every public application table,
two-user read isolation, anonymous denial, authenticated write/RPC denial,
cross-tenant relationship constraints, derived item ownership, persistent study
material after document deletion, atomic quota under concurrent registration,
retry idempotency, rollback on invalid input, scoped sync duplicate handling,
missing/mismatched references, bounded vector retrieval, expired sources and
the owner/order query index. Grants and fixed RPC search paths are checked from
the PostgreSQL catalog. A Storage schema fixture supplies an existing broad
policy to verify that the new restrictive policies prevent cross-user access
and direct document writes while preserving access to unrelated buckets.
Generation finalization tests run 12 concurrent retries against one job and
verify one persistent set, complete rollback on invalid items, clean retry,
cross-owner denial and direct-client RPC rejection.

Local API tests exercise owner CRUD/session flows, cross-user denial, validation
redaction and sync retry side effects. Workloads run 500 requests at concurrency
32 and 1,500 requests at concurrency 128 with a 30-second deadline:

```sh
uv run --project backend pytest backend/tests/test_local_workloads.py -q -s
```

These ASGI/in-memory measurements are smoke checks for errors and tenant leakage,
not production capacity estimates. Local PostgreSQL tests additionally run 100
queries at concurrency 8 and 300 at concurrency 16, checking real RLS on every
query with a 30-second deadline. Their latency includes starting `psql` processes.
Concurrent SQL registration independently exercises real row contention. No test invokes hosted Supabase, external AI,
storage or embedding services; provider HTTP traffic fails immediately. Initial
dependency/container downloads can use the internet but do not use Supabase
egress. The tester-army/e2e framework was considered; pytest, HTTPX ASGI and real
local PostgreSQL are a better fit for these backend authorization/query checks.
