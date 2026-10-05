import logging
import uuid
from datetime import UTC, datetime
from typing import Any

from app.db.session import page_range, supabase_session

logger = logging.getLogger(__name__)

class ChatRepository:
    def __init__(self) -> None:
        # In-memory store: session_id -> session dict
        self._sessions: dict[str, dict[str, Any]] = {}
        # session_id -> list of message dicts
        self._messages: dict[str, list[dict[str, Any]]] = {}

    async def create_session(self, user_id: str, title: str | None = None) -> dict[str, Any]:
        session_id = str(uuid.uuid4())
        now = datetime.now(UTC).isoformat()
        session_data = {
            "id": session_id,
            "user_id": user_id,
            "title": (title or "").strip() or "Chat with Momo",
            "created_at": now,
            "updated_at": now,
            "message_count": 0
        }

        if supabase_session.is_configured and supabase_session.client:
            resp = await supabase_session.execute(supabase_session.client.table("chat_sessions").insert(session_data))
            if resp.data:
                return resp.data[0]
            raise RuntimeError("Chat session insert returned no record")

        self._sessions[session_id] = session_data
        self._messages[session_id] = []
        return session_data

    async def list_sessions(self, user_id: str, limit: int = 100, offset: int = 0) -> list[dict[str, Any]]:
        start, end = page_range(limit, offset)
        if supabase_session.is_configured and supabase_session.client:
            resp = await supabase_session.execute(supabase_session.client.table("chat_sessions") \
                .select("*") \
                .eq("user_id", user_id) \
                .order("updated_at", desc=True).order("id").range(start, end))
            return resp.data or []

        user_sessions = [s for s in self._sessions.values() if s.get("user_id") == user_id]
        user_sessions.sort(key=lambda s: s.get("updated_at", ""), reverse=True)
        return user_sessions[start:end + 1]

    async def get_session(self, session_id: str, user_id: str) -> dict[str, Any] | None:
        if supabase_session.is_configured and supabase_session.client:
            resp = await supabase_session.execute(supabase_session.client.table("chat_sessions") \
                .select("*") \
                .eq("id", session_id) \
                .eq("user_id", user_id))
            return resp.data[0] if resp.data else None

        s = self._sessions.get(session_id)
        if s and s.get("user_id") == user_id:
            return s
        return None

    async def delete_session(self, session_id: str, user_id: str) -> bool:
        if not await self.get_session(session_id, user_id):
            return False
        if supabase_session.is_configured and supabase_session.client:
            await supabase_session.execute(supabase_session.client.table("chat_sessions").delete().eq("id", session_id).eq("user_id", user_id))
            return True

        s = self._sessions.get(session_id)
        if s and s.get("user_id") == user_id:
            self._sessions.pop(session_id, None)
            self._messages.pop(session_id, None)
            return True
        return False

    async def get_or_create_default_session(self, user_id: str) -> dict[str, Any]:
        sessions = await self.list_sessions(user_id)
        if sessions:
            return sessions[0]
        return await self.create_session(user_id=user_id, title="Chat with Momo")

    async def add_message(
        self,
        session_id: str,
        user_id: str,
        role: str,
        content: str,
        citations: list[dict[str, Any]] | None = None,
        created_deck: dict[str, Any] | None = None,
        study_card: dict[str, Any] | None = None,
        image_base64: str | None = None,
        quick_replies: list[str] | None = None,
        tool_calls: list[dict[str, Any]] | None = None
    ) -> dict[str, Any]:
        if not await self.get_session(session_id, user_id):
            raise ValueError("Chat session unavailable")
        msg_id = str(uuid.uuid4())
        now = datetime.now(UTC).isoformat()
        msg_data = {
            "id": msg_id,
            "session_id": session_id,
            "user_id": user_id,
            "role": role,
            "content": content,
            "citations": citations,
            "created_deck": created_deck,
            "study_card": study_card,
            "image_base64": image_base64,
            "quick_replies": quick_replies,
            "tool_calls": tool_calls,
            "created_at": now
        }

        if supabase_session.is_configured and supabase_session.client:
            resp = await supabase_session.execute(supabase_session.client.table("chat_messages").insert(msg_data))
            # Touch session updated_at
            await supabase_session.execute(supabase_session.client.table("chat_sessions").update({
                "updated_at": now
            }).eq("id", session_id).eq("user_id", user_id))
            if resp.data:
                return resp.data[0]

        if session_id not in self._messages:
            self._messages[session_id] = []
        self._messages[session_id].append(msg_data)

        if session_id in self._sessions:
            self._sessions[session_id]["updated_at"] = now
            self._sessions[session_id]["message_count"] = len(self._messages[session_id])
            # Auto-title session based on first user message if still default title
            if self._sessions[session_id]["title"] == "Chat with Momo" and role == "user":
                clean_title = content.strip().replace("\n", " ")
                if len(clean_title) > 40:
                    clean_title = clean_title[:37] + "..."
                self._sessions[session_id]["title"] = clean_title

        return msg_data

    async def get_messages(
        self,
        session_id: str,
        user_id: str,
        limit: int = 50
    ) -> list[dict[str, Any]]:
        page_range(limit, 0)
        # Verify ownership of session
        session = await self.get_session(session_id, user_id)
        if not session:
            return []

        if supabase_session.is_configured and supabase_session.client:
            resp = await supabase_session.execute(supabase_session.client.table("chat_messages") \
                .select("*") \
                .eq("session_id", session_id) \
                .eq("user_id", user_id) \
                .order("created_at", desc=True).order("id", desc=True) \
                .limit(limit))
            return list(reversed(resp.data or []))

        msgs = self._messages.get(session_id, [])
        return msgs[-limit:]

chat_repo = ChatRepository()
