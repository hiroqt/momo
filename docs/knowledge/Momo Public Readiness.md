---
tags: [momo, backend, release, knowledge-map]
audited: 2026-10-14
status: public-release-blocked
---
# Momo Public Readiness

Momo is **not ready for public launch**. This October 14 pass started at `07fa026`; its backend work is recorded in the task commits and dated evidence report. It applies and inspects migrations 001–019 on the user-selected `momo-staging`, hardens Google-only backend JWT checks, and prepares a Render API/worker Blueprint. It does not deploy hosted application services or run a real-account journey. This repository is the configured Obsidian vault.

Start with [[Momo Readiness Map.canvas|the visual dependency map]]. The authoritative task IDs and acceptance criteria remain in [[docs/PRODUCTION_READINESS_CHECKLIST|Production Readiness Checklist]]; requirements remain in [[ARD_PRD]]. These notes link the decisions and evidence without replacing either document.

## What remains before students can use the public app

| Sequence | Work | Task IDs | Required proof / input |
| --- | --- | --- | --- |
| 1 | Connect actual Google accounts | AUTH-01, AUTH-02 | OAuth client and redirects; native login, refresh, logout, account switch; populate real profiles; verify managed account deletion and physical cleanup of inventoried originals |
| 2 | Verify hosted database/storage contracts | ENV-02, DOC-01 | Migrations 001–019 and catalog security checks are complete in staging; managed Auth profile/deletion lifecycle remains unverified; still run two-user/anonymous denial through PostgREST and a real private signed-upload and deletion flow |
| 3 | Complete ingestion and source lifecycle | WORK-02, RET-01 | Native intent/navigation and worker process recovery, generation-safe orphan cleanup, physical 72-hour deletion and retained study sets |
| 4 | Verify actual AI output | AI-02, AI-03, AI-04, DOC-02, FORMAT-01 | Live `nvidia/nemotron-3-embed-1b:free` response and availability, 2048-dimension retrieval relevance/latency, calibrated grounding, real OCR, safe failure and all study formats; reindex eligible v1 documents before deploying to any populated project |
| 5 | Finish tutor and economics | CHAT-01, ECON-01, API-01, SYNC-01 | Folder charging follows PRD pricing; each newly accepted client-attested correct answer now earns one server-ledger Momo Coin and sync returns the authoritative balance. The server cannot independently verify client answer correctness, so a modified app can farm rewards. Heart regen/refill, XP policy, trusted card provenance and two-device replay remain open |
| 6 | Operate the backend | CI-01, OPS-01, OPS-02, SEC-02 | Clean CI run, selected hosting/HTTPS, worker/cleanup monitoring, capacity targets, privacy audit and isolated restore/rollback drill |
| 7 | Qualify and publish | QA-01, QA-02, MATH-01, IMAGE-01, WEB-01, RELEASE-01 | Real-account release builds, offline/reconnect/two-device journeys, accessibility/device performance, required capabilities and distribution/privacy/support |

No readiness percentage is meaningful here: account access, grounding, durability and operations are mandatory gates with different evidence. Existing local test counts cannot establish any hosted gate.

## Focused next actions

Latest status and release gates: [[Momo Backend Completion 2026-10-14]]. The staging schema has 001–019, forced RLS/catalog checks, and a private documents bucket; migrations 014–015 add Google profile provisioning and account-deletion cleanup inventory, 016 activates replay-safe folder charges, 017 rewards accepted correct sync events atomically, 018 applies the 2h15 retired-upload purge delay, and 019 adds the rollback-preserving 2048-dimensional embedding path. Backend auth accepts only signed Google Supabase identities. Render API/worker configuration and local container probes are prepared, not deployed. Local account deletion uses the verified identity and clears its device partition; managed deletion, physical object purge, and files outside the inventory remain open alongside real Google login, hosted PostgREST/storage/API flows, real provider generation, embedding relevance/capacity, and release/device/operations checks. The v2 exact-scan RPC has no ANN index; halfvec/HNSW needs measured filtered retrieval quality before adoption.

The user authorized database changes on `momo-staging` and selected Render for preparation. No staging API or worker deployment occurred. Put credentials only in the host's secret store; never paste service keys into these notes. No production changes or load tests were performed.

[[Momo Upload Retention]] maps the implemented transactional lifecycle and remaining provider/inventory/deployment gates.

Latest integrated local verification: **839 backend/API/PostgreSQL/PostgREST tests passed, zero skipped**, Ruff 138 files and mypy 75 files passed; mobile lint and **186 tests** passed. The non-root container passes SDK fail-closed and two-page scanned-PDF OCR checks; `/health` and `/ready` passed through Render-style `PORT`. See [[docs/backend-readiness-2026-10-14|dated report]] for exact commands, staging migration versions and open public gates.

API-01 contract reconciliation (October 14): `GET /api/documents/{id}/status` already returns nullable `page_count`; the mobile response type now exposes it. The API matrix reflects that fact, the registered economy router, stable folder replay keys, and the server credit balance returned by sync. Focused contract verification passed; native/hosted release journeys remain open.

Generated media contract (October 14): the API accepts validated PNG/JPEG/WebP output up to 15 MiB decoded and 16 megapixels. Both deterministic diagrams and provider images use the same validation; OpenRouter response streaming stops at the encoded-body cap. The user approved these limits. Local verification: 63 API/image/request-bound tests, Ruff and mypy passed. Hosted provider configuration and native image viewing remain release gates.

The approved sync reward rule is client-attested: each newly accepted `correct` event for an owned study item adds one coin in the sync transaction, and the server balance is reconciled into the signed-in mobile account wallet on account load and after sync. Stale same-account wallet reads are ignored. Some mobile economy spends/exchanges remain local-only, so server-authoritative purchase flows and local previews are not yet fully reconciled. Duplicate event IDs and non-correct outcomes do not reward. No historical events are backfilled. A tampered client can still falsely label an answer correct; server-side answer adjudication remains a security follow-up.

After these changes, the complete local Postgres/PostgREST backend suite passed **839 tests, zero skipped/errors/failures**; Ruff 138 files, mypy 75 source files, mobile TypeScript and 186 mobile tests passed. The synthetic loopback services were stopped after the run. Render deployment and hosted/provider/device checks remain unverified.

API-01 contract reconciliation (October 14): `GET /api/documents/{id}/status` already returns nullable `page_count`; the mobile response type now exposes it. The API matrix reflects that fact, the registered economy router, stable folder replay keys, and the sync response's server credit balance. Focused contract checks passed; native and hosted release journeys remain open.
