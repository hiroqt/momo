
import re

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.db.repositories.chat_import_repo import chat_import_repo
from app.db.repositories.chat_repo import chat_repo
from app.db.repositories.chunks_repo import chunks_repo
from app.db.repositories.documents_repo import documents_repo
from app.dependencies import AuthenticatedUser, get_current_user
from app.schemas.chat import (
    ChatMessageCreate,
    ChatMessageResponse,
    ChatSessionCreate,
    ChatSessionDetailResponse,
    ChatSessionResponse,
    ImportCardRequest,
)
from app.services.ai.ai_provider import ProviderUnavailableError
from app.services.chat.chat_service import chat_service
from app.services.security.rate_limiter import require_rate_limit
from app.services.validation.grounding_validator import grounding_validator

router = APIRouter(prefix="/api/chat", tags=["Chat"])

@router.post("/import-card")
async def import_card_to_library(
    req: ImportCardRequest,
    user: AuthenticatedUser = Depends(get_current_user)
):
    metadata = req.source_metadata or {}
    document_id = metadata.get("document_id")
    document = await documents_repo.get_by_id(document_id, user.id) if isinstance(document_id, str) else None
    if not isinstance(document_id, str) or not document:
        raise HTTPException(422, detail={"code": "UNVERIFIED_SOURCE", "message": "This card requires verified source material."})
    chunks = await chunks_repo.get_by_document_id(document_id, user.id)
    chunk = next((c for c in chunks if metadata.get("chunk_id") and (c.get("id") or c.get("chunk_id")) == metadata["chunk_id"]), None)
    if not chunk:
        raise HTTPException(422, detail={"code": "UNVERIFIED_SOURCE", "message": "This card requires verified source material."})
    trusted = {
        "document_id": document_id, "chunk_id": chunk.get("id") or chunk.get("chunk_id"),
        "source_id": metadata.get("source_id"), "page": chunk.get("page_start", 1),
        "section": chunk.get("section") or "General", "snippet": chunk.get("content", "").strip()[:200],
    }
    item_data = {
        "type": req.question_type, "question": req.question, "answer": req.answer,
        "explanation": req.explanation or "", "options": req.options,
        "difficulty": req.difficulty, "source_metadata": metadata,
    }
    valid = grounding_validator.validate_and_deduplicate(
        [item_data], 1, trusted_sources=[trusted],
        evidence={str(trusted["chunk_id"]): chunk.get("content", "")},
    )
    # Without calibrated semantic verification, accept only explicit source Q&A pairs.
    content = " ".join(chunk.get("content", "").split()).casefold()
    question = " ".join(req.question.split()).casefold()
    answer = " ".join(req.answer.split()).casefold()
    # Match a complete single FAQ chunk; regex does not assess prose claim truth.
    pair = r"(?:question:\s*)?" + re.escape(question) + r"\s+(?:answer:\s*)?" + re.escape(answer)
    if req.explanation:
        explanation = " ".join(req.explanation.split()).casefold()
        pair += r"\s+(?:explanation:\s*)?" + re.escape(explanation)
    pair += r"[.!?]?"
    if req.image_base64 or not valid or not re.fullmatch(pair, content):
        raise HTTPException(422, detail={"code": "UNVERIFIED_SOURCE", "message": "The card could not be verified against its source."})
    item_data = valid[0]
    topic = (req.topic or "").strip()
    set_title = f"{topic} (Momo Study Set)" if topic and topic != "Momo Study Cards" else "Momo Study Cards"
    target_set = await chat_import_repo.persist_card(user_id=user.id, title=set_title, item=item_data, document_id=document_id)

    return {
        "status": "imported",
        "study_set_id": target_set["id"],
        "title": target_set["title"],
        "item_count": target_set["item_count"]
    }

@router.post("/sessions", response_model=ChatSessionResponse)
async def create_session(
    req: ChatSessionCreate,
    user: AuthenticatedUser = Depends(get_current_user)
):
    session = await chat_repo.create_session(user_id=user.id, title=req.title)
    return session

@router.get("/sessions", response_model=list[ChatSessionResponse])
async def list_sessions(
    user: AuthenticatedUser = Depends(get_current_user),
    limit: int = Query(100, ge=1, le=100),
    offset: int = Query(0, ge=0, le=100000),
):
    return await chat_repo.list_sessions(user_id=user.id, limit=limit, offset=offset)

@router.get("/sessions/{session_id}", response_model=ChatSessionDetailResponse)
async def get_session(
    session_id: str,
    user: AuthenticatedUser = Depends(get_current_user)
):
    session = await chat_repo.get_session(session_id=session_id, user_id=user.id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "SESSION_NOT_FOUND", "message": "Chat session not found."}
        )

    raw_msgs = await chat_repo.get_messages(session_id=session_id, user_id=user.id, limit=50)
    messages = []
    for m in raw_msgs:
        messages.append(ChatMessageResponse(
            id=m["id"],
            session_id=m["session_id"],
            user_id=m["user_id"],
            role=m["role"],
            content=m["content"],
            citations=m.get("citations"),
            created_deck=m.get("created_deck"),
            study_card=m.get("study_card"),
            quick_replies=m.get("quick_replies"),
            tool_calls=m.get("tool_calls"),
            created_at=m["created_at"]
        ))

    return ChatSessionDetailResponse(
        session=ChatSessionResponse(**session),
        messages=messages
    )

@router.delete("/sessions/{session_id}")
async def delete_session(
    session_id: str,
    user: AuthenticatedUser = Depends(get_current_user)
):
    deleted = await chat_repo.delete_session(session_id=session_id, user_id=user.id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "SESSION_NOT_FOUND", "message": "Chat session not found."}
        )
    return {"status": "deleted", "session_id": session_id}

@router.post(
    "/sessions/{session_id}/messages",
    response_model=ChatMessageResponse,
    dependencies=[Depends(require_rate_limit(category="chat"))]
)
async def send_message(
    session_id: str,
    req: ChatMessageCreate,
    user: AuthenticatedUser = Depends(get_current_user)
):
    session = await chat_repo.get_session(session_id=session_id, user_id=user.id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "SESSION_NOT_FOUND", "message": "Chat session not found."}
        )

    return await _send(session_id, user.id, req)


async def _send(session_id: str, user_id: str, req: ChatMessageCreate) -> ChatMessageResponse:
    try:
        return await chat_service.send_message(
            session_id=session_id,
            user_id=user_id,
            user_content=req.content,
            document_id=req.document_id
        )
    except ProviderUnavailableError:
        # Controlled outage; never a mocked reply or raw provider detail.
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "AI_UNAVAILABLE", "message": "Momo is temporarily unavailable. Please try again shortly."}
        ) from None

@router.post(
    "",
    response_model=ChatMessageResponse,
    dependencies=[Depends(require_rate_limit(category="chat"))]
)
async def quick_chat(
    req: ChatMessageCreate,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Convenience endpoint to send a message to the user's active/default session."""
    session = await chat_repo.get_or_create_default_session(user_id=user.id)
    return await _send(session["id"], user.id, req)
