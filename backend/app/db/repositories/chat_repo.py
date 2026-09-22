from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
import uuid
from app.db.session import supabase_session
import logging

logger = logging.getLogger(__name__)

class ChatRepository:
    def __init__(self):
        # In-memory store: session_id -> session dict
        self._sessions: Dict[str, Dict[str, Any]] = {}
        # session_id -> list of message dicts
        self._messages: Dict[str, List[Dict[str, Any]]] = {}

    async def create_session(self, user_id: str, title: Optional[str] = None) -> Dict[str, Any]:
        session_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        session_data = {
            "id": session_id,
            "user_id": user_id,
            "title": (title or "").strip() or "Chat with Momo",
            "created_at": now,
            "updated_at": now,
            "message_count": 0
        }

        if supabase_session.is_configured and supabase_session.client:
            try:
                resp = supabase_session.client.table("chat_sessions").insert(session_data).execute()
                if resp.data:
                    return resp.data[0]
            except Exception as e:
                logger.warning(f"Supabase error in create_session: {e}. Falling back to memory store.")

        self._sessions[session_id] = session_data
        self._messages[session_id] = []
        return session_data

    async def list_sessions(self, user_id: str) -> List[Dict[str, Any]]:
        if supabase_session.is_configured and supabase_session.client:
            try:
                resp = supabase_session.client.table("chat_sessions") \
                    .select("*") \
                    .eq("user_id", user_id) \
                    .order("updated_at", desc=True) \
                    .execute()
                return resp.data or []
            except Exception as e:
                logger.warning(f"Supabase error in list_sessions: {e}")

        user_sessions = [s for s in self._sessions.values() if s.get("user_id") == user_id]
        user_sessions.sort(key=lambda s: s.get("updated_at", ""), reverse=True)
        return user_sessions

    async def get_session(self, session_id: str, user_id: str) -> Optional[Dict[str, Any]]:
        if supabase_session.is_configured and supabase_session.client:
            try:
                resp = supabase_session.client.table("chat_sessions") \
                    .select("*") \
                    .eq("id", session_id) \
                    .eq("user_id", user_id) \
                    .execute()
                return resp.data[0] if resp.data else None
            except Exception as e:
                logger.warning(f"Supabase error in get_session: {e}")

        s = self._sessions.get(session_id)
        if s and s.get("user_id") == user_id:
            return s
        return None

    async def delete_session(self, session_id: str, user_id: str) -> bool:
        if supabase_session.is_configured and supabase_session.client:
            try:
                # Delete messages first
                supabase_session.client.table("chat_messages").delete().eq("session_id", session_id).execute()
                supabase_session.client.table("chat_sessions").delete().eq("id", session_id).eq("user_id", user_id).execute()
                return True
            except Exception as e:
                logger.warning(f"Supabase error in delete_session: {e}")

        s = self._sessions.get(session_id)
        if s and s.get("user_id") == user_id:
            self._sessions.pop(session_id, None)
            self._messages.pop(session_id, None)
            return True
        return False

    async def get_or_create_default_session(self, user_id: str) -> Dict[str, Any]:
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
        citations: Optional[List[Dict[str, Any]]] = None,
        created_deck: Optional[Dict[str, Any]] = None,
        study_card: Optional[Dict[str, Any]] = None,
        quick_replies: Optional[List[str]] = None,
        tool_calls: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        msg_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        msg_data = {
            "id": msg_id,
            "session_id": session_id,
            "user_id": user_id,
            "role": role,
            "content": content,
            "citations": citations,
            "created_deck": created_deck,
            "study_card": study_card,
            "quick_replies": quick_replies,
            "tool_calls": tool_calls,
            "created_at": now
        }

        if supabase_session.is_configured and supabase_session.client:
            try:
                resp = supabase_session.client.table("chat_messages").insert(msg_data).execute()
                # Touch session updated_at
                supabase_session.client.table("chat_sessions").update({
                    "updated_at": now
                }).eq("id", session_id).execute()
                if resp.data:
                    return resp.data[0]
            except Exception as e:
                logger.warning(f"Supabase error in add_message: {e}")

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
    ) -> List[Dict[str, Any]]:
        # Verify ownership of session
        session = await self.get_session(session_id, user_id)
        if not session:
            return []

        if supabase_session.is_configured and supabase_session.client:
            try:
                resp = supabase_session.client.table("chat_messages") \
                    .select("*") \
                    .eq("session_id", session_id) \
                    .order("created_at", desc=False) \
                    .limit(limit) \
                    .execute()
                return resp.data or []
            except Exception as e:
                logger.warning(f"Supabase error in get_messages: {e}")

        msgs = self._messages.get(session_id, [])
        return msgs[-limit:]

chat_repo = ChatRepository()
