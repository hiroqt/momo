---
tags: [momo, backend, release, knowledge-map]
audited: 2026-10-14
status: public-release-blocked
---
# Momo Public Readiness

Momo is **not ready for public launch**. This October 14 pass started at `07fa026`; its backend work is recorded in the task commits and dated evidence report. It applies and inspects migrations 001–016 on the user-selected `momo-staging`, hardens Google-only backend JWT checks, and prepares a Render API/worker Blueprint. It does not deploy hosted application services or run a real-account journey. This repository is the configured Obsidian vault.

Start with [[Momo Readiness Map.canvas|the visual dependency map]]. The authoritative task IDs and acceptance criteria remain in [[docs/PRODUCTION_READINESS_CHECKLIST|Production Readiness Checklist]]; requirements remain in [[ARD_PRD]]. These notes link the decisions and evidence without replacing either document.

## What remains before students can use the public app

| Sequence | Work | Task IDs | Required proof / input |
| --- | --- | --- | --- |
| 1 | Connect actual Google accounts | AUTH-01, AUTH-02 | OAuth client and redirects; native login, refresh, logout, account switch; populate real profiles; verify managed account deletion and physical cleanup of inventoried originals |
| 2 | Verify hosted database/storage contracts | ENV-02, DOC-01 | Migrations 001–016 and catalog security checks are complete in staging; managed Auth profile/deletion lifecycle remains unverified; still run two-user/anonymous denial through PostgREST and a real private signed-upload and deletion flow |
| 3 | Complete ingestion and source lifecycle | WORK-02, RET-01 | Native intent/navigation and worker process recovery, generation-safe orphan cleanup, physical 72-hour deletion and retained study sets |
| 4 | Verify actual AI output | AI-02, AI-03, AI-04, DOC-02, FORMAT-01 | Available Nemotron and embedding model/dimension agreement, calibrated grounding, real OCR, safe failure and all study formats |
| 5 | Finish tutor and economics | CHAT-01, ECON-01, API-01, SYNC-01 | Folder charging now follows the approved PRD price, but wallets start at zero; approve a credit earning path before users need the fourth folder. Heart regen/refill, XP/rewards, trusted card provenance and two-device replay remain open |
| 6 | Operate the backend | CI-01, OPS-01, OPS-02, SEC-02 | Clean CI run, selected hosting/HTTPS, worker/cleanup monitoring, capacity targets, privacy audit and isolated restore/rollback drill |
| 7 | Qualify and publish | QA-01, QA-02, MATH-01, IMAGE-01, WEB-01, RELEASE-01 | Real-account release builds, offline/reconnect/two-device journeys, accessibility/device performance, required capabilities and distribution/privacy/support |

No readiness percentage is meaningful here: account access, grounding, durability and operations are mandatory gates with different evidence. Existing local test counts cannot establish any hosted gate.

## Focused next actions

Latest status and release gates: [[Momo Backend Completion 2026-10-14]]. The staging schema has 001–016, forced RLS/catalog checks, and a private documents bucket; migrations 014–015 add Google profile provisioning and account-deletion cleanup inventory, while 016 activates replay-safe folder charges. Backend auth accepts only signed Google Supabase identities. Render API/worker configuration and local container probes are prepared, not deployed. Local account deletion uses the verified identity and clears its device partition; managed deletion, physical object purge, and files outside the inventory remain open alongside real Google login, hosted PostgREST/storage/API flows, real provider generation, and release/device/operations checks.

The user authorized database changes on `momo-staging` and selected Render for preparation. No staging API or worker deployment occurred. Put credentials only in the host's secret store; never paste service keys into these notes. No production changes or load tests were performed.

[[Momo Upload Retention]] maps the implemented transactional lifecycle and remaining provider/inventory/deployment gates.

Latest integrated local verification: **832 backend/API/PostgreSQL/PostgREST tests passed, zero skipped**, Ruff 138 files and mypy 75 files passed; mobile lint and **182 tests** passed. The non-root container passes SDK fail-closed and two-page scanned-PDF OCR checks; `/health` and `/ready` passed through Render-style `PORT`. See [[docs/backend-readiness-2026-10-14|dated report]] for exact commands, staging migration versions and open public gates.

API-01 contract reconciliation (October 14): `GET /api/documents/{id}/status` already returns nullable `page_count`; the mobile response type now exposes it. The API matrix now reflects that fact, the registered economy router, and stable folder replay keys. Focused verification: 38 API contract/request-bound tests and mobile TypeScript passed. API-01 remains open for generated image response sizing and native/hosted release journeys.

Generated media contract (October 14): the API accepts validated PNG/JPEG/WebP output up to 15 MiB decoded and 16 megapixels. Both deterministic diagrams and provider images use the same validation; OpenRouter response streaming stops at the encoded-body cap. The user approved these limits. Local verification: 63 API/image/request-bound tests, Ruff and mypy passed. Hosted provider configuration and native image viewing remain release gates.

API-01 contract reconciliation (October 14): `GET /api/documents/{id}/status` already returns nullable `page_count`; the mobile response type now exposes it. The API matrix now reflects that fact, the registered economy router, and stable folder replay keys. Focused verification: 38 API contract/request-bound tests and mobile TypeScript passed. API-01 remains open for generated image response sizing and native/hosted release journeys.
