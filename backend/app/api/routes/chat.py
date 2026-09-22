from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional

from app.dependencies import get_current_user, AuthenticatedUser
from app.schemas.chat import (
    ChatSessionCreate,
    ChatSessionResponse,
    ChatSessionDetailResponse,
    ChatMessageCreate,
    ChatMessageResponse,
    StudyCardMetadata,
    ImportCardRequest
)
from app.db.repositories.chat_repo import chat_repo
from app.db.repositories.study_repo import study_repo
from app.services.chat.chat_service import chat_service
from app.services.security.rate_limiter import require_rate_limit

router = APIRouter(prefix="/api/chat", tags=["Chat"])

@router.post("/import-card")
async def import_card_to_library(
    req: ImportCardRequest,
    user: AuthenticatedUser = Depends(get_current_user)
):
    set_title = f"{req.topic} (Momo Study Set)" if req.topic and req.topic != "Momo Study Cards" else "Momo Study Cards"
    existing_sets = await study_repo.list_study_sets(user.id)
    target_set = next((s for s in existing_sets if s.get("title") == set_title), None)

    if not target_set:
        target_set = await study_repo.create_study_set({
            "user_id": user.id,
            "title": set_title,
            "description": f"Imported cards from Momo AI conversation on {req.topic}",
            "generation_status": "COMPLETED",
            "item_count": 0
        })

    item_data = {
        "type": req.question_type,
        "question": req.question,
        "answer": req.answer,
        "explanation": req.explanation or "",
        "options": req.options,
        "difficulty": req.difficulty,
        "image_base64": req.image_base64,
        "source_metadata": {
            "source": "Momo Chat",
            "topic": req.topic or "General"
        }
    }
    await study_repo.save_study_items(
        set_id=target_set["id"],
        items=[item_data]
    )

    new_count = (target_set.get("item_count") or 0) + 1
    target_set["item_count"] = new_count

    return {
        "status": "imported",
        "study_set_id": target_set["id"],
        "title": target_set["title"],
        "item_count": new_count
    }

@router.post("/sessions", response_model=ChatSessionResponse)
async def create_session(
    req: ChatSessionCreate,
    user: AuthenticatedUser = Depends(get_current_user)
):
    session = await chat_repo.create_session(user_id=user.id, title=req.title)
    return session

@router.get("/sessions", response_model=List[ChatSessionResponse])
async def list_sessions(
    user: AuthenticatedUser = Depends(get_current_user)
):
    return await chat_repo.list_sessions(user_id=user.id)

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

    response = await chat_service.send_message(
        session_id=session_id,
        user_id=user.id,
        user_content=req.content,
        document_id=req.document_id
    )
    return response

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
    return await chat_service.send_message(
        session_id=session["id"],
        user_id=user.id,
        user_content=req.content,
        document_id=req.document_id
    )
