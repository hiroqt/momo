# API Contract Matrix (API-01)

Verified locally on **October 15, 2026** against backend/client code at **`8bd3e8e`**.
Requirements come from [ARD_PRD.md](../ARD_PRD.md) sections 8.1-8.10 and 6.6/6.7.
This matrix records how routes and mobile client methods map to them. It does
not change the PRD. Rows marked **Extension** are routes the PRD does not list.
Rows marked **Alias** are kept for compatibility with existing clients.

Contract tests: `backend/tests/test_prd_api_contracts.py` checks that every PRD
endpoint below appears in the generated OpenAPI document. It also checks the
canonical sync/detail/profile shapes, compatibility aliases, ownership, input
bounds and malformed IDs. Rechecked against the current code on October 15:
26 passed; Ruff passed. `backend/tests/test_economy_api.py` and
`backend/tests/test_economy_postgres.py` cover the economy contract.

Every route requires `Authorization: Bearer <supabase_jwt>`. Identity comes only
from the verified token. Errors use `{"error": {"code", "message"}}`.

## 8.1 Authentication

| PRD | Route | Mobile client | Status / compatibility |
| --- | --- | --- | --- |
| `GET /api/me` returns verified `user_id`, email, full name | `GET /api/me` (`routes/auth.py`) | `authApi.verify` (`lib/api/client.ts`), `profile.tsx` | Aligned. `id` is the verified subject. `email` comes from the persisted `public.users` row or the verified token claim. `full_name`/`avatar_url` come only from `public.users`. Unknown values are `null`; the former invented `{id}@example.com` / "Student Learner" values are gone. The response also carries quota fields (`documents_used_this_month`, `monthly_limit`, `quota_resets_at`, which is UTC midnight on the 1st). |
| `DELETE /api/me` deletes the verified account | `DELETE /api/me` (`routes/auth.py`) | Settings account-deletion action (`mobile/app/(tabs)/profile.tsx`) | AUTH-02 extension. User ID comes only from the verified Google OAuth JWT; the server uses Supabase Auth Admin with its service-role client. Auth FK cascades remove relational data and the upload-ticket FK trigger retires upload rows for cleanup. The mobile clears the signed-out account's SQLite partition after acceptance. Migration 015 maps confirmed pre-ticket uploads to Supabase `documents` and indexes retired legacy cleanup; it is local only. `202` confirms Auth deletion acceptance, not physical Storage removal; files missing from the upload inventory remain a release blocker. A confirmed `user_not_found` retry succeeds to recover from a lost first response. |

## 8.2 Document Management

| PRD | Route | Mobile client | Status / compatibility |
| --- | --- | --- | --- |
| `POST /api/documents/upload-url` | same | `requestUploadUrl` | Aligned; same request/response fields. Oversized declared files return 400 `DOCUMENT_TOO_LARGE` before ticket creation/signing; registration independently enforces the 15 MiB bound. |
| `POST /api/documents` with `id` | same | `registerDocument` sends `document_id` | **Alias.** `DocumentCreate` accepts canonical `id` and legacy `document_id`. If both are sent they must be the same UUID, otherwise 422. Values are canonicalized UUIDs. |
| `GET /api/documents` | same (bounded `limit`/`offset`) | `listDocuments` (page collector) | Aligned. |
| `GET /api/documents/{id}` | same | `getDocument` | Aligned. |
| `GET /api/documents/{id}/status` returns status, page count, error | same | `getDocumentStatus` | Aligned. The route returns nullable `page_count`; the mobile type includes it. |
| `DELETE /api/documents/{id}` | same | `deleteDocument` | Aligned. Generated study sets are kept (`ON DELETE SET NULL`). |
| none | `PUT /api/documents/mock-upload/{key}` | `uploadFileToS3` (local) | **Extension**, local mock storage only. |

## 8.3 Study Set Generation

| PRD | Route | Mobile client | Status / compatibility |
| --- | --- | --- | --- |
| `POST /api/generations` | same | `createGeneration` | Aligned. The response is a superset (`generation_id`, `status`, `stage`, `progress` plus metadata). `source_only` accepts only `true`. Reviewer fields are extensions. |
| `GET /api/generations/{id}` | same | `getGenerationStatus` | Aligned. |
| `POST /api/generations/{id}/retry` | same | `retryGeneration` | Aligned. |

## 8.4 Study Sets & Items

| PRD | Route | Mobile client | Status / compatibility |
| --- | --- | --- | --- |
| `GET /api/study-sets` | same (bounded pages) | `listStudySets` | Aligned. Includes `item_count`, `folder_id` and `generation_status`. |
| `POST /api/study-sets` creates a custom container | same, returns 201 (`StudySetCreateRequest`) | none yet | **Resolved; the route was missing.** Accepts only `title` (trimmed, 1-255 chars), `description` (≤10,000 chars) and an owned `folder_id`. Extra fields are rejected with 422, so a client cannot forge `user_id`, attach `document_id` or inject `study_items`. A foreign folder returns 404. New containers start with `item_count = 0`. |
| `GET /api/study-sets/{id}` returns the complete set with `study_items` | same (`StudySetDetailResponse`) | `getStudySet` | **Resolved.** The response now embeds `study_items` (provenance included) in addition to the set fields. Clients that read only set fields are unaffected. |
| none | `GET /api/study-sets/{id}/items` | `getStudyItems` | **Alias/Extension.** Kept for existing clients; its contents equal the embedded `study_items` (tested). |
| `PATCH /api/study-sets/{id}` | same | `updateStudySet`, `setStudySetFolder` | Aligned. Title ≤255 chars, description ≤10,000 chars. `folder_id` must be owned. `""`/`"none"`/`"null"` unassigns (legacy sentinel used by `setStudySetFolder`). |
| `DELETE /api/study-sets/{id}` | same | `deleteStudySet` | Aligned (items cascade). |
| none | `POST /api/study-sets/sessions` | none | **Extension.** `mode` must be `flashcards`, `quiz` or `exam` (PRD `study_sessions.mode`). |

Malformed study-set identifiers in paths/session bodies and malformed PATCH
`folder_id` values return `404 STUDY_SET_NOT_FOUND` / `FOLDER_NOT_FOUND` without
a database query (`POST /api/study-sets` types `folder_id` as a UUID and returns
422 instead). Before
this change they could surface as a generic database error. The
development/test memory store still accepts its arbitrary legacy keys.

## 8.5 Offline Event Synchronization

| PRD | Route | Mobile client | Status / compatibility |
| --- | --- | --- | --- |
| `POST /api/sync/events` → `{synced_ids, ignored_duplicates, credits_balance}` | `POST /api/sync/events` (canonical) | `sendSyncBatch` | **Resolved.** The response includes PRD `synced_ids` (every unique event ID that is durably stored after this call, including duplicates already present), `ignored_duplicates`, and the user's authoritative server `credits_balance`. Legacy `accepted_count`, `ignored_duplicates_count` and `processed_at` remain. Batches are capped at 100 events; `correct` events require an owned `study_item_id` and award one credit only when newly inserted. An invalid or foreign reference rejects the whole batch, and nothing is acknowledged. |
| none | `POST /api/sync` | older clients | **Alias**, marked `deprecated` in OpenAPI; same handler and semantics. Remove it only after older builds are retired. |
| `result` ∈ correct/incorrect/review_again/skipped | also accepts `mastered`, `review_later` | client sends the PRD four | **Compatibility superset** for older learning events; both extras are covered by the DB check constraint. |

Idempotency scope is `(user_id, event_id)`. Newly accepted `correct` events credit
one Momo Coin through the server ledger; correctness is client-attested under the
approved MVP policy. Sync does not credit XP or hearts; see Economy below.

## 8.6 Folders & Organization

| PRD | Route | Mobile client | Status / compatibility |
| --- | --- | --- | --- |
| `GET/POST/GET{id}/PATCH/DELETE /api/folders` | same (`routes/folders.py`) | `listFolders`, `createFolder`, `updateFolder`, `deleteFolder` | CRUD aligned. `POST` atomically applies the PRD progressive price and records owner-scoped replay in `internal.folder_requests`; folders 1–3 are free, then 50, 75, +25 credits. Legacy queued requests replay without a second charge; changed requests/deleted tombstones remain conflicts. The mobile sync path sends a stable `Idempotency-Key`; omission remains compatible with older clients. Newly accepted correct-answer sync events earn one client-attested credit each; a modified client can farm them. Heart regeneration/refill remains pending. |

## 8.7-8.10

| PRD | Route | Mobile client | Status |
| --- | --- | --- | --- |
| `POST /api/math/solve` | same | `solveMathProblem` | Routed. Bounds and provider behavior belong to MATH-01/AI-04. |
| `GET /api/stats/streak` | same | `getStreak` | Routed. |
| `GET/POST /api/chat/sessions`, `GET /api/chat/sessions/{id}`, `POST .../messages`, `POST /api/chat/import-card` | same | `listChatSessions`, `createChatSession`, `getChatSession`, `sendChatMessage`, `importCardToLibrary` | Routed. Body bounds and grounding belong to CHAT-01/AI-01. `generate_study_card` rejects expired/malformed-expiry sources before retrieval. Card import resolves an owned READY/unexpired document and exact server-fetched chunk, runs deterministic validation and Jev semantic verification, then persists; paraphrased cards grounded in prose are supported. Native and hosted journeys remain open. |
| none | `DELETE /api/chat/sessions/{id}`, `POST /api/chat` | `deleteChatSession`, `quickChat` | **Extensions.** |
| `POST /api/images/generate` | same | `generateImage`, `generateStudyImage` | Routed; validates strict base64, PNG/JPEG/WebP MIME/signature, ≤15 MiB decoded bytes and ≤16 megapixels. OpenRouter response is streamed with a bounded encoded-body limit before JSON parsing. Provider/native staging proof remains IMAGE-01. |

## Economy (PRD 6.6/6.7): new server contract

The router lives in `routes/economy.py` and is registered in `main.py`. Wallet and
heart routes are available; unapproved refill policy fails closed. Clients
send only intent plus an `idempotency_key` (8-128 characters from `[A-Za-z0-9_.:-]`,
scoped per user). Extra fields such as `hearts_delta` or `user_id` are rejected.

| Route | Behavior |
| --- | --- |
| `GET /api/economy/wallet` | `hearts` (max **5**, per PRD), `credits`, `xp`, `version`, `folder_count`, `next_folder_cost`, `next_heart_at`, and `policy` (pending values are `null`). A wallet is created on first use with 5 hearts and 0 credits/XP. Mobile account wallet loads the server credits balance on account load. |
| `POST /api/economy/hearts/consume` `{idempotency_key, study_item_id?}` | PRD: an incorrect quiz answer costs 1 heart. Replays return the original entry (`replayed: true`). Reusing a key for a different request returns `409 IDEMPOTENCY_KEY_REUSED`. At 0 hearts it returns `409 INSUFFICIENT_HEARTS`. A foreign item returns 404. |
| `POST /api/economy/hearts/refill` `{idempotency_key, hearts}` | Returns `503 ECONOMY_POLICY_PENDING` until a coin price is approved. With a price: `409 HEARTS_FULL` / `INSUFFICIENT_CREDITS`. |

Folder price (PRD 6.6, used by `folder_credit_cost` in Python and SQL): folders
1-3 cost 0. The Nth folder (N ≥ 4) costs `50 + (N - 4) × 25`, so the 4th costs 50
and the 5th costs 75.

Database (`migrations/005_economy_ledger.sql`): `economy_wallets` and
`economy_ledger` have forced RLS, owner-only SELECT for `authenticated` and no
`anon` access. Balances have CHECK constraints (`0 ≤ hearts ≤ 5`, `credits/xp ≥ 0`).
Ledger uniqueness is `(user_id, idempotency_key)`. Composite FKs
`(study_item_id,user_id)` and `(folder_id,user_id)` use `ON DELETE SET NULL`.
Rows cascade on `auth.users` deletion. The RPCs `get_economy_wallet`,
`apply_economy_entry` and `create_folder_with_charge` (plus helpers) are
service-only and use a fixed `search_path`. They lock the wallet row, so
concurrent spends serialize and cannot overdraft.

Pending product inputs (not invented): the heart regeneration interval, the coin
price for heart refills, XP amounts per difficulty/format, XP→credit/heart
conversion rates, cosmetic prices, and how quiz reveals and flashcard results map
to rewards. Correct-answer events award one client-attested Momo Coin through a
database trigger in migration 017; only newly inserted events with an owned study
item receive it. A modified client can falsify correctness, so server-side answer
adjudication remains open. Until remaining policy is approved, regeneration is
off and refill paths fail closed.

## October 8 request replay contracts (local evidence)

`POST /api/generations` accepts an optional `Idempotency-Key` (8–128 ASCII letters,
digits, underscore, period, colon or hyphen). Persist one key with the original
request before sending; reuse it after timeouts/lost responses. The server scopes
keys to verified identity and fingerprints the validated original request. A replay
returns the current job/status; changed settings under the same key return
`409 IDEMPOTENCY_KEY_REUSED`. Fresh generation requires an owned READY, unexpired
source. Completed job replay is still available after source expiry. Failed jobs
restart only through the explicit retry endpoint. A durable retry-dispatch flag
is consumed in the same transaction as queue reset, allowing recovery of an interrupted explicit retry; ordinary create replay cannot
reset automatic recovery budgets. No key retains independent-create behavior.
The mobile generation flow now persists its key, validated settings and received job
in account-partitioned SQLite before sending/navigation. Restarts reuse unfinished
intent; an owned status read acknowledges receipt. Transport pins owner/account epoch,
bounds the whole request deadline and never guesses another port for mutations.
Uncertain explicit retry responses reconcile through GET without another POST.
Local file-SQLite/real-JWT HTTP evidence exists; native release journeys remain WORK-02/QA-01.

`POST /api/folders` accepts optional `Idempotency-Key` (1–128 characters from the
same ASCII alphabet). Same key/details return the existing folder including later
renames/counts. Changed details return409; deletion retains a tombstone and replay
returns `409 FOLDER_REQUEST_DELETED`. Keys are owner-scoped and client access to
request tables is denied. Omitted colors resolve to the schema's `#4F46E5` default.
No key retains existing duplicate-name compatibility. This does not activate
idempotent replay: no-key requests are still priced, but retries can conflict on
the existing normalized-name constraint. The PRD folder price is active. By user
approval, each newly accepted client-attested correct-answer sync event earns one
credit when it belongs to an owned study item; this remains vulnerable to modified
clients and requires the API deployment and hosted sync journey before hosted
availability is verified.

Apply migrations 008–011 before deploying this API revision. Both request mappings
are internal forced-RLS tables and service-only RPCs. Local SQL/API concurrency and
lost-response tests are supporting evidence; managed PostgREST and two-device proof
remain open.

## October8 immutable upload response extension

`POST /api/documents/upload-url` additionally returns upload_headers. Clients must
forward Content-Type and provider constraints (S3 If-None-Match:*); existing S3
clients that omit newly signed required headers will fail closed and need the
coordinated client release. Supabase signing explicitly disallows upsert.
Mobile helpers permit only known constraint headers, never provider Authorization.
Development relative mock API uploads use the authenticated API session instead.
Failed PUT prevents registration; mock duplicates return409 UPLOAD_ALREADY_EXISTS.
Local mock binary PUT cap is the configured15MiB; other API requests retain10MiB.
Registration clock/ticket/orphan lifecycle changes are still pending RET-01.

## October8 upload lifecycle contract

Upload destinations are persisted as service-only tickets before signing. Registration
requires the owned ticket and verified object observation; the database derives expiry
from actual upload+72h and fences replay against expiry/cleanup leases. New unticketed,
retired or mismatched-location registration fails closed with a safe conflict. The
local mock PUT likewise requires an eligible issued ticket. DELETE retires the ticket
before removing original bytes; incomplete physical deletion returns503 and retains
retryable responsibility. Generated material is preserved. Unknown legacy origins
require verification before deletion; see [retention rollout](UPLOAD_RETENTION_DESIGN.md).
