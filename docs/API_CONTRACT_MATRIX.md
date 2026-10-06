# API Contract Matrix (API-01)

Verified locally on **October 6, 2026** against the working tree (base `896d534`).
Requirements come from [ARD_PRD.md](../ARD_PRD.md) sections 8.1-8.10 and 6.6/6.7.
This matrix records how routes and mobile client methods map to them. It does
not change the PRD. Rows marked **Extension** are routes the PRD does not list.
Rows marked **Alias** are kept for compatibility with existing clients.

Contract tests: `backend/tests/test_prd_api_contracts.py` checks that every PRD
endpoint below appears in the generated OpenAPI document. It also checks the
canonical sync/detail/profile shapes, compatibility aliases, ownership, input
bounds and malformed IDs. `backend/tests/test_economy_api.py` and
`backend/tests/test_economy_postgres.py` cover the economy contract.

Every route requires `Authorization: Bearer <supabase_jwt>`. Identity comes only
from the verified token. Errors use `{"error": {"code", "message"}}`.

## 8.1 Authentication

| PRD | Route | Mobile client | Status / compatibility |
| --- | --- | --- | --- |
| `GET /api/me` returns verified `user_id`, email, full name | `GET /api/me` (`routes/auth.py`) | `authApi.verify` (`lib/api/client.ts`), `profile.tsx` | Aligned. `id` is the verified subject. `email` comes from the persisted `public.users` row or the verified token claim. `full_name`/`avatar_url` come only from `public.users`. Unknown values are `null`; the former invented `{id}@example.com` / "Student Learner" values are gone. The response also carries quota fields (`documents_used_this_month`, `monthly_limit`, `quota_resets_at`, which is UTC midnight on the 1st). |

## 8.2 Document Management

| PRD | Route | Mobile client | Status / compatibility |
| --- | --- | --- | --- |
| `POST /api/documents/upload-url` | same | `requestUploadUrl` | Aligned; same request/response fields. |
| `POST /api/documents` with `id` | same | `registerDocument` sends `document_id` | **Alias.** `DocumentCreate` accepts canonical `id` and legacy `document_id`. If both are sent they must be the same UUID, otherwise 422. Values are canonicalized UUIDs. |
| `GET /api/documents` | same (bounded `limit`/`offset`) | `listDocuments` (page collector) | Aligned. |
| `GET /api/documents/{id}` | same | `getDocument` | Aligned. |
| `GET /api/documents/{id}/status` returns status, page count, error | same | `getDocumentStatus` | **Gap.** `DocumentStatusResponse` has no `page_count`. The route belongs to another team; see the report's cross-team requests. |
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
| `POST /api/sync/events` → `{synced_ids, ignored_duplicates}` | `POST /api/sync/events` (canonical) | `sendSyncBatch` | **Resolved.** The response includes PRD `synced_ids` (every unique event ID that is durably stored after this call, including duplicates already present) and `ignored_duplicates`. Legacy `accepted_count`, `ignored_duplicates_count` and `processed_at` remain. Batches are capped at 100 events. An invalid or foreign reference rejects the whole batch, and nothing is acknowledged. |
| none | `POST /api/sync` | older clients | **Alias**, marked `deprecated` in OpenAPI; same handler and semantics. Remove it only after older builds are retired. |
| `result` ∈ correct/incorrect/review_again/skipped | also accepts `mastered`, `review_later` | client sends the PRD four | **Compatibility superset** for older learning events; both extras are covered by the DB check constraint. |

Idempotency scope is `(user_id, event_id)`. Sync does **not** credit XP or hearts
yet; see Economy below for the reason.

## 8.6 Folders & Organization

| PRD | Route | Mobile client | Status / compatibility |
| --- | --- | --- | --- |
| `GET/POST/GET{id}/PATCH/DELETE /api/folders` | same (`routes/folders.py`, owned by another team) | `listFolders`, `createFolder`, `updateFolder`, `deleteFolder` | CRUD aligned. **Gap:** `POST /api/folders` does not check the credit economy yet, and it ignores the `Idempotency-Key` header that `createFolder` now sends. The atomic, idempotent server operation exists as `economy_repo.create_folder_with_charge` / RPC `create_folder_with_charge`. Wiring it in is BLOCKED_INPUT (see the report). |

## 8.7-8.10

| PRD | Route | Mobile client | Status |
| --- | --- | --- | --- |
| `POST /api/math/solve` | same | `solveMathProblem` | Routed. Bounds and provider behavior belong to MATH-01/AI-04. |
| `GET /api/stats/streak` | same | `getStreak` | Routed. |
| `GET/POST /api/chat/sessions`, `GET /api/chat/sessions/{id}`, `POST .../messages`, `POST /api/chat/import-card` | same | `listChatSessions`, `createChatSession`, `getChatSession`, `sendChatMessage`, `importCardToLibrary` | Routed. Body bounds and grounding belong to CHAT-01/AI-01. |
| none | `DELETE /api/chat/sessions/{id}`, `POST /api/chat` | `deleteChatSession`, `quickChat` | **Extensions.** |
| `POST /api/images/generate` | same | `generateImage`, `generateStudyImage` | Routed; IMAGE-01. |

## Economy (PRD 6.6/6.7): new server contract

The router lives in `routes/economy.py`. It is **not registered in `main.py` yet**;
final integration owns that file. All amounts are computed on the server. Clients
send only intent plus an `idempotency_key` (8-128 characters from `[A-Za-z0-9_.:-]`,
scoped per user). Extra fields such as `hearts_delta` or `user_id` are rejected.

| Route | Behavior |
| --- | --- |
| `GET /api/economy/wallet` | `hearts` (max **5**, per PRD), `credits`, `xp`, `version`, `folder_count`, `next_folder_cost`, `next_heart_at`, and `policy` (pending values are `null`). A wallet is created on first use with 5 hearts and 0 credits/XP. |
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
price for heart refills, XP amounts per difficulty/format, how coins are earned,
XP→credit/heart conversion rates, cosmetic prices, and how quiz reveals and
flashcard results map to rewards. Until these are approved, regeneration is off
and the refill/reward paths fail closed.
