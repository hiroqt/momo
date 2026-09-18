import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, Request
from typing import List
from app.dependencies import get_current_user, AuthenticatedUser
from app.config import settings
from app.schemas.documents import (
    UploadUrlRequest,
    UploadUrlResponse,
    DocumentCreate,
    DocumentResponse,
    DocumentStatusResponse
)
from app.services.storage.s3_service import s3_service
from app.db.repositories.documents_repo import documents_repo
from app.db.repositories.chunks_repo import chunks_repo
from app.db.repositories.usage_repo import usage_repo
from app.workers.document_worker import document_worker
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/documents", tags=["Documents"])

SUPPORTED_TYPES = {"pdf", "docx", "txt", "pptx"}

@router.put("/mock-upload/{object_key:path}")
async def mock_s3_upload(object_key: str, request: Request):
    body = await request.body()
    s3_service.save_mock_object(object_key, body)
    return {"status": "success", "object_key": object_key, "size": len(body)}

@router.post("/upload-url", response_model=UploadUrlResponse)
async def get_upload_url(
    req: UploadUrlRequest,
    user: AuthenticatedUser = Depends(get_current_user)
):
    # 1. Enforce Server-Side Monthly Quota
    can_upload = await usage_repo.can_upload_document(user.id)
    if not can_upload:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "code": "QUOTA_EXCEEDED",
                "message": f"Monthly limit of {settings.MONTHLY_DOCUMENT_LIMIT} documents reached."
            }
        )

    # 2. Validate File Type
    clean_type = req.file_type.lower().lstrip(".")
    if clean_type not in SUPPORTED_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "UNSUPPORTED_FILE_TYPE",
                "message": f"Supported types are: {', '.join(SUPPORTED_TYPES)}"
            }
        )

    # 3. Validate File Size
    max_bytes = settings.MAX_FILE_SIZE_MB * 1024 * 1024
    if req.file_size > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "DOCUMENT_TOO_LARGE",
                "message": f"Document exceeds max size of {settings.MAX_FILE_SIZE_MB}MB."
            }
        )

    # 4. Generate S3 object key and presigned URL
    doc_id = str(uuid.uuid4())
    object_key = s3_service.build_object_key(
        user_id=user.id,
        document_id=doc_id,
        extension=clean_type
    )

    presigned_url = s3_service.generate_presigned_upload_url(
        object_key=object_key,
        mime_type=req.mime_type,
        expires_in=settings.S3_PRESIGNED_URL_EXPIRE_SECONDS
    )

    return UploadUrlResponse(
        upload_url=presigned_url,
        s3_object_key=object_key,
        document_id=doc_id,
        expires_in_seconds=settings.S3_PRESIGNED_URL_EXPIRE_SECONDS
    )

@router.post("", response_model=DocumentResponse)
async def register_document(
    doc_in: DocumentCreate,
    background_tasks: BackgroundTasks,
    user: AuthenticatedUser = Depends(get_current_user)
):
    # Check quota again before recording
    can_upload = await usage_repo.can_upload_document(user.id)
    if not can_upload:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={"code": "QUOTA_EXCEEDED", "message": "Monthly document limit reached."}
        )

    now = datetime.now(timezone.utc)
    expires_at = s3_service.calculate_expiration(now)

    doc_data = {
        "id": doc_in.document_id,
        "user_id": user.id,
        "original_filename": doc_in.original_filename,
        "file_type": doc_in.file_type.lower().lstrip("."),
        "mime_type": doc_in.mime_type,
        "file_size": doc_in.file_size,
        "page_count": 0,
        "s3_object_key": doc_in.s3_object_key,
        "uploaded_at": now.isoformat(),
        "expires_at": expires_at.isoformat(),
        "processing_status": "UPLOADED",
        "processing_error": None
    }

    created = await documents_repo.create(doc_data)
    await usage_repo.increment_usage(user.id)

    # Trigger async background worker pipeline
    background_tasks.add_task(
        document_worker.process_document,
        document_id=doc_in.document_id,
        user_id=user.id,
        s3_object_key=doc_in.s3_object_key,
        filename=doc_in.original_filename,
        file_type=doc_in.file_type
    )

    return created

@router.get("", response_model=List[DocumentResponse])
async def list_documents(user: AuthenticatedUser = Depends(get_current_user)):
    return await documents_repo.list_by_user(user.id)

@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: str,
    user: AuthenticatedUser = Depends(get_current_user)
):
    doc = await documents_repo.get_by_id(document_id, user.id)
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "DOCUMENT_NOT_FOUND", "message": "Document not found"}
        )
    return doc

@router.get("/{document_id}/status", response_model=DocumentStatusResponse)
async def get_document_status(
    document_id: str,
    user: AuthenticatedUser = Depends(get_current_user)
):
    doc = await documents_repo.get_by_id(document_id, user.id)
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "DOCUMENT_NOT_FOUND", "message": "Document not found"}
        )

    st = doc.get("processing_status", "UNKNOWN")
    progress_map = {
        "UPLOADED": 10,
        "VALIDATING": 20,
        "EXTRACTING": 40,
        "CHUNKING": 60,
        "EMBEDDING": 75,
        "INDEXING": 90,
        "READY": 100,
        "FAILED": 100
    }
    stage_map = {
        "UPLOADED": "Uploaded",
        "VALIDATING": "Validating format",
        "EXTRACTING": "Reading document",
        "CHUNKING": "Analyzing sections",
        "EMBEDDING": "Understanding concepts",
        "INDEXING": "Indexing knowledge",
        "READY": "Ready to study",
        "FAILED": "Processing failed"
    }

    return DocumentStatusResponse(
        document_id=document_id,
        status=st,
        stage=stage_map.get(st, st),
        progress=progress_map.get(st, 0),
        error=doc.get("processing_error"),
        suggested_topics=doc.get("suggested_topics", [])
    )

@router.delete("/{document_id}")
async def delete_document(
    document_id: str,
    user: AuthenticatedUser = Depends(get_current_user)
):
    doc = await documents_repo.get_by_id(document_id, user.id)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"code": "DOCUMENT_NOT_FOUND", "message": "Not found"})

    s3_service.delete_object(doc.get("s3_object_key", ""))
    await chunks_repo.delete_by_document_id(document_id, user.id)
    await documents_repo.delete(document_id, user.id)
    return {"deleted": True, "document_id": document_id}
