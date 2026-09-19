from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from app.dependencies import get_current_user, AuthenticatedUser
from app.schemas.study import (
    StudySetResponse,
    StudySetUpdateRequest,
    StudyItemResponse,
    StudySessionCreate,
    StudySessionResponse
)
from app.db.repositories.study_repo import study_repo
from app.db.repositories.folder_repo import folder_repo

router = APIRouter(prefix="/api/study-sets", tags=["Study Sets"])

@router.get("", response_model=List[StudySetResponse])
async def list_study_sets(user: AuthenticatedUser = Depends(get_current_user)):
    return await study_repo.list_study_sets(user.id)

@router.get("/{study_set_id}", response_model=StudySetResponse)
async def get_study_set(
    study_set_id: str,
    user: AuthenticatedUser = Depends(get_current_user)
):
    s = await study_repo.get_study_set(study_set_id, user.id)
    if not s:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "STUDY_SET_NOT_FOUND", "message": "Study set not found"}
        )
    return s

@router.patch("/{study_set_id}", response_model=StudySetResponse)
async def update_study_set(
    study_set_id: str,
    req: StudySetUpdateRequest,
    user: AuthenticatedUser = Depends(get_current_user)
):
    updates = {}
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
            f = await folder_repo.get_folder(req.folder_id, user.id)
            if not f:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail={"code": "FOLDER_NOT_FOUND", "message": "Folder not found"}
                )
            updates["folder_id"] = req.folder_id

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

@router.get("/{study_set_id}/items", response_model=List[StudyItemResponse])
async def get_study_set_items(
    study_set_id: str,
    user: AuthenticatedUser = Depends(get_current_user)
):
    # Check set ownership
    s = await study_repo.get_study_set(study_set_id, user.id)
    if not s:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "STUDY_SET_NOT_FOUND", "message": "Study set not found"}
        )
    return await study_repo.get_study_items(study_set_id)

@router.delete("/{study_set_id}")
async def delete_study_set(
    study_set_id: str,
    user: AuthenticatedUser = Depends(get_current_user)
):
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
    s = await study_repo.get_study_set(req.study_set_id, user.id)
    if not s:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "STUDY_SET_NOT_FOUND", "message": "Study set not found"}
        )

    items = await study_repo.get_study_items(req.study_set_id)
    session_data = {
        "user_id": user.id,
        "study_set_id": req.study_set_id,
        "mode": req.mode,
        "total_items": len(items),
        "correct_count": 0,
        "incorrect_count": 0,
        "score_percent": 0.0
    }
    return await study_repo.create_session(session_data)
