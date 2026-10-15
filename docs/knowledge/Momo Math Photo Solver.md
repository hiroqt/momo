---
tags: [momo, backend, ai, math, readiness]
audited: 2026-10-15
status: local-policy-implemented-hosted-unverified
---
# Momo Math Photo Solver

Parent: [[Momo Public Readiness]]. Task gates: AI-04 and MATH-01. Dependency map: [[Momo Readiness Map.canvas]].

## Approved model policy

On 2026-10-15 the user approved one configured model for math-photo solving and selected `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free`. The [OpenRouter model page](https://openrouter.ai/nvidia/nemotron-3-nano-omni-30b-a3b-reasoning) currently lists image input and free pricing. Availability and math accuracy have not been verified by a live inference request.

Image requests go directly to the configured vision model. They do not route through OCR plus text-model fallback, and provider, transport, HTTP or malformed-response failures return the existing controlled unavailable result. Typed equation requests retain their separate text-solving behavior. The model ID is explicit in Render's API and worker configuration and the staging/production templates; managed startup rejects a missing or placeholder value.

## Local verification and remaining gates

Focused AI/environment/math tests passed 223. The complete isolated PostgreSQL/PostgREST backend suite passed 950 tests with zero skips, errors or failures. Ruff 142 and mypy 76 passed; `render.yaml` parses. No inference request through a deployed API or deployment was made.

The 2026-10-15 MATH-01 input-validation slice now accepts only strictly decoded JPEG, PNG or WebP photos, caps decoded bytes at 6 MiB and dimensions at 16 MP, and returns `422 INVALID_IMAGE` before provider egress for malformed, unsupported or truncated data. The configured provider request uses the detected MIME type. Regression tests cover these boundaries and image-format preservation. Focused math/provider tests: 139 passed; full isolated PostgreSQL/PostgREST suite: 995 passed with zero skips, errors or failures; Ruff and mypy pass. Two separately approved synthetic OpenRouter calls returned controlled `AI_UNAVAILABLE`; the latest used a synthetic `2 + 2` PNG. Neither was retried, so provider availability and answer quality remain unverified.

The API-01 compatibility follow-up preserves both request forms: current mobile raw Base64 and the PRD's `data:<mime>;base64,...` form. The route strips data-URI metadata before validation and provider invocation, and rejects a declared MIME that disagrees with the decoded image. The PRD, OpenAPI schema and API matrix now state this contract. Focused API/math tests: 57 passed; the full local PostgreSQL/PostgREST suite passed 1,000 tests with zero skips. The two live smoke results above are the only approved provider attempts.

AI-04 and MATH-01 remain partial until bounded provider availability/latency and representative math-photo accuracy are checked. Because the image is sent to OpenRouter, the public privacy disclosure/vendor review also remains required. Render HTTPS URL, secrets and CORS are still pending from the user.
