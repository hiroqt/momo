"""Atomic, idempotent append of a previously source-validated chat card."""
import copy
import json
from datetime import UTC, datetime
from typing import Any
from uuid import NAMESPACE_URL, uuid5

from fastapi import HTTPException

from app.db.repositories.chunks_repo import chunks_repo
from app.db.repositories.documents_repo import documents_repo
from app.db.repositories.study_repo import study_repo
from app.db.session import supabase_session
from app.services.validation.grounding_validator import (
    StudyItemCandidate,
    grounding_validator,
)


def import_ids(user_id: str, title: str, item: dict[str, Any]) -> tuple[str, str]:
    identity = f"momo-chat-import:{user_id}:{title}"
    metadata = item["source_metadata"]
    canonical = {
        "type": item["type"], "difficulty": item.get("difficulty", "medium"),
        **{key: " ".join((item.get(key) or "").split()) for key in ("question", "answer", "explanation")},
        "options": [" ".join(option.split()) for option in item["options"]] if item.get("options") else None,
        # Display names and ranking labels change without changing the evidence.
        "source_metadata": {key: metadata.get(key) for key in ("document_id", "chunk_id", "page", "section", "snippet")},
    }
    content = json.dumps(canonical, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return str(uuid5(NAMESPACE_URL, identity)), str(uuid5(NAMESPACE_URL, identity + ":" + content))


def unavailable_source() -> HTTPException:
    return HTTPException(422, detail={"code": "UNVERIFIED_SOURCE", "message": "This card requires available verified source material."})


class ChatImportRepository:
    async def persist_card(self, user_id: str, title: str, item: dict[str, Any], document_id: str) -> dict[str, Any]:
        title = title.strip()
        if not title or len(title) > 255:
            raise ValueError("Invalid import title")
        # Whitelist content fields; transport IDs/timestamps must not affect retries.
        payload: dict[str, Any] = {key: copy.deepcopy(item[key]) for key in
                   ("type", "question", "answer", "explanation", "options", "difficulty", "source_metadata") if key in item}
        StudyItemCandidate.model_validate(payload)
        # Provenance/support were verified by the caller; re-check format defensively.
        if not grounding_validator.validate_structure(payload):
            raise ValueError("Invalid validated chat card")
        if payload.get("difficulty", "medium") not in {"easy", "medium", "hard"}:
            raise ValueError("Invalid card difficulty")
        set_id, item_id = import_ids(user_id, title, payload)
        if supabase_session.is_configured and supabase_session.client:
            try:
                response = await supabase_session.execute(supabase_session.client.rpc("persist_chat_card", {
                    "p_user_id": user_id, "p_title": title, "p_document_id": document_id,
                    "p_set_id": set_id, "p_item_id": item_id, "p_item": payload,
                }))
                if not isinstance(response.data, dict) or response.data.get("user_id") != user_id:
                    raise RuntimeError("Invalid import result")
                return response.data
            except Exception as exc:  # noqa: BLE001 - redact provider errors and never fall back
                if getattr(exc, "code", "") in {"42501", "22023"}:
                    raise unavailable_source() from None
                raise HTTPException(503, detail={"code": "IMPORT_UNAVAILABLE", "message": "The study card could not be saved. Please retry."}) from None
        if not supabase_session.use_memory:
            raise RuntimeError("Local import persistence is unavailable")

        # No await in the local transaction: validate everything before modifying stores.
        document = documents_repo._store.get(document_id)
        metadata = payload["source_metadata"]
        if not document or document.get("user_id") != user_id or document.get("processing_status") != "READY":
            raise unavailable_source()
        try:
            expires = datetime.fromisoformat(document.get("expires_at", "").replace("Z", "+00:00"))
        except (ValueError, TypeError, AttributeError):
            raise unavailable_source() from None
        if expires.tzinfo is None or expires <= datetime.now(UTC):
            raise unavailable_source()
        chunk = next((row for row in chunks_repo._store.get(document_id, [])
                      if row.get("user_id") == user_id and (row.get("id") or row.get("chunk_id")) == metadata.get("chunk_id")), None)
        if not chunk or metadata.get("document_id") != document_id:
            raise unavailable_source()
        if any(metadata.get(key) != value for key, value in {
            "page": chunk.get("page_start", 1), "section": chunk.get("section", "General"),
            "snippet": chunk.get("content", "").strip()[:200],
        }.items()):
            raise unavailable_source()
        existing = sorted((row for row in study_repo._study_sets.values()
                           if row.get("user_id") == user_id and row.get("title") == title),
                          key=lambda row: (row["created_at"], row["id"]))
        target = existing[0] if existing else None
        if target is None and set_id in study_repo._study_sets:
            raise unavailable_source()
        now = datetime.now(UTC).isoformat()
        if target is None:
            target = {"id": set_id, "user_id": user_id, "document_id": document_id, "title": title,
                      "description": "Imported verified cards from Momo conversation", "generation_status": "COMPLETED",
                      "generation_config": {"source_only": True}, "created_at": now, "updated_at": now, "item_count": 0}
        rows = study_repo._study_items.get(target["id"], [])
        collision = next((row for stored in study_repo._study_items.values() for row in stored if row.get("id") == item_id), None)
        if collision and collision.get("study_set_id") != target["id"]:
            raise unavailable_source()
        if not collision:
            rows = [*rows, {**payload, "id": item_id, "user_id": user_id, "study_set_id": target["id"],
                           "order_index": max((row.get("order_index", 0) for row in rows), default=-1) + 1, "created_at": now}]
        study_repo._study_sets[target["id"]] = target
        study_repo._study_items[target["id"]] = rows
        target.update(item_count=len(rows), updated_at=now)
        return copy.deepcopy(target)

    async def persist_deck(
        self,
        user_id: str,
        document_id: str,
        title: str,
        description: str,
        generation_config: dict[str, Any],
        items: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """Atomically create a validated chat deck with all items, idempotent on content."""
        title = title.strip()[:255]
        if not title or not 1 <= len(items) <= 100 or generation_config.get("source_only") is not True:
            raise ValueError("Invalid validated chat deck")
        payloads = []
        for item in items:
            payload = {key: copy.deepcopy(item[key]) for key in DECK_ITEM_KEYS if key in item}
            if (
                not grounding_validator.validate_structure(payload)
                or payload.get("difficulty", "medium") not in {"easy", "medium", "hard"}
                or payload["source_metadata"].get("document_id") != document_id
            ):
                raise ValueError("Invalid validated chat deck")
            payloads.append(payload)
        set_id = deck_id(user_id, document_id, title, payloads)
        config = copy.deepcopy(generation_config)
        if supabase_session.is_configured and supabase_session.client:
            try:
                response = await supabase_session.execute(supabase_session.client.rpc("persist_chat_deck", {
                    "p_user_id": user_id, "p_document_id": document_id, "p_set_id": set_id,
                    "p_set": {"title": title, "description": description, "generation_config": config},
                    "p_items": payloads,
                }))
                if not isinstance(response.data, dict) or response.data.get("user_id") != user_id:
                    raise RuntimeError("Invalid deck result")
                return response.data
            except Exception as exc:  # noqa: BLE001 - redact provider errors and never fall back
                if getattr(exc, "code", "") in {"42501", "22023"}:
                    raise unavailable_source() from None
                raise HTTPException(503, detail={"code": "DECK_UNAVAILABLE", "message": "The study deck could not be saved. Please retry."}) from None
        if not supabase_session.use_memory:
            raise RuntimeError("Local deck persistence is unavailable")

        # No await below: validate everything, then write set and items together.
        existing = study_repo._study_sets.get(set_id)
        if existing is not None:
            if existing.get("user_id") != user_id:
                raise unavailable_source()
            return copy.deepcopy(existing)
        document = documents_repo._store.get(document_id)
        if not document or document.get("user_id") != user_id or document.get("processing_status") != "READY":
            raise unavailable_source()
        try:
            expires = datetime.fromisoformat(document.get("expires_at", "").replace("Z", "+00:00"))
        except (ValueError, TypeError, AttributeError):
            raise unavailable_source() from None
        if expires.tzinfo is None or expires <= datetime.now(UTC):
            raise unavailable_source()
        owned = {
            str(row.get("id") or row.get("chunk_id")): row
            for row in chunks_repo._store.get(document_id, [])
            if row.get("user_id") == user_id
        }
        for payload in payloads:
            metadata = payload["source_metadata"]
            chunk = owned.get(str(metadata.get("chunk_id")))
            if not chunk or any(metadata.get(key) != value for key, value in {
                "page": chunk.get("page_start", 1), "section": chunk.get("section") or "General",
                "snippet": chunk.get("content", "").strip()[:200],
            }.items()):
                raise unavailable_source()
        now = datetime.now(UTC).isoformat()
        saved = {"id": set_id, "user_id": user_id, "document_id": document_id, "title": title,
                 "description": description, "generation_status": "COMPLETED", "generation_config": config,
                 "created_at": now, "updated_at": now, "item_count": len(payloads)}
        study_repo._study_items[set_id] = [
            {**payload, "id": str(uuid5(NAMESPACE_URL, f"{set_id}:{index}")), "user_id": user_id,
             "study_set_id": set_id, "order_index": index, "created_at": now}
            for index, payload in enumerate(payloads)
        ]
        study_repo._study_sets[set_id] = saved
        return copy.deepcopy(saved)


DECK_ITEM_KEYS = ("type", "question", "answer", "explanation", "options", "difficulty", "source_metadata")


def deck_id(user_id: str, document_id: str, title: str, items: list[dict[str, Any]]) -> str:
    """Deterministic deck identity: identical validated content retried never duplicates."""
    canonical = [
        {
            "type": item["type"],
            **{key: " ".join((item.get(key) or "").split()) for key in ("question", "answer", "explanation")},
            "options": item.get("options"),
            "chunk_id": item["source_metadata"].get("chunk_id"),
        }
        for item in items
    ]
    content = json.dumps(canonical, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return str(uuid5(NAMESPACE_URL, f"momo-chat-deck:{user_id}:{document_id}:{title}:{content}"))


chat_import_repo = ChatImportRepository()
