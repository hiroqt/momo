---
tags: [momo, deployment, operations]
---
# Momo Deployment

Parent: [[Momo Public Readiness]]. Dependencies: [[Momo Database]], [[Momo Authentication]], [[Momo Backend Security]].

## Prepared runtime

Build from repository root: `docker build -t momo-backend:2026-10-14 backend`. The Dockerfile installs the existing locked dependencies and runs as uid/gid10001. The build allowlist includes app source and dependency manifests only; `.env`, tests and local data are excluded. The API binds the platform `PORT`, disables URL-bearing access logs and stops through Uvicorn's SIGTERM handler. The same image supports `python -m app.workers.runner` for the separate database-backed worker.

Render was selected for host preparation. `render.yaml` defines a Singapore staging API and separate worker with manual deploys, `/ready`, 60-second shutdown and host-injected secrets. CORS origins and secret values remain `sync:false` inputs. Both processes now require the server-only `TYPESAFE_API_KEY` for semantic grounding; the worker inherits it from the API service. Public staging JWKS metadata advertises an ES256/EC key, matching the template's blank `SUPABASE_JWT_SECRET` and asymmetric verification path. No Render service was created or deployed; no instance size, public origin or spend was chosen. Use `.env.staging.example` or `.env.production.example` as configuration inventories, injecting real values through the host's secret store. Never copy hosted credentials into local test configuration.

## Deployment sequence to review with the release owner

1. Complete CI-01, ENV-02 and provider/OAuth decisions. Staging migrations 001–020 are applied; review backup/restore, data inventory and production migration behavior separately.
2. Keep deployed worker/API versions aligned with migrations and drain old workers during a transition. No worker was deployed in this pass.
3. Deploy API and separate workers from the same immutable release image. Set `INLINE_JOB_EXECUTION=false`, pin APP_ENV/project, and inject scoped secrets including `TYPESAFE_API_KEY`. Set ingress HTTPS, request limits/timeouts and controlled access logs.
4. Probe `/health` for liveness and `/ready` for database connectivity. The probe uses a metadata-only table request with a three-second deadline; failure returns safe503. It does not verify all RPCs, workers, storage, OCR or providers.
5. Monitor queue age/failures, lease recovery, cleanup backlog, AI latency/spend, quota/rate-limit/sync errors. Exercise drain/alerts and isolated restores before launch.
6. Run an explicitly approved, bounded staging real-account synthetic journey. Record release builds and cleanup. No hosted load/stress tests and no production test traffic.

Local container checks verify non-root SDK construction with denied database I/O failing closed, scanned-PDF OCR with network disabled, and `/health`/`/ready` through the platform `PORT`; both endpoints returned 200 with local memory configured, then the container stopped cleanly. `.github/workflows/ci.yml` now builds the image and repeats the network-isolated OCR smoke. The same build/runtime command passed locally, but no remote Actions run has occurred. This does not verify hosted SDK connectivity or a separate database-backed worker process. The image includes Tesseract and Poppler for the scanned-PDF OCR path. One synthetic sample is supporting evidence; broad document/OCR quality and camera math remain DOC-02/MATH-01 gates.

## Latest local artifact

`momo-backend:2026-10-14` passes non-root/network-isolated SDK failure and
scanned-PDF OCR smoke. Its `/health` and `/ready` endpoints were probed using a
Render-style port binding and it stopped cleanly. The latest backend suite passed
886 tests with zero skips, including local PostgreSQL/PostgREST gateway checks;
Ruff and mypy passed. The clean remote Actions run remains pending.
The Render API and worker are not deployed. See
[[docs/backend-readiness-2026-10-14|dated evidence]].

## October 15 local checkpoint

The current backend PostgreSQL/PostgREST suite passes 974 tests with zero skips,
errors, or failures; Ruff 146 and mypy 76 pass. The source docs now specify the
approved 2048D Nemotron embedding path and v1/v2 rollout constraints. A synthetic
filtered ANN probe did not justify adding an index. Migration 020's inventory
RPCs are applied and catalog-verified, but the local inventory CLI could not
initialize without pinned staging configuration. The user has not yet supplied
the HTTPS Render API URL after entering secrets/CORS; do not claim deployment,
provider, or real-account checks from these local results.

Local synthetic restore now checks persistent material, tenant security and preserved expiry. Read [[Momo Database Recovery]] for evidence limits and remaining recovery decisions.
