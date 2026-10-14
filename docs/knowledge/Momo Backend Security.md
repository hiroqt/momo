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

Latest local suite: 832 backend/API/PG/PostgREST gateway tests passed, zero skipped; Ruff 138 files and mypy 75 files passed. Staging schema/security checks and the exact scope limits are recorded in [[docs/backend-readiness-2026-10-14|October 14 report]]. No hosted application traffic or production capacity proof. No claim of absolute security.

Upload retention uses durable tickets and preserves actual upload time/identity, but generation-safe Supabase physical deletion and legacy/unregistered inventory remain open. Read [[docs/UPLOAD_RETENTION_DESIGN|retention design]] and [[Momo Upload Retention]]. Public launch remains blocked on managed auth/API/storage/provider journeys and operations.

## 2026-10-14 SEC-02 audit update

- Provider/worker/storage source review and sentinel log tests now cover image-provider failures, document-processing failures, and upload-cleanup storage failures. These audited paths exclude request prompt, credential, content, signed URL, and raw provider/storage exception details from logs.
- Some operational worker logs retain opaque document/job/study-set UUIDs for correlation; reviewed calls showed no user UUID, object key, filename, or content.
- Backend dependency audit: zero known advisories after safe PyJWT/multidict updates. Web dependency audit: zero known advisories after compatible fixes.
- Mobile dependency audit remains open: 31 advisories (19 high, 12 moderate) in the Expo/React Native graph. Forced remediation was not used because it proposes a breaking SDK/downgrade.
- Expo dependency check, iOS/Android exports, web build and known-pattern scan of 106 built files passed. The pattern scan found no matches but does not prove arbitrary secrets absent.
- SEC-02 is still a public-release blocker: hosted HTTPS/CORS, two-account isolation, object-retention/deletion, and mobile dependency remediation remain unverified/open. No hosted provider traffic was sent.
- Evidence: `docs/backend-readiness-2026-10-14.md`, `docs/PRODUCTION_READINESS_CHECKLIST.md` SEC-02 rows.
