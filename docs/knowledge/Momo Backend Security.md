---
tags: [momo, security, backend]
audited: 2026-10-14
---
# Momo Backend Security

Parent: [[Momo Public Readiness]]. Related: [[Momo Authentication]], [[Momo Database]], [[Momo Deployment]].

## Local protections

Verified JWT identity, owner-filtered repositories, forced RLS and same-owner foreign keys already exist. Upload registration/quota, answer sync and generation finalization use transactions. Managed configuration rejects memory persistence, development identity, mock embeddings, inline workers and cross-environment database URLs. Rate limits use shared PostgreSQL state and fail closed.

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
