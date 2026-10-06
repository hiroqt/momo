# Parallel Readiness Discovery and Baseline

Date: October 6, 2026 (Asia/Manila). Revision: 896d534f05f4984a90296a4d3bc099356ba9ec42 plus pre-existing documentation changes. Status: discovery complete; implementation brief pending. This report does not close hosted or release gates.

## Team findings

- Requirements/API specialist: confirmed five-versus-fifteen hearts, contradictory folder formula, sync endpoint/acknowledgment mismatch, upload registration alias, missing advertised study-set creation/detail contracts, ordinary offline data and mutations held in memory, and dummy mobile identity. Economy policy and internal PRD contradiction need explicit resolution.
- AI specialist: confirmed source-free study generation, synthetic citations, rejected-item backfill, arbitrary chat import, invalid citation substitution, attribution-only validation, MCQ alteration, mock production provider/OCR fallbacks. Prioritize AI-01, then AI-02 with calibrated support evaluation; provider and OCR work can proceed with separate ownership.
- Infrastructure/QA specialist: confirmed absent durable dispatch/CI/scheduler, standard local Supabase HTTP incompatibility, unbounded environment names and missing endpoint pinning. Hosted staging consumes egress; separate projects in one organization share its allowance. Recommend local automated/stress tests and explicitly bounded managed staging smoke.
- Lead: inspected current Supabase organizations/projects via MCP; only hiroqt is listed, with unrelated dtr/run-app/yhel-os projects. No project created, migration applied, hosted data inspected, or production test run. Organization, region, layout, cost confirmation, hosting and completion scope remain pending.

## Fresh baseline evidence

| Check | Command/environment | Result |
| --- | --- | --- |
| Backend API/behavior/edge/security + real database | `LOCAL_TEST_DATABASE_URL=postgresql://postgres:local-test-only@127.0.0.1:55432/momo_security_test uv run --locked --project backend pytest backend/tests -q` | 181 passed, zero skipped, 14.17 seconds; one existing Starlette HTTP422 deprecation warning |
| Mobile unit/behavior | `npm --prefix mobile test` | 67 passed |
| Mobile TypeScript | `npm --prefix mobile run lint` | Passed |
| Web unit/behavior | `npm --prefix web test` | 25 passed |
| Web TypeScript | `npm --prefix web run lint` | Passed |
| Web build | Existing build script in task-local source copy excluding `.env*`, with empty provider variables and telemetry disabled | Passed; Next.js 15.5.26 |
| Local API load/stress | `uv run --locked --project backend pytest backend/tests/test_local_workloads.py -q -s` | 3 passed; 500 requests/concurrency 32 and 1500/concurrency 128 |
| Diff whitespace | `git diff --check` | Passed |

Database fixture: dedicated Docker Compose project `momo-agent-verification`, `pgvector/pgvector:pg16`, memory-backed data, explicit loopback port 55432, database `momo_security_test`. SQL fixtures reject hosted URLs and reset only this disposable test database. Combined suite includes local SQL load/stress and RLS/concurrency checks. Backend tests replace credentials and deny provider sockets. Local workload measurements are correctness smoke evidence, not production capacity estimates.

Baseline command logs from QA: `/tmp/momo-infra-qa.pWshVd/`. No tracked source implementation changed during discovery. The lead updated the readiness active-work table and private project context. No commits or pushes performed.

## Decisions and next step

Questions 1–8 await user answers: organization, environment layout/egress, region, PRD alignment, full remaining scope versus initial wave, hosting/spend/integration availability, folder formula, and organization quota isolation. Supabase project cost must be retrieved for the selected organization and explicitly confirmed before creation. Do not infer authorization for a price or organization from silence.

After confirmation, lead assigns disjoint file ownership, claims eligible tasks, integrates workers, runs affected checks and independent review, and updates dated acceptance evidence. Native real-account/device E2E, provider grounding evaluation, durable restart recovery, managed Supabase checks, cleanup scheduling, CI and release gates remain open.
