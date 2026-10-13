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

The port is configurable for parallel, isolated stacks (any loopback port is
accepted; host, scheme, query options and database name are still enforced):

```sh
MOMO_TEST_PG_PORT=55435 docker compose -p momo-team-d -f scripts/testing/compose.yml up -d --wait
# or a one-off container:
docker run -d --rm --name momo-team-d-pg -e POSTGRES_PASSWORD=local-test-only \
  -e POSTGRES_DB=momo_security_test -p 127.0.0.1:55435:5432 \
  --tmpfs /var/lib/postgresql/data pgvector/pgvector:pg16
LOCAL_TEST_DATABASE_URL=postgresql://postgres:local-test-only@127.0.0.1:55435/momo_security_test \
  uv run --locked --project backend pytest backend/tests -q
```

Set `REQUIRE_PG_INTEGRATION=1` to make a missing database a failure instead of a
skip (CI does this and additionally rejects any skipped test via
`assert_no_skips.py`). Static checks: from `backend/`, run
`uv run --locked python ../scripts/testing/static_checks.py` (Ruff + mypy over
all files except the shrinking legacy list in `static_check_exclusions.txt`, empty since
2026-10-06). The same pinned tools run directly: `uv run --project backend ruff check backend`
and, from `backend/`, `uv run mypy` (configured in `pyproject.toml`).

Environment separation: every command here uses `APP_ENV=test` with loopback
targets only. `momo-staging` accepts only bounded synthetic smoke checks (never
load/stress), and `momo-prod` receives no test traffic. Neither hosted project
is reachable from the test suite: sockets are blocked, configuration rejects
hosted refs/URLs in local/test, and the SQL fixture accepts loopback IPs only.

Durable jobs and shared rate limits (migration 006) are covered by
`test_job_queue.py` (memory-mode semantics, runner leases/heartbeats/retries,
API dispatch), `test_durable_jobs_postgres.py` (real `FOR UPDATE SKIP LOCKED`
claims across 8 concurrent workers, SIGKILLed lock holder, expired-lease
recovery and dead-lettering, owner-only completion, READY/EXPIRED downgrade
guard, orphan recovery, 24 concurrent rate-limit calls across connections) and
`test_shared_rate_limits.py` (replica/restart sharing, fail-closed 503,
upload/registration limits, forwarded-header spoofing).

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

October 8 continuation suites (same disposable local database and `REQUIRE_PG_INTEGRATION=1`):
`test_generation_request_idempotency.py`, `test_bounded_orphan_recovery.py` and
`test_folder_request_replay.py` cover owner-key replay, terminal/expiry handling,
recovery lifetime budgets, SQL lock-order concurrency and deletion tombstones.
The fixture applies every ordered migration from `backend/migrations/`, not just
001–006. Client keys must be retained across retries; tests of server replay alone
do not establish native request persistence or hosted PostgREST readiness.

### Local mobile generation replay against real JWT/HTTP

Start the loopback-only fixture from repository root (use a fresh private config
path; exclusive creation refuses existing files):

```sh
uv run --locked --project backend python scripts/testing/generation_replay_server.py --config /tmp/momo-generation-replay-local.json --port 58041
```

Then in another terminal from `mobile/`:

```sh
./node_modules/.bin/tsx ../scripts/testing/mobile_generation_replay.ts /tmp/momo-generation-replay-local.json
```

Stop the fixture with Ctrl-C afterward; its lifespan removes the private synthetic
JWT configuration. The TypeScript runner cleans its file-SQLite fixture. Do not
print configuration contents or reuse hosted tokens. The fixture verifies actual
JWT authentication, disables workers/dev auth, uses backend memory and rejects
external sockets; the mobile runner permits only its exact loopback origin.
Expected: PASS,8 invariant groups,4 POSTs. Covers lost successful response +SQLite
reopen/same job, received receipt/no POST, owned GET/ack/fresh intent, second-owner
denial. This is not native Expo navigation, PostgreSQL worker recovery, generated
content or hosted readiness evidence.

### Actual Python worker crash boundaries and unforced query plans

`test_worker_process_recovery.py` starts the actual `JobRunner`, `JobQueue`,
`handle_study_generation` and `GenerationRepository` in child Python processes.
A test-only psql adapter replaces PostgREST transport; a deterministic processor
replaces external model generation. The parent SIGKILLs after claim or atomic
publication, advances only the disposable DB lease, then starts a fresh process.
It verifies attempts2, one set/item, successful queue completion, a completed-job
processor skip, foreign-owner denial and retention after source deletion. Python
sockets are denied before imports; subprocess SQL accepts only a loopback
`momo_security_test` database. Child processes are cleaned on failure.

`test_database_query_plans.py` seeds20 tenants with4,000 sets,20,000 items and
20,000 chunks, runs ANALYZE, then EXPLAIN ANALYZE/BUFFERS for exact owner-filtered
repository library/item/chunk query shapes. It does not force planner settings or
assert machine-specific timing. The library limit is50; indexes must bound subset
access. This covers sampled SQL access patterns, not semantic vector quality,
PostgREST latency, production cardinality or capacity.

Run with the dedicated local database described above, from `backend/`:

```sh
LOCAL_TEST_DATABASE_URL=postgresql://postgres:local-test-only@127.0.0.1:55432/momo_security_test REQUIRE_PG_INTEGRATION=1 uv run --locked pytest tests/test_worker_process_recovery.py tests/test_database_query_plans.py -q -s
```

Tests pin local providers and override stale `.env` environment values before
application imports. Environment-selection tests still verify explicit conflicting
values fail closed. Full suite/static commands above remain required.

The same worker-process module also covers actual TXT ingestion. A task-owned file
replaces private object transport; real byte validation, SHA256/extraction/chunking,
local embeddings and atomic index publication run through actual repositories.
Four cases kill before/after publication, then restart with source present/deleted.
Assertions cover replacement, unique positions, READY reuse/no reread and owner
isolation. This does not test hosted storage, OCR or semantic provider embeddings.

### Real Supabase SDK and local PostgREST gateway

The gateway overlay uses version/digest-pinned PostgREST12.2.3 and nginx1.27.5.
PostgREST stays on an internal Docker network; a separate entry network publishes
only loopback database/router ports (Docker Desktop does not publish ports on an
internal-only network). Router exposes only `/rest/v1/`; no Auth/Storage service
is provided. Configuration follows [PostgREST12 configuration](https://docs.postgrest.org/en/v12/references/configuration.html).
All JWTs/passwords in this stack are synthetic test values.

From root:

```sh
MOMO_TEST_PG_PORT=55439 MOMO_TEST_GATEWAY_PORT=56439 docker compose -p momo-gateway-local -f scripts/testing/compose.yml -f scripts/testing/compose.gateway.yml up -d --wait
```

From backend/:

```sh
LOCAL_TEST_DATABASE_URL=postgresql://postgres:local-test-only@127.0.0.1:55439/momo_security_test LOCAL_TEST_GATEWAY_URL=http://127.0.0.1:56439 REQUIRE_PG_INTEGRATION=1 REQUIRE_GATEWAY_INTEGRATION=1 uv run --locked pytest tests -q --junitxml=/tmp/momo-local-gateway.xml
uv run --locked python ../scripts/testing/assert_no_skips.py /tmp/momo-local-gateway.xml
```

Finally from root:

```sh
MOMO_TEST_PG_PORT=55439 MOMO_TEST_GATEWAY_PORT=56439 docker compose -p momo-gateway-local -f scripts/testing/compose.yml -f scripts/testing/compose.gateway.yml down
```

Process tests run both psql and real SDK/gateway modes. Gateway mode keeps the actual
SupabaseSession/client/pooled bounded transport; child socket access allows only the
selected exact loopback port. Signed-user RLS reads, foreign-user denial, anonymous
denial, authenticated write/service-RPC denial and bad-signature rejection run
through actual HTTP/JWT role selection. The auth.uid fixture accepts both explicit
per-claim test settings and PostgREST's JSON claims setting. Schema fixtures notify
the gateway to refresh after migrations. CI requires this stack/integration flag
and retains the no-skips gate; clean hosted CI still requires a requested push.

Without `LOCAL_TEST_GATEWAY_URL`, optional gateway tests skip unless
`REQUIRE_GATEWAY_INTEGRATION=1`, which fails. A PG-only run therefore does not verify
all transport paths or qualify a no-skips release run. This remains local synthetic
proof; hosted Supabase Auth/Storage, managed gateway versions/settings and AI providers
are outside the fixture.

Image regression after SDK changes (from root):

```sh
docker run --rm -i --network none --read-only --tmpfs /tmp --cap-drop ALL --security-opt no-new-privileges -e APP_ENV=local -e DATABASE_BACKEND=memory momo-backend:oct08-gateway python - < scripts/testing/container_sdk_smoke.py
```

This constructs the actual synchronous SDK and verifies denied I/O fails closed;
it does not connect to a database. The gateway process tests provide actual HTTP
proof separately. Repeat the scanned-PDF smoke for the final image as above.

### Local database recovery regression

`test_database_restore.py` uses pg_dump/pg_restore/psql (PostgreSQL client tools)
against only the disposable source fixture. It exclusively creates a random target,
restores a private synthetic archive, checks generated data/security/expiry and
cleans its target/archive on failure. Run within the full PG/gateway suite above or
use `uv run --locked pytest tests/test_database_restore.py -q` with the loopback
`LOCAL_TEST_DATABASE_URL`. Source schema is reset by the dedicated fixture.
Global roles/extensions share the disposable cluster; managed backups, new-cluster
recovery and app rollback are outside the proof. See
[recovery runbook](../../docs/DATABASE_RECOVERY_RUNBOOK.md).
