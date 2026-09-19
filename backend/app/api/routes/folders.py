from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from app.dependencies import get_current_user, AuthenticatedUser
from app.schemas.folder import (
    FolderCreateRequest,
    FolderUpdateRequest,
    FolderResponse
)
from app.db.repositories.folder_repo import folder_repo, calculate_folder_credit_cost

router = APIRouter(prefix="/api/folders", tags=["Folders"])

@router.get("", response_model=List[FolderResponse])
async def list_folders(user: AuthenticatedUser = Depends(get_current_user)):
    return await folder_repo.list_folders(user.id)

@router.post("", response_model=FolderResponse, status_code=status.HTTP_201_CREATED)
async def create_folder(
    req: FolderCreateRequest,
    user: AuthenticatedUser = Depends(get_current_user)
):
    cleaned_name = req.name.strip()
    if not cleaned_name:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "INVALID_NAME", "message": "Folder name cannot be empty."}
        )

    # Check for duplicate folder name
    existing_folders = await folder_repo.list_folders(user.id)
    for f in existing_folders:
        if f["name"].lower() == cleaned_name.lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "FOLDER_NAME_EXISTS", "message": "A folder with this name already exists."}
            )

    folder_data = {
        "user_id": user.id,
        "name": cleaned_name,
        "color": req.color,
    }
    created = await folder_repo.create_folder(folder_data)
    return created

@router.get("/{folder_id}", response_model=FolderResponse)
async def get_folder(
    folder_id: str,
    user: AuthenticatedUser = Depends(get_current_user)
):
    f = await folder_repo.get_folder(folder_id, user.id)
    if not f:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "FOLDER_NOT_FOUND", "message": "Folder not found"}
        )
    return f

@router.patch("/{folder_id}", response_model=FolderResponse)
async def update_folder(
    folder_id: str,
    req: FolderUpdateRequest,
    user: AuthenticatedUser = Depends(get_current_user)
):
    f = await folder_repo.get_folder(folder_id, user.id)
    if not f:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "FOLDER_NOT_FOUND", "message": "Folder not found"}
        )

    updates = {}
    if req.name is not None:
        cleaned_name = req.name.strip()
        if not cleaned_name:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={"code": "INVALID_NAME", "message": "Folder name cannot be empty."}
            )
        existing = await folder_repo.list_folders(user.id)
        if any(other["name"].lower() == cleaned_name.lower() and other["id"] != folder_id for other in existing):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "FOLDER_NAME_EXISTS", "message": "A folder with this name already exists."}
            )
        updates["name"] = cleaned_name

    if req.color is not None:
        updates["color"] = req.color

    updated = await folder_repo.update_folder(folder_id, user.id, updates)
    return updated

@router.delete("/{folder_id}")
async def delete_folder(
    folder_id: str,
    user: AuthenticatedUser = Depends(get_current_user)
):
    f = await folder_repo.get_folder(folder_id, user.id)
    if not f:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "FOLDER_NOT_FOUND", "message": "Folder not found"}
        )
    await folder_repo.delete_folder(folder_id, user.id)
    return {"deleted": True, "folder_id": folder_id}
