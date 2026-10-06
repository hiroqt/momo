# Security Architecture & Secret Isolation

Current implementation gaps and release gates are tracked in the
[Production Readiness Checklist](PRODUCTION_READINESS_CHECKLIST.md).
This document defines the intended security boundaries; it does not certify all
provider, client or deployed paths as verified. Read AI-01/AI-02, AUTH-01/AUTH-02,
SEC-01/SEC-02 and the environment gates before choosing security work.

This document outlines the security architecture, client-server isolation boundary, AI safety guardrails, and rate limiting policies for the AI Study Platform.

## Database And Authorization Boundary (October 6, 2026)

`002_tenant_security.sql` enables and forces RLS for every application table,
grants authenticated owner-only reads, and revokes anonymous access and direct
client mutations. Ownership references Supabase Auth, and composite foreign keys
prohibit cross-user links. Service-role repositories still validate ownership
explicitly because elevated keys bypass RLS. Functions have fixed search paths
and service-only execution grants. Historical integrity violations abort rollout.

JWT authorization verifies signatures and required issuer, audience, expiry,
role, and subject claims. Unsigned decoding is prohibited. Development identity
and memory persistence require explicit local settings; production rejects both.
Live storage/database errors never fall back to fabricated or memory data.

Registration checks actual object size before acceptance. Workers validate file
signatures, text encoding, Office archive structure/expansion, and page limits,
then retain SHA-256 of actual bytes internally. Hashing does not conceal readable
study content or replace encryption. Supabase Auth owns password handling; all
provider secrets stay in server environment configuration. Validation errors
exclude echoed input; client-visible failures use controlled messages.

Original object access uses private buckets and UUID owner/document paths.
Schedule `python -m app.workers.cleanup_worker` with monitoring to enforce
physical deletion after expiry. RLS and expiry filtering alone cannot delete
object bytes. Signed URLs are bearer capabilities and must not be logged.

Local tests block outgoing provider sockets and reject non-loopback database
targets. Supabase MCP was used for project discovery/documentation; the user
selected preparation for a new Momo project, so no hosted schema or data changed.
See [verification and rollout](BACKEND_DATABASE_SECURITY.md).

Updated October 6, 2026: outside development/test memory mode, rate limits use
the shared PostgreSQL sliding window (`consume_rate_limit`, migration 006) and
fail closed with 503 when that state is unavailable. Document ingestion and
generation run as durable leased jobs (`internal.background_jobs`) claimed by a
separate `python -m app.workers.runner` process. Both are verified only against
local PostgreSQL 16 with concurrent connections; managed multi-replica behavior
is unverified until staging rollout. Local smoke and stress tests do not prove
production capacity or guarantee absence of every possible information leak.

---

## 1. Zero-Exposure Frontend Policy

The mobile client (React Native / Expo) operates under a **Zero-Trust, Zero-Secret** model.

### Key Rules
1. **No External AI Provider Endpoints**: The mobile app NEVER makes direct requests to OpenRouter, NVIDIA Nemotron, or any third-party AI service.
2. **No Provider Credentials in Client Bundles**: Secrets such as `OPENROUTER_API_KEY`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` reside exclusively in server-side environment variables and are never bundled into JavaScript/Expo client code.
3. **Gateway Pattern**: All AI inference, RAG embeddings, OCR, and document processing are mediated exclusively through the FastAPI backend gateway.
4. **Bearer Token Authentication**: The mobile app only retains the student's authenticated session JWT and sends it via standard `Authorization: Bearer <token>` headers.

```
+------------------------------------+
|       Expo / React Native App      |
|  - Zero AI API keys                |
|  - Zero AWS secret keys            |
|  - ONLY calls /api/* on backend    |
+------------------------------------+
                  |
                  | (HTTPS + Bearer Token)
                  v
+------------------------------------+
|          FastAPI Backend           |
|  - Authenticates user ID           |
|  - Enforces Rate Limiting (429)    |
|  - Enforces Input Guardrails       |
|  - Calls NVIDIA Nemotron via       |
|    server-held OPENROUTER_API_KEY  |
|  - Sanitizes Output against leaks  |
+------------------------------------+
```

---

## 2. AI Safety Guardrails Subsystem

Implemented in `backend/app/services/security/guardrails_service.py`:

### 2.1 Input Guardrails
- **Prompt Injection & Jailbreak Defense**:
  - Automatically detects and intercepts adversarial payloads (e.g. `ignore previous instructions`, `DAN mode`, `developer mode`, `override system prompt`, `reveal instructions`).
  - Delivers a safe, pedagogical refusal response without invoking LLM tokens.
- **Harmful / Dangerous Topic Filter**:
  - Flags prohibited categories including self-harm/suicide, weapons/explosives, cyberattack malware generation, and live proctored exam cheating.
  - Returns supportive or educational refusal redirects.
- **Structural Boundary Isolation**:
  - Segregates untrusted user queries and retrieved document evidence using XML delimiters (`<user_query>` and `<source_evidence>`).
  - Instructs the model that contents within delimiters are untrusted reference data, not system directives.

### 2.2 Output Guardrails
- **Credential Leak Redaction**:
  - Scans all outgoing model responses (chat messages, flashcards, quizzes, explanations) for accidental secret or key leaks.
  - Automatically redacts OpenRouter keys (`sk-or-v1-...`), AWS credentials (`AKIA...`), Supabase tokens, and JWT strings with `[REDACTED_*]`.
- **System Prompt Regurgitation Guard**:
  - Prevents the assistant from leaking internal system prompts verbatim.

---

## 3. Sliding-Window Rate Limiting

Implemented in `backend/app/services/security/rate_limiter.py`:

### 3.1 Rate Limits by Endpoint
| Category | Endpoint | Default Limit | Policy |
| :--- | :--- | :--- | :--- |
| **Chat** | `POST /api/chat/sessions/{id}/messages`<br>`POST /api/chat` | 20 req / min | Per Authenticated User |
| **Generations** | `POST /api/generations`<br>`POST /api/generations/{id}/retry` | 5 req / min | Per Authenticated User |
| **Math Solver** | `POST /api/math/solve` | 10 req / min | Per Authenticated User |
| **Global** | Fallback / Unauthenticated | 60 req / min | Per Client IP |

### 3.2 Response Format
When a limit is exceeded, the server returns standard HTTP 429:
```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests for chat. Please wait 45 second(s) before trying again.",
    "retry_after": 45
  }
}
```
With standard RFC compliance headers:
- `Retry-After: 45`
- `X-RateLimit-Limit: 20`
- `X-RateLimit-Remaining: 0`
- `X-RateLimit-Reset: <epoch>`
