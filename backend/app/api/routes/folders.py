
import uuid

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status

from app.api.routes.economy import get_economy_policy
from app.db.repositories.economy_repo import economy_repo
from app.db.repositories.folder_repo import folder_repo
from app.dependencies import AuthenticatedUser, get_current_user
from app.domain.economy import EconomyPolicy
from app.schemas.folder import FolderCreateRequest, FolderResponse, FolderUpdateRequest

router = APIRouter(prefix="/api/folders", tags=["Folders"])

@router.get("", response_model=list[FolderResponse])
async def list_folders(user: AuthenticatedUser = Depends(get_current_user), limit: int = Query(100, ge=1, le=100), offset: int = Query(0, ge=0, le=100000)):
    return await folder_repo.list_folders(user.id, limit, offset)

@router.post("", response_model=FolderResponse, status_code=status.HTTP_201_CREATED)
async def create_folder(
    req: FolderCreateRequest,
    user: AuthenticatedUser = Depends(get_current_user),
    policy: EconomyPolicy = Depends(get_economy_policy),
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key", min_length=1, max_length=128, pattern=r"^[A-Za-z0-9._:-]+$")
):
    cleaned_name = req.name.strip()
    if not cleaned_name:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "INVALID_NAME", "message": "Folder name cannot be empty."}
        )

    # Preserve old no-key behavior while ensuring every create uses the same priced transaction.
    request_key = idempotency_key or str(uuid.uuid4())
    result = await economy_repo.create_folder_with_charge(
        user.id, request_key, cleaned_name, req.color, policy=policy)
    folder = result["folder"]
    if folder is None:  # Defensive: the repository maps deleted replays to a conflict.
        raise HTTPException(409, detail={"code": "FOLDER_REQUEST_DELETED",
                                         "message": "The folder from this request has been deleted."})
    return {**folder, "reviewer_count": folder.get("reviewer_count", 0)}

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
