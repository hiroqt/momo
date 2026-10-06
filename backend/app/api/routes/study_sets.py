from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.db.repositories.folder_repo import folder_repo
from app.db.repositories.study_repo import study_repo
from app.db.session import supabase_session
from app.dependencies import AuthenticatedUser, get_current_user
from app.schemas.study import (
    StudyItemResponse,
    StudySessionCreate,
    StudySessionResponse,
    StudySetCreateRequest,
    StudySetDetailResponse,
    StudySetResponse,
    StudySetUpdateRequest,
)

router = APIRouter(prefix="/api/study-sets", tags=["Study Sets"])


def _canonical_id(value: str, code: str, message: str) -> str:
    """Malformed identifiers are reported as missing rather than reaching the database.

    The development/test memory store keys records by arbitrary strings, so the
    raw value is kept there; a database-backed run only ever holds UUID keys.
    """
    try:
        return str(UUID(value))
    except (ValueError, TypeError, AttributeError):
        if supabase_session.use_memory and isinstance(value, str) and 0 < len(value) <= 64:
            return value
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail={"code": code, "message": message}) from None


def _set_id(value: str) -> str:
    return _canonical_id(value, "STUDY_SET_NOT_FOUND", "Study set not found")


@router.get("", response_model=list[StudySetResponse])
async def list_study_sets(user: AuthenticatedUser = Depends(get_current_user), limit: int = Query(100, ge=1, le=100), offset: int = Query(0, ge=0, le=100000)):
    return await study_repo.list_study_sets(user.id, limit, offset)

@router.post("", response_model=StudySetResponse, status_code=201)
async def create_study_set(
    req: StudySetCreateRequest,
    user: AuthenticatedUser = Depends(get_current_user),
):
    if req.folder_id is not None and not await folder_repo.get_folder(str(req.folder_id), user.id):
        raise HTTPException(404, detail={"code": "FOLDER_NOT_FOUND", "message": "Folder not found"})
    return await study_repo.create_study_set({**req.model_dump(mode="json"), "user_id": user.id, "item_count": 0})


@router.get("/{study_set_id}", response_model=StudySetDetailResponse)
async def get_study_set(
    study_set_id: str,
    user: AuthenticatedUser = Depends(get_current_user)
):
    study_set_id = _set_id(study_set_id)
    s = await study_repo.get_study_set(study_set_id, user.id)
    if not s:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "STUDY_SET_NOT_FOUND", "message": "Study set not found"}
        )
    return {**s, "study_items": await study_repo.get_study_items(study_set_id, user.id)}

@router.patch("/{study_set_id}", response_model=StudySetResponse)
async def update_study_set(
    study_set_id: str,
    req: StudySetUpdateRequest,
    user: AuthenticatedUser = Depends(get_current_user)
):
    study_set_id = _set_id(study_set_id)
    updates: dict[str, str | None] = {}
    if req.title is not None:
        cleaned_title = req.title.strip()
        if not cleaned_title:
            raise HTTPException(
                status_code=422,
                detail={"code": "INVALID_TITLE", "message": "Quiz title cannot be empty."}
            )
        updates["title"] = cleaned_title

    if req.description is not None:
        updates["description"] = req.description.strip()

    if req.folder_id is not None:
        if req.folder_id in ("", "none", "null"):
            updates["folder_id"] = None
        else:
            folder_id = _canonical_id(req.folder_id, "FOLDER_NOT_FOUND", "Folder not found")
            f = await folder_repo.get_folder(folder_id, user.id)
            if not f:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail={"code": "FOLDER_NOT_FOUND", "message": "Folder not found"}
                )
            updates["folder_id"] = folder_id

    if not updates:
        s = await study_repo.get_study_set(study_set_id, user.id)
        if not s:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "STUDY_SET_NOT_FOUND", "message": "Study set not found"}
            )
        return s

    updated = await study_repo.update_study_set(study_set_id, user.id, updates)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "STUDY_SET_NOT_FOUND", "message": "Study set not found"}
        )
    return updated

@router.get("/{study_set_id}/items", response_model=list[StudyItemResponse])
async def get_study_set_items(
    study_set_id: str,
    user: AuthenticatedUser = Depends(get_current_user)
):
    study_set_id = _set_id(study_set_id)
    # Check set ownership
    s = await study_repo.get_study_set(study_set_id, user.id)
    if not s:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "STUDY_SET_NOT_FOUND", "message": "Study set not found"}
        )
    return await study_repo.get_study_items(study_set_id, user.id)

@router.delete("/{study_set_id}")
async def delete_study_set(
    study_set_id: str,
    user: AuthenticatedUser = Depends(get_current_user)
):
    study_set_id = _set_id(study_set_id)
    deleted = await study_repo.delete_study_set(study_set_id, user.id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "STUDY_SET_NOT_FOUND", "message": "Study set not found"}
        )
    return {"deleted": True, "study_set_id": study_set_id}

@router.post("/sessions", response_model=StudySessionResponse)
async def start_study_session(
    req: StudySessionCreate,
    user: AuthenticatedUser = Depends(get_current_user)
):
    study_set_id = _set_id(req.study_set_id)
    s = await study_repo.get_study_set(study_set_id, user.id)
    if not s:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "STUDY_SET_NOT_FOUND", "message": "Study set not found"}
        )

    items = await study_repo.get_study_items(study_set_id, user.id)
    session_data = {
        "user_id": user.id,
        "study_set_id": study_set_id,
        "mode": req.mode,
        "total_items": len(items),
        "correct_count": 0,
        "incorrect_count": 0,
        "score_percent": 0.0
    }
    return await study_repo.create_session(session_data)
