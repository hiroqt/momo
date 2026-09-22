# Security Architecture & Secret Isolation

This document outlines the security architecture, client-server isolation boundary, AI safety guardrails, and rate limiting policies for the AI Study Platform.

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
