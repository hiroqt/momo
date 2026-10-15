---
tags: [momo, security, backend]
audited: 2026-10-14
---
# Momo Backend Security

Parent: [[Momo Public Readiness]]. Related: [[Momo Authentication]], [[Momo Database]], [[Momo Deployment]].

## Local protections

Verified JWT identity, owner-filtered repositories, forced RLS and same-owner foreign keys already exist. Upload registration/quota, answer sync and generation finalization use transactions. Managed configuration rejects memory persistence, development identity, mock embeddings, inline workers and cross-environment database URLs. Rate limits use shared PostgreSQL state and fail closed.

## October 14 local SEC-02 slice

The public math fallback previously passed user text to SymPy `parse_expr`, which evaluates generated Python. Parsing now validates the generated expression AST against an arithmetic/function allowlist, passes a restricted symbol environment, bounds input length, AST nodes, numeric exponents and possible symbolic expansion to 4,096 terms, and rejects factorial calls that can consume unbounded synchronous CPU. Inverse-trig aliases remain supported. Tests reject attribute access, subscripts, comprehensions, an exploit-shaped `__import__` expression, oversized/nested powers, factorial denial of service, and large symbolic expansion while preserving implicit multiplication and standard math functions.

Math solver errors no longer log exception text; diagram topics/requirements and rendered topics are omitted from logs; prompt-injection logs no longer disclose the internal matching regex. The local PostgreSQL/PostgREST gateway suite passed 854 tests with zero skips; Ruff (138 files), mypy (75 files), and the no-skip gate passed. The full SEC-02 audit remains open: these local tests do not verify all provider/worker logs, release bundles or dependency state, actual hosted HTTPS/CORS, or complete retention/deletion behavior. See [[docs/backend-readiness-2026-10-14|October 14 report]] for bounded evidence.

## October 8 changes

- All HTTP bodies are capped at 10 MiB before application parsing/work. Actual streamed bytes are counted, so a short or absent Content-Length cannot bypass the cap. Oversized bodies return safe `413 REQUEST_TOO_LARGE`.
- Chat titles: 200 characters; imported option strings: 2,000; imported base64 image field: 8,000,000; folder colors/theme tags: 64. Existing source metadata remains compatible within the total body cap. Imported images remain rejected by the import feature.
- Complete document chunks and READY publication commit together; retrieval excludes non-READY/expired sources. Details: [[Momo Database]].
- Generation and folder creation support owner-scoped replay keys; automatic orphan recovery has a lifetime budget. Mobile keys/receipts now persist per account; transport pins owner/epoch across all awaits, bounds deadlines and forbids mutation port fallback. Lost explicit retry responses reconcile through GET. Local replay proof passed; native/hosted journeys remain open.
- `/ready` checks bounded database reachability; `/health` remains independent process liveness. A local memory result is explicitly labeled.
- Real RS256/ES256 signature tests cover forged signatures, token-provided key URL rejection and safe JWKS outage denial. They mock network transport and do not prove Google login.
- API auth now requires signed Supabase claims for Google provider and OAuth method after checking signature, pinned issuer/audience, expiry, role and UUID subject. Password, anonymous and other providers fail. Supabase Auth verifies Google at sign-in; per-request live Auth lookup is intentionally absent under the selected policy. A real staging account remains unverified.
- Forced RLS, deny-by-default internal tables, and storage ticket migrations 012–013 are present in the authorized staging schema. `documents` is private with a 15 MiB cap. Catalog metadata does not prove hosted PostgREST or Storage behavior.

Request buffering is bounded per request, not a complete denial-of-service solution. Configure ingress body limits, slow-client timeouts, connection/concurrency limits and operational capacity before release. Raw-document uploads remain direct to object storage, outside the JSON API.

## Verification

Latest local loopback PostgreSQL/PostgREST suite after AI-02: 899 backend/API/database/gateway tests passed, zero skipped; Ruff 141 files and mypy 76 files passed. The 34 existing Starlette 422 deprecation warnings remain. Staging schema/security checks and the exact scope limits are recorded in [[docs/backend-readiness-2026-10-14|October 14 report]]. No hosted application traffic or production capacity proof. No claim of absolute security.

Upload retention uses durable tickets and preserves actual upload time/identity, but generation-safe Supabase physical deletion and legacy/unregistered inventory remain open. Read [[docs/UPLOAD_RETENTION_DESIGN|retention design]] and [[Momo Upload Retention]]. Public launch remains blocked on managed auth/API/storage/provider journeys and operations.

## 2026-10-14 SEC-02 audit update

- Provider/worker/storage source review and sentinel log tests now cover image-provider failures, document-processing failures, and upload-cleanup storage failures. These audited paths exclude request prompt, credential, content, signed URL, and raw provider/storage exception details from logs.
- The October 14 source-wide `backend/app` logger inventory found no request/document content, user/document/job/study-set IDs, credentials, signed URLs, raw provider/database error messages, or request-derived newline injection. The generated operational worker ID (hostname/PID/UUID) remains in worker startup logs. Dynamic fields otherwise are bounded counts/statuses, exception class names, or fixed internal categories. Configured provider model and storage-provider values were removed from logs; request/storage behavior is unchanged.
- Backend dependency audit: zero known advisories after safe PyJWT/multidict updates. Web dependency audit: zero known advisories after compatible fixes.
- Mobile dependency audit remains open: a scoped query-string override and version-guarded Expo Router CommonJS patch remove its vulnerable parser chain; clean install, parser tests, and Android/iOS exports pass. Audit now reports 28 package nodes (19 high, 9 moderate), including `braces` and `node-forge` with no patched versions in the inspected registry state. Device deep-link validation remains open.
- Expo dependency check, iOS/Android exports, web build and known-pattern scan of 106 built files passed. The pattern scan found no matches but does not prove arbitrary secrets absent.
- SEC-02 is still a public-release blocker: hosted HTTPS/CORS, two-account isolation, object-retention/deletion, and mobile dependency remediation remain unverified/open. No hosted provider traffic was sent.
- Evidence: `docs/backend-readiness-2026-10-14.md`, `docs/PRODUCTION_READINESS_CHECKLIST.md` SEC-02 rows.

## 2026-10-14 AI-02 hint grounding

- Optional generated hints now need support in the exact trusted chunk cited by the study item. Unsupported or other-chunk-only hints are omitted without rejecting an otherwise supported item.
- Regression coverage: supported hint retained, fabricated hint omitted while answer survives, and evidence found only in a different retrieved chunk is rejected for that hint.
- Focused grounding/hardening suite: 129 passed. Full local PostgreSQL/PostgREST suite: 858 passed, zero skips. No-skip gate, Ruff 138 files, mypy 75 files and diff check passed; independent review found no issue.
- This closes A2-1 locally only. AI-02 remains partial pending labeled calibration/TypeSafe evaluation and remaining answer-support/rejection gaps. See [[docs/PRODUCTION_READINESS_CHECKLIST]] and [[docs/backend-readiness-2026-10-14]].

## 2026-10-14 Jev runtime grounding boundary

- After deterministic schema/provenance/support checks, managed API and worker paths send each accepted candidate's question, answer, optional explanation/options and exact cited chunk to TypeSafe System One. No user/document identifiers, filename, signed URL or full document is sent.
- One HTTP request batches up to ten typed Choice judgments; at most 50 candidates are checked per call path, with an 8-second timeout, 128 KiB request cap, 1 MiB response cap and one short retry only for 429/529. Items persist only when `supports` is the selected class and both its probability and confidence are at least 0.8; malformed/provider-error results fail closed. Local/test remain network-isolated and use deterministic checks.
- This is an initial conservative threshold informed by TypeSafe's citation-check cookbook, not a Momo-calibrated quality claim. The approved 13-case smoke used 3,176 input and 529 output tokens; ambiguous relation cases showed low-confidence/mixed output. A follow-up 18-case synthetic fixture produced zero false accepts/rejects on short, clear examples in two requests (4,530 input / 814 output tokens), but labels are authored, not human-reviewed or representative. The 0.8 threshold remains provisional.
- `/api/chat/import-card` uses the shared per-user chat rate limit; a regression test proves throttling returns 429 before source lookup or Jev verification. Independent security review found no remaining actionable issue in this change.
- Review current vendor retention/transfer terms and public-user disclosure before launch. TypeSafe's policy states no training on inputs, retention as reasonably necessary, and U.S. hosting. See [[Momo Public Readiness]] and [[docs/PRODUCTION_READINESS_CHECKLIST]].

## 2026-10-14 backend log identifier minimization

- Selected chat, image, extraction, generation and durable-worker events now log event names, counts or exception classes without raw user/document/job/study-set IDs. Jev's provider-returned model name is omitted because it is an untrusted log field.
- Caplog regressions cover guardrail blocks, image provider failures, document/page-limit failures, generation completion and durable job failure. Focused suite: 118 passed; the full loopback PostgreSQL/PostgREST suite passed 935 tests with zero skips; Ruff 142 and mypy 76 passed. See [[docs/backend-readiness-2026-10-14]].
- This does not establish privacy of hosted log sinks or every backend log call; the overall SEC-02 and public-launch gates remain open.

## 2026-10-15 backend logger inventory

- Reviewed every logger call under `backend/app`. No request/document content, user/document/job/study-set IDs, credentials, signed URLs, raw provider/database errors, or request-derived log injection were found. The generated operational worker ID remains in worker startup logs. Newline-bearing configured model and storage-provider regressions confirm these values stay out of logs.
- Focused provider/storage suites passed 224 tests; final full loopback PostgreSQL/PostgREST suite passed 938 tests with zero skips/errors/failures; no-skip checker confirmed 938/0. Ruff 142, mypy 76 and diff checks passed. The run emitted 33 existing Starlette 422 deprecation warnings. Independent review found no code blocker and documentation claims now identify the generated operational worker ID.
- Hosted log sinks, HTTPS/CORS, account isolation, dependency and retention release evidence remain unverified; SEC-02 and public readiness remain partial.

## 2026-10-15 profile account-switch display guard

- Settings binds fetched `/api/me` data to the verified account ID and hides it while auth is busy or the identity is not verified. It also rejects a response whose profile ID does not match the account. Signed-in display names use the matching profile; device-global onboarding names are guest-only.
- Mobile tests: 190 passed; TypeScript lint and diff check passed. Independent review found no remaining cross-account render path. Offline mode may show the same account's last verified cached profile. The AUTH-02 parent remains partial pending hosted and native journeys.
