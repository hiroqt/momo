# Backend readiness — October 8, 2026

**Local hardening completed; public launch remains blocked.** Latest verification: **802 backend tests passed, zero skips/errors/failures**, **181 mobile tests passed**, TypeScript, Ruff and mypy over75 app files clean. Migrations001–012 are prepared and verified only locally. See the final continuation evidence below. Audited `main` at
`07fa026f17b4e9567475bf8e158b15e3c42708b7` plus this uncommitted pass.
User approved local hardening and deployment preparation only, and requested an
Obsidian knowledge map. No hosted application traffic, schema changes, deployment,
commit, push or publication occurred. Existing changes in mobile/app.json,
mobile/package.json and mobile/package-lock.json were preserved.

Requirements: [PRD](../ARD_PRD.md), [tracker](PRODUCTION_READINESS_CHECKLIST.md).
Obsidian vault: `/Users/arnel/nvidia-hackathon`, confirmed by Obsidian's configured
vault registry and the user's vault name. Start at
[Momo Public Readiness](knowledge/Momo%20Public%20Readiness.md) and
[the native canvas](knowledge/Momo%20Readiness%20Map.canvas).

## Implementation and review

| Owner | Work | Evidence |
| --- | --- | --- |
| Backend specialist | API-01 total HTTP body cap and schema bounds; wired readiness router | 51 focused tests passed, including 12 new request-limit tests; source review |
| Database specialist | WORK-02 atomic complete index + READY publication and READY-only retrieval | 40 focused local PG/queue tests passed; tenant/grant rejection, rollback, 8 concurrent publications -> exactly one winner |
| Coordinator | Integration, terminal-status memory parity, auth signature regression tests, readiness probe, container and OCR runtime, docs/Obsidian | Integrated results below |
| Independent reviewer | Security/concurrency/compatibility and final diff | Found two P2 issues: memory terminal-state parity and missing OCR executables; both fixed and verified; final re-review found no remaining actionable backend findings |

Changes:

- Migration **007_atomic_document_index.sql** locks the owned document and
  replaces chunks plus READY metadata in one transaction. Invalid input rolls
  back the previous index. Late READY publications do not replace it. Expired,
  foreign or invalid-status sources cannot publish. Client execution is denied;
  the RPC is service-only. Retrieval omits failed/unpublished/expired sources.
- Worker publication uses this RPC. Memory mode mirrors terminal status guards.
  Four old test fixtures now explicitly contain READY/unexpired sources; their
  existing expected assertions were retained.
- All HTTP bodies are capped at **10 MiB**, before parsing/services. Actual
  streamed bytes and declared length are checked; safe 413 on excess. Bounds:
  title 200, individual option 2000, folder color/theme 64, import image8,000,000.
  The image import feature still rejects image content; metadata is bounded by
  the whole-body cap. Direct 15 MiB documents upload to storage, not FastAPI.
- `/ready`: database metadata-only probe with a three-second deadline; safe 503
  on failure. `/health`: independent process liveness. Memory readiness is
  labeled `local_memory`. The probe does not verify queue workers, all schema
  RPCs, storage, AI or OCR. SDK work already in-flight holds its concurrency
  permit until completion even after request timeout.
- Asymmetric auth regression tests sign actual RS256/ES256 tokens. Transport is
  mocked; forged signatures and token-controlled key URLs cannot authenticate.
  JWKS outage rejects tokens without exposing underlying details.
- Container: Python/uv base manifests pinned, locked Python dependencies,
  non-root uid 10001, build allowlist excludes `.env` and local data, default API
  access logging disabled. Default worker OCR runtime now includes Tesseract
  and Poppler. Debian package resolution still depends on build-time repositories;
  record the release image digest and run dependency/container scans before launch.

## Verification actually run

All API/SQL stress tests are synthetic and local. The SQL fixture uses disposable
`momo_security_test` on `127.0.0.1:55438`, tmpfs PostgreSQL16/pgvector. Python provider
sockets are blocked by the test suite.

```sh
MOMO_TEST_PG_PORT=55438 docker compose -p momo-backend-oct08 -f scripts/testing/compose.yml up -d --wait
LOCAL_TEST_DATABASE_URL=postgresql://postgres:local-test-only@127.0.0.1:55438/momo_security_test REQUIRE_PG_INTEGRATION=1 uv run --locked --project backend pytest backend/tests -q --junitxml=/tmp/momo-oct08-final.xml
python3 scripts/testing/assert_no_skips.py /tmp/momo-oct08-final.xml 678
uv run --locked --project backend ruff check backend
uv run --locked --project backend mypy --config-file backend/pyproject.toml backend/app
git diff --check
docker build -t momo-backend:oct08-local backend
docker run --rm -i --network none --read-only --tmpfs /tmp --cap-drop ALL --security-opt no-new-privileges -e APP_ENV=local -e DATABASE_BACKEND=memory momo-backend:oct08-local python - < scripts/testing/container_ocr_smoke.py
```

- Baseline 653 passed, zero skips. Final **678 passed, zero skips/errors/failures**,
  32.30 seconds; 28 existing Starlette422 deprecation warnings. Includes auth,
  API ownership/error contracts, real RLS/RPC/vector checks, queue and local workloads.
- Ruff passed; mypy passed over 74 app files; diff whitespace check passed.
- Image built and launched locally under read-only filesystem, dropped
  capabilities and no-new-privileges. `/health`200, `/ready`200 (`local_memory`),
  `/api/me`401. `id` confirms uid/gid10001; `/app/.env` absent; worker module present.
- Actual synthetic one-page image-only PDF passed through PDFExtractor ->
  Tesseract/Poppler OCR in the network-isolated image. Required phrases and
  page 1/is_ocr metadata passed. This is not a real-world OCR accuracy corpus.
- Mobile/web tests and device journeys were not rerun: no client source was
  changed. No hosted SDK integration, Google sign-in, real model call or release
  worker process was validated.

## Public release gaps and next work

1. **AUTH-01/02:** OAuth/redirect/client configuration; native login/refresh/logout;
   real profile lifecycle writer; account deletion including storage; account
   isolation on devices. Existing JWT verification alone does not finish auth.
2. **ENV-02/DOC-01:** apply/audit all ordered migrations in the intended environment,
   managed PostgREST/two-user/anonymous/grant proof, direct signed uploads and private
   storage. Migration 007 has not been applied remotely.
3. **WORK-02/RET-01:** generation retry idempotency after enqueue failure, bounded
   orphan recovery, orphan signed-upload cleanup, actual physical 72-hour deletion,
   crash/restart journeys and retained generated material.
4. **AI-02/03/04/DOC-02/FORMAT-01:** provider/model availability and embedding 1536
   compatibility, calibrated semantic grounding and labeled evaluations, broad OCR
   fixtures, all formats and safe provider failure. The retained Nemotron model
   choice was not changed.
5. **API-01/SYNC-01/CHAT-01/ECON-01:** folder create replay, trusted chat import
   references/expiry, two-device sync; economy earning/XP/refill/regen policy and
   activation decision. Do not activate folder charging while earning is unresolved.
6. **CI-01/OPS-01/02/SEC-02:** clean remote CI; selected host/HTTPS/ingress controls;
   separate worker deployment, alerting/capacity objectives, dependency and privacy
   audits, backup/isolated restore and rollback. `/ready` does not close OPS-01.
7. **QA-01/02/MATH-01/IMAGE-01/WEB-01/RELEASE-01:** real-account release journeys,
   offline/reconnect and device/accessibility/performance; required math/image/web
   capabilities; privacy/support/store distribution and launch decision.

Next eligible local tasks: **WORK-02** generation enqueue retry identity and orphan
recovery cap (WORK-01 is DONE_LOCAL), and **API-01** folder replay (no dependency for
contract audit). Hosted work requires explicit target/action approval. No public
launch gate is marked complete by this pass.

## Rollout/compatibility

Apply 007 before starting new workers; otherwise publication fails closed on missing
RPC. Drain old workers for the migration/deploy transition, since old binaries still
use the old non-atomic writes. Snapshot/backup and rehearse on isolated data; no
reverse migration or destructive reset was executed. Keep schema 007 on app rollback
and preserve READY-only retrieval; an old worker rollback reintroduces its old
publication window and requires explicit review. Use the same immutable release
image for API/workers and platform secret injection. Detailed operational sequence:
[Momo Deployment](knowledge/Momo%20Deployment.md).

## Continuation: generation and folder replay, bounded recovery

The next WORK-02/API-01 local pass adds migrations 008–011 and corresponding
repository/route tests. Generation creation can bind one owner/request key to one
job, including concurrent replicas and a failed enqueue after persistence. Replays
return current state; altered requests conflict. Explicit retries carry a durable,
owner/revision-scoped dispatch authorization so enqueue failure can be recovered without
turning ordinary create replay into an unlimited recovery-budget reset. Fresh
requests require READY and unexpired sources; completed replay survives source
expiry. **Mobile generation request-key persistence/adoption remains incomplete.**

Automatic orphan reconciliation now stores a lifetime counter capped by the logical
job's original configured `max_attempts`; scheduler arguments cannot expand it.
Only explicit manual retry resets the budget. Active jobs are excluded before the
batch limit, and exhausted/expired/terminal subjects do not restart automatically.
Recovery locks queue then subject, matching failure RPCs; a deterministic concurrent
failure/recovery regression checks that ordering.

Folder creation honors optional request keys atomically. Replays preserve one
folder; altered payloads conflict; deletion retains a tombstone preventing later
recreation from a stale queue. Owner keys never expose another user's folder.
Default color matches the database. Economy charging remains intentionally gated.

Local backend specialist: keyed generation/API/PG tests and expiry/retry-dispatch
regressions. Database specialist: lifetime budget, fairness, owner/lifecycle and
concurrent lock-order tests. Coordinator: folder replay and integrated verification.
Reviewer identified expiry and client-adoption gaps; expiry is fixed, client work
remains explicitly open. Current evidence is recorded in the tracker dated entry.
These changes do not apply any hosted migration or close public-release gates.

Continuation verification: same loopback PostgreSQL command, JUnit file
`/tmp/momo-oct08-recovery.xml`, **703 passed**, zero skips/errors/failures in 38.88s.
Ruff and mypy over 74 files clean. New folder/database-focused suite 32 passed.
Historical 678 evidence above is preserved; these results cover the later code.
The internal forced-RLS catalog assertion now includes both request tables;
legitimate orphan fixtures include expiry metadata. No security assertion weakened.

Independent review also identified a stale retry-authorization race. Migration 011
now verifies and consumes the current owner/revision authorization in the same
transaction as queue reset, under queue-before-subject locks. A delayed competing
dispatch cannot reset a finished queue or its orphan budget. Local PostgreSQL
regressions cover delayed competing dispatch, wrong-owner/revision/client denial
and injected transaction failure rollback. The separate earlier clear-after-enqueue
implementation was replaced before handoff.

### Final continuation verification

Final code: **713 passed**, zero skips/errors/failures in 38.14s; 32 Starlette422
deprecation warnings (same warning category as baseline). JUnit evidence:
`/tmp/momo-oct08-recovery-final.xml`; no-skip verifier 713 passed. Ruff and mypy
over 74 app files passed; `git diff --check` passed. Final image
`momo-backend:oct08-recovery` built with manifest digest
`sha256:b3fbfc76ec8e15ece8d0135a0c973c7bbce8fb1ca7e16fefc88c3d4915d6564a`.
Its network-isolated, non-root scanned-PDF OCR smoke passed. Final-image ASGI
smoke returned `/health`200, `/ready`200 (`local_memory`) and `/api/me`401. A changed-file
credential-pattern scan passed without emitting matched values.

Independent final review: **no remaining actionable findings in the reviewed
backend changes**. The last SQL rejection path now removes only its own tentative
queue row and uses NULL-safe/missing-subject guards. Deterministic regressions
change/delete the generation between fast authorization and locked recheck; no
queued work remains on rejection. Delayed competing dispatch cannot reset already
consumed retry authorization. This is local evidence, not a production guarantee.

Obsidian canvas now has 6 valid file nodes and 8 valid edges; all wikilinks resolve.
The new durable-jobs note connects request identity, recovery limits and remaining
client/deployment proof. Mobile source remains untouched in this backend pass;
the original package/app configuration changes are preserved. Next local work is
WORK-02 persistent generation request intent and header adoption in the actual
mobile flow. Hosted authentication/database/storage/operations and launch gates
remain open. Temporary PostgreSQL verification container is removed after checks.

## Continuation: durable mobile generation intent and transport

The actual create screen now saves validated settings and an account-owned UUID
action key in SQLite before POST. Lost responses/restarts reuse that key; a received
job is saved before navigation and restored without another POST. The destination
acknowledges it only after an owned status read. This permits a new intentional
generation after handoff while preserving unfinished work. Offline drafts retain
settings without generating. Route/account epoch guards suppress stale results and
clear previous-account settings.

Transport pins account identity through refresh/fetch/JSON and401 recovery, bounds
one overall deadline, normalizes headers and never guesses another port for a
mutation. Generation polling waits for each request to settle. Accepted or uncertain
explicit retry delivery restarts GET reconciliation without repeating POST; account
changes and permanent errors stop it.

Verification: **178 mobile tests passed**, no failures/skips; repository TypeScript
check passed. Focused intent, transport and polling regressions cover storage failure,
corrupt metadata, lost responses, account/logout/route races, stalled refresh/JSON,
headers, cancellation and retry delivery. A loopback smoke using the actual mobile
service/transport, file SQLite, FastAPI routes and signed HS256 JWT verifier passed
**8 invariant groups with 4 generation POSTs**. Reopening after loss preserved same
key/job; reopening a received receipt made no POST; owned GET/ack allowed distinct
new work; another verified owner was denied source/job access. Backend storage is
explicit memory and workers disabled in this fixture. No provider or hosted traffic
ran; server stopped and private tokens/SQLite fixtures removed. See
[scripts/testing/README.md](../scripts/testing/README.md).

Ownership: mobile builder handled intent/storage/create-screen integration; root
handled account-bound transport, progress polling/retry reconciliation and docs;
local API specialist built and ran the integration harness; independent reviewer
checked security/account boundaries and regressions. Prior 713 backend/real-PG
test evidence remains applicable to unchanged backend code. Package/app configuration
changes were preserved. Native device/navigation, worker process kill/restart,
managed PostgreSQL and hosted OAuth/provider journeys remain unverified. WORK-02
remains PARTIAL; next local verification is process-level recovery. Public release
still requires the gates listed above.

Final mobile/harness review: no remaining verified actionable findings. `git diff --check`, changed-file credential-pattern scan and Obsidian file/wikilink/canvas checks passed (6 nodes,8 edges). No commits, pushes, hosted mutations or native-device claims.

## Continuation: actual Python worker crash recovery and sampled SQL plans

Added [process tests](../backend/tests/test_worker_process_recovery.py) with a
[test-only child fixture](../backend/tests/worker_process_fixture.py). The actual
JobRunner/JobQueue/handle_study_generation/GenerationRepository run in separate
Python processes against disposable PostgreSQL via a narrowly scoped psql adapter.
Python sockets are denied before imports; credentials/providers are explicitly
synthetic/local. SIGKILL after claim or after atomic publication, then a fresh
process after advancing the isolated lease, yields attempts2 and a succeeded queue
with exactly one set/item. Already-completed jobs skip the processor. Foreign-user
access is denied and deleting the source preserves owned study content. Deterministic
content replaces provider generation; PostgREST is not exercised. This closes two
local generation crash boundaries, not all WORK-02 ingestion/provider/deployed gates.

[Query-plan tests](../backend/tests/test_database_query_plans.py) seed20 tenants,
4,000 sets,20,000 items and20,000 chunks and run unforced EXPLAIN ANALYZE/BUFFERS
after ANALYZE for actual repository SQL shapes. Existing indexes were selected:

| Query | Returned rows | Shared blocks | Sample execution ms | Index |
|---|---:|---:|---:|---|
| Owned library,50-row page |50|3|0.021|study_sets_owner_created_idx|
| Owned ordered set items |5|10|0.053|items_set_order_idx|
| Owned source chunks |100|102|0.163|chunks_owner_document_idx|

These are local synthetic measurements with no planner forcing or production
capacity extrapolation. No new schema index was justified by this sample. Semantic
vector quality, large offsets and provider/gateway latency remain outside this proof.

Final combined command from backend/:
`LOCAL_TEST_DATABASE_URL=postgresql://postgres:local-test-only@127.0.0.1:55439/momo_security_test REQUIRE_PG_INTEGRATION=1 uv run --locked pytest tests -q --junitxml=/tmp/momo-oct08-process-final.xml`
returned **718 passed in41.61s**, zero skips/errors/failures; no-skip verifier passed.
Ruff whole backend and mypy74 app files passed.32 existing Starlette422 warnings.
Test setup now pins local providers and overrides stale `.env` environment with
an empty derivable value, allowing explicit configuration tests to retain their
normal validation;84 isolation tests passed. A missing list-of-dicts annotation
in atomic index publication was fixed without changing runtime behavior.

Root implemented after worker/database agents hit account usage limits. Independent
review caught query ordering differing from repositories; corrected before final
verification. No remaining actionable findings in the reviewed scope. Disposable
PG container/network removed. Original unrelated mobile config work remains preserved;
no commit/push/hosted changes. Next local work: WORK-02 document-ingestion process
recovery. Hosted auth/database/storage, native journeys, AI calibration and operations
remain release blockers.

## Continuation: real TXT ingestion pipeline crash boundaries

Extended the existing process helper to exercise actual DocumentWorker, TXT byte
validation, integrity hashing, extraction, chunking, local embeddings and atomic
index publication. A narrowly allowlisted test table adapter forwards actual
repository operations into disposable PostgreSQL via psql; a task-owned TXT file
replaces private-object transport. No production pipeline code was replaced.

Four new cases kill before index publication or after publication/before queue
acknowledgment, then restart with source present or deleted. Assertions cover
replacement of a stale partial index, unique positions, correct SHA256, owner-only
reads, READY/chunk-ID preservation without storage reread and no resurrection of
a deleted source. Together with the earlier generation cases, six process tests
passed. Full backend **722 passed in43.43s**, zero skips/errors/failures; JUnit
`/tmp/momo-oct08-ingestion-final.xml` and no-skip verifier confirm it. Ruff backend
and mypy74 passed.32 existing Starlette warnings remain. Independent review found
no actionable issues in the extension.

These cases establish selected TXT crash boundaries. The gateway is a psql test
adapter, embeddings are deterministic local and storage is a private file fixture.
They do not establish actual PostgREST/SDK recovery, hosted object storage, semantic
embeddings, OCR or deployed operation. Next local verification is WORK-02 actual
SDK/local PostgREST integration; hosted traffic/configuration still requires separate
approval. Container/network removed; no commits/push or unrelated edits. The
readiness map also corrects outdated missing-work descriptions already superseded
by dated local evidence.

## Continuation: actual local Supabase SDK and PostgREST

Added [gateway overlay](../scripts/testing/compose.gateway.yml), synthetic DB role
initialization and a `/rest/v1/` router. PostgREST stays on an internal network; only
loopback DB/router ports are published through a separate entry bridge. Versions
and manifest digests are pinned. See [reproduction commands](../scripts/testing/README.md);
configuration uses [official PostgREST12 documentation](https://docs.postgrest.org/en/v12/references/configuration.html).

Six process recovery cases now execute in both psql mode and actual SDK/gateway mode.
Gateway mode retains the actual SupabaseSession/client/query transport and permits
only its selected loopback socket. Signed-user HTTP checks prove owner reads,
foreign/anonymous denial, denied direct client writes/service-only RPCs and rejected
invalid JWT signatures. Local auth.uid accepts the gateway JSON claim convention.
No hosted auth/storage/provider traffic was used.

This caught a real backend startup bug: the locked SDK's generic ClientOptions lacks
required synchronous storage/httpx attributes. [Server session](../backend/app/db/session.py)
now supplies SyncClientOptions, preserving disabled refresh/session persistence,
pooled bounded transport and fail-closed behavior. The image and real-gateway tests
exercise actual construction, avoiding mock-only proof.

Final: **729 backend tests passed in51.83s**, zero skips/errors/failures; JUnit
`/tmp/momo-oct08-gateway-final.xml` and no-skip verifier passed.32 existing Starlette
warnings. Ruff/backend smoke helper and mypy74 passed. Image
`momo-backend:oct08-gateway` has manifest list
`sha256:d237059bd68ca1655d3e6c98aaa97a391a31c463a46d242d5e869261815c80f0`;
non-root/network-isolated SDK construction +denied I/O fail-closed smoke and actual
scanned-PDF OCR passed. The prior recovery image predates this SDK fix.

CI source now requires local PG/gateway integration and keeps the no-skips guard;
stack teardown is unconditional. A real GitHub CI run remains unverified because
no push was authorized. Independent reviewer found no actionable defects in the
reviewed session/gateway/recovery/CI changes. Disposable containers/networks removed.
WORK-02 managed storage/provider/auth/native/deployed gates remain open. Safe local
preparation still includes RET-01 orphan lifecycle and OPS-02 isolated restore/rollback
rehearsal, with release dependencies/inputs preserved. No commits, push or hosted
mutations occurred.

## Continuation: isolated database backup/restore rehearsal

Added [restore regression](../backend/tests/test_database_restore.py): private custom
archive of synthetic data restored into an exclusively created target DB. Assertions
verify persistent sets/items, completed finalization replay, tenant/anonymous/client
write denial, service-only grants and forced RLS. Expiry remains unchanged across
restore. Source deletion in the target preserves study items and leaves the source
DB unaffected. Target/archive cleanup is bounded and runs on failure. No original
object bytes enter this database backup; derived-source/account metadata policy
still needs review. Shared cluster roles/extensions mean this is not a new-cluster
or managed recovery qualification.

Focused drill passed in2.10s; full **730 passed in50.62s**, zero skips/errors/failures,
32 existing Starlette warnings; `/tmp/momo-oct08-restore-final.xml` and no-skip
verifier passed. Ruff/backend and mypy74 passed. Independent review found no
actionable defects. No production code changes. Stack containers/networks, random
restore target and archive removed. Current backend image remains the SDK-fixed
`momo-backend:oct08-gateway` artifact from the prior continuation.

Added [recovery runbook](DATABASE_RECOVERY_RUNBOOK.md) and linked Obsidian recovery
note/node (7nodes/11edges). OPS-02 remains PARTIAL: managed backups, new-cluster role
provisioning, RPO/RTO, backup retention/access/encryption/deletion policy and selected
app-worker compatibility/rollback need evidence and decisions. No general migration
downgrade is qualified. Remaining local preparation includes RET-01 orphan-upload
lifecycle. No hosted modifications, commit or push.

## Continuation: orphan-upload and retention design audit

Verified source gaps: signed URL issuance persists no lifecycle record; cleanup
only discovers registered documents; register_document RPC starts retention at
registration instead of upload. Delayed registration extends original lifetime.
Storage adapters return size only; S3 signed PUT has no first-write-only condition.
These findings require coordinated storage/DB/API/worker work, not an arbitrary
new deadline. Ticket issuance+72h is not the PRD upload+72h requirement.

[Upload retention design](UPLOAD_RETENTION_DESIGN.md) specifies a durable ticket
before signing, trustworthy object time/identity, transactional owner/quota checks,
cleanup claims/replay, deletion tombstones, legacy inventory and rollout behavior.
A backend specialist independently confirmed the clock/race/backfill requirements.
No code/schema/provider policy was changed in this continuation.730 prior backend
tests remain historical current-code evidence, not acceptance of the new design.
Next local implementation: verify metadata/immutable-upload contract and implement
the complete ticket lifecycle with local race/storage/gateway tests. Hosted
inventory/physical deletion and account-lifecycle decisions remain explicit.

## Continuation: storage metadata and immutable-upload contract

Storage builder added validated object metadata (size, aware UTC creation time and
optional identity/version/etag), separate confirmed-absence vs outage errors, locked
mock first-write behavior, S3 conditional signing and explicit Supabase no-upsert.
No client timestamp or registration/signing-time fallback is accepted. S3 time is
LastModified under the application conditional-write path; privileged rewrites and
path deletion/recreation still require ticket identity/tombstones. Supabase raw
Python info uses created_at. Primary contracts: [AWS PutObject](https://docs.aws.amazon.com/AmazonS3/latest/API/API_PutObject.html),
[AWS HeadObject](https://docs.aws.amazon.com/AmazonS3/latest/API/API_HeadObject.html),
[official Supabase info renderer](https://raw.githubusercontent.com/supabase/storage/master/src/storage/renderer/info.ts).

Root wired additive upload_headers response and validated native/web forwarding.
Provider uploads receive no app session token; canonical relative development mock
uploads authenticate to the API. Upload failures now stop registration instead of
being swallowed. Provider details/signed URLs are not logged or shown. Review found
a10MiB/15MiB local upload mismatch; only development/test memory mockPUTs now receive
the configured bounded file cap. Exact15MiB/oversized rejection regressions pass.

Final **767 backend passed in51.47s**, zero skips/errors/failures; JUnit
`/tmp/momo-oct08-storage-final.xml` and no-skip verifier passed;32 existing warnings.
**181 mobile tests**, repository TypeScript, Ruff/backend and mypy74 passed. Focused
storage56 cases passed. Independent review: no remaining actionable findings after
cap fix. Image `momo-backend:oct08-storage`, manifest list
`sha256:f6f1edacfc8bd58d234d5c769c98187b7590e08ff459ef404ff8cf96c410183e`,
passed non-root/network-isolated SDK fail-closed and actual scanned-PDF OCR smoke.
Disposable stack removed; no hosted traffic/mutations, commit or push.

This is prerequisite contract proof using mock transports and actual local signing.
Native-device/provider runtime remain unverified. Registration still starts retention
at registration; no durable signing ticket or orphan cleanup has been added yet.
Next local implementation is the complete ticket/clock/cleanup slice defined in
[retention design](UPLOAD_RETENTION_DESIGN.md). Hosted inventory/deletion/scheduling
and legacy/account lifecycle rollout remain explicit release gates.

## RET-01 transactional lifecycle continuation

Migration012, the upload ticket repository, API integration and cleanup worker now
cover issued-but-unregistered uploads and registration-clock correction. The server
records responsibility before signing; quota/document/ticket registration commits
atomically using provider upload time+72h. Replay checks expiry/state/lease. Tickets
retain cleanup responsibility after source/account deletion. Confirmed absence is
separate from provider failure, and tombstones retain15-minute probes.

Automatic removal targets the observed generation: atomic metadata comparison in
local mocks and explicit VersionId in S3. Explicit S3 retirement removes bounded
exact-key version/delete-marker inventory rather than creating a delete marker;
truncation remains retryable. Hidden versions prevent false physical-absence
acknowledgment. Janitors inspect empty/oversized metadata up to5TiB without reading
bytes; registration retains its1–15MiB bound.

**Public release remains blocked:** hosted Supabase automatic expiry removal lacks
a generation predicate and fails closed. The configured provider was not changed.
Unversioned S3 automatic removal also fails closed. Approve and prove the provider
strategy, version/IAM/lifecycle policy, legacy/unregistered inventory, scheduler
physical timing and measured capacity before rollout. Unknown legacy origins are
retained for explicit inventory and surfaced in backlog reporting.

| Owner | Current continuation | Evidence |
| --- | --- | --- |
| Backend specialist | Migration012/ticket core, atomic quota/replay/leases, account outbox | Real local PG and memory concurrency/denial tests; integrated result below |
| Database specialist | Synthetic clock/ticket fixture parity | Physical backlog survives metadata-only expiry; real cleanup RPC acknowledgment |
| Coordinator | API/storage/cleanup integration, real SDK ticket lifecycle, container, docs/vault |22 focused ticket/gateway checks;181 mobile tests and TypeScript; nonroot SDK/OCR container smoke passed |
| Independent reviewer | Physical-generation deletion, mock ticket boundary, absence and oversize parity | Findings corrected with regression cases; final outcome recorded below |

Final integrated verification: **802 backend tests passed, zero skipped/errors/failures**
in102.58seconds. The full run includes ordered001–012 migration/RLS checks,
actual SDK/PostgREST ticket and worker recovery, quota/lease/deletion races,
representative query plans and isolated restore tests. The JUnit report is
`/tmp/momo-oct08-tickets-final.xml`; `assert_no_skips.py ... 802` passed.
**181 mobile tests passed** and `npm run lint --prefix mobile` (TypeScript) passed.
Ruff, mypy75sourcefiles and `git diff --check` passed. There are32existing Starlette
422 deprecation warnings. Final independent RET-01 review found no remaining
local actionable findings after the corrected regression cases. Provider/runtime
and capacity gates listed above remain unverified.

```sh
LOCAL_TEST_DATABASE_URL=postgresql://postgres:local-test-only@127.0.0.1:55439/momo_security_test LOCAL_TEST_GATEWAY_URL=http://127.0.0.1:56439 REQUIRE_PG_INTEGRATION=1 REQUIRE_GATEWAY_INTEGRATION=1 uv run --locked pytest tests -q --junitxml=/tmp/momo-oct08-tickets-final.xml
python3 scripts/testing/assert_no_skips.py /tmp/momo-oct08-tickets-final.xml 802
```

The pytest command runs from `backend/`; the report assertion runs from the repository
root. All provider traffic is blocked except the explicitly isolated loopback gateway.
The task-owned compose project `momo-oct08-tickets` was removed after verification.

Container rebuilt as `momo-backend:oct08-tickets`; manifest list
`sha256:559682eca76ab9caf8f00deffaa06db048d0e6c23798a54555760fca9002b6c8`.
Nonroot/read-only/network-isolated SDK fail-closed and scanned-PDF OCR checks pass.
The Obsidian canvas retains8nodes/14edges; all file and wiki targets resolve.
