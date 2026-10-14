import asyncio
import logging
import uuid
from datetime import UTC, datetime, timedelta

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    HTTPException,
    Query,
    Request,
    status,
)

from app.config import settings
from app.db.repositories.chunks_repo import chunks_repo
from app.db.repositories.documents_repo import documents_repo
from app.db.repositories.upload_ticket_repo import upload_ticket_repo
from app.db.repositories.usage_repo import usage_repo
from app.dependencies import AuthenticatedUser, get_current_user
from app.schemas.documents import (
    DocumentCreate,
    DocumentResponse,
    DocumentStatusResponse,
    UploadUrlRequest,
    UploadUrlResponse,
)
from app.services.security.rate_limiter import require_rate_limit
from app.services.storage import storage_service
from app.services.storage.base import ObjectAlreadyExistsError, ObjectNotFoundError
from app.workers.dispatch import dispatch_job

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/documents", tags=["Documents"])

SUPPORTED_TYPES = {"pdf", "docx", "txt", "pptx"}

@router.put("/mock-upload/{object_key:path}")
async def mock_s3_upload(object_key: str, request: Request, user: AuthenticatedUser = Depends(get_current_user)):
    from app.db.session import supabase_session
    if not supabase_session.use_memory:
        raise HTTPException(404, detail="Not found")
    if not object_key.startswith(f"documents/{user.id}/") or ".." in object_key:
        raise HTTPException(400, detail={"code": "INVALID_OBJECT_KEY", "message": "Invalid upload destination."})
    if int(request.headers.get("content-length", "0")) > settings.MAX_FILE_SIZE_MB * 1024 * 1024:
        raise HTTPException(413, detail="Document too large")
    parts = object_key.split("/")
    if len(parts) != 4:
        raise HTTPException(400, detail={"code": "INVALID_OBJECT_KEY", "message": "Invalid upload destination."})
    ticket = await upload_ticket_repo.get(parts[2], user.id)
    if (not ticket or ticket.get("status") != "issued" or ticket.get("object_key") != object_key
            or ticket.get("provider") != storage_service.provider or ticket.get("bucket") != storage_service.bucket
            or datetime.fromisoformat(ticket["signed_until"]) <= datetime.now(UTC)):
        raise HTTPException(409, detail={"code": "UPLOAD_UNAVAILABLE", "message": "Please request a new upload destination."})
    body = await request.body()
    if len(body) > settings.MAX_FILE_SIZE_MB * 1024 * 1024:
        raise HTTPException(413, detail="Document too large")
    if not body:
        raise HTTPException(400, detail={"code": "INVALID_DOCUMENT_SIZE", "message": "The uploaded document is empty."})
    try:
        storage_service.save_mock_object(object_key, body)
    except ObjectAlreadyExistsError:
        raise HTTPException(409, detail={"code": "UPLOAD_ALREADY_EXISTS", "message": "This upload has already finished. Please select the document again."}) from None
    return {"status": "success", "object_key": object_key, "size": len(body)}

@router.post("/upload-url", response_model=UploadUrlResponse,
             dependencies=[Depends(require_rate_limit(category="upload"))])
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

    # 4. Generate storage object key and upload URL
    doc_id = str(uuid.uuid4())
    object_key = storage_service.build_object_key(
        user_id=user.id,
        document_id=doc_id,
        extension=clean_type
    )

    signed_seconds = 7200 if storage_service.provider == "supabase" else settings.S3_PRESIGNED_URL_EXPIRE_SECONDS
    await upload_ticket_repo.issue({
        "id": doc_id, "user_id": user.id, "object_key": object_key,
        "file_type": clean_type, "mime_type": req.mime_type, "file_size": req.file_size,
        "provider": storage_service.provider, "bucket": storage_service.bucket,
        "signed_until": (datetime.now(UTC) + timedelta(seconds=signed_seconds)).isoformat(),
    })

    presigned_url = await asyncio.to_thread(storage_service.generate_presigned_upload_url,
        object_key=object_key,
        mime_type=req.mime_type,
        expires_in=settings.S3_PRESIGNED_URL_EXPIRE_SECONDS
    )

    return UploadUrlResponse(
        upload_url=presigned_url,
        upload_headers=storage_service.get_upload_headers(req.mime_type),
        s3_object_key=object_key,
        document_id=doc_id,
        expires_in_seconds=signed_seconds
    )

@router.post("", response_model=DocumentResponse,
             dependencies=[Depends(require_rate_limit(category="registration"))])
async def register_document(
    doc_in: DocumentCreate,
    background_tasks: BackgroundTasks,
    user: AuthenticatedUser = Depends(get_current_user)
):
    try:
        document_id = str(uuid.UUID(doc_in.document_id))
    except ValueError:
        raise HTTPException(422, detail={"code": "INVALID_DOCUMENT_ID", "message": "Invalid document identifier."}) from None
    file_type = doc_in.file_type.lower().lstrip(".")
    if file_type not in SUPPORTED_TYPES:
        raise HTTPException(400, detail={"code": "UNSUPPORTED_FILE_TYPE", "message": "Unsupported document format."})
    expected_key = storage_service.build_object_key(user.id, document_id, file_type)
    if doc_in.s3_object_key != expected_key:
        raise HTTPException(400, detail={"code": "INVALID_OBJECT_KEY", "message": "Invalid upload destination."})
    ticket = await upload_ticket_repo.get(document_id, user.id)
    if not ticket or ticket.get("status") not in {"issued", "registered"}:
        raise HTTPException(409, detail={"code": "UPLOAD_UNAVAILABLE", "message": "Please upload the document again."})
    if not ticket.get("legacy") and (ticket.get("provider") != storage_service.provider or ticket.get("bucket") != storage_service.bucket):
        raise HTTPException(409, detail={"code": "UPLOAD_UNAVAILABLE", "message": "Please upload the document again."})
    existing = await documents_repo.get_by_id(document_id, user.id)
    if existing:
        # Lost-response retries re-dispatch idempotently: one logical ingestion per document.
        existing = await documents_repo.register(existing)
        await dispatch_job("document_ingestion", user.id, document_id, background_tasks)
        return existing
    try:
        metadata = await asyncio.to_thread(storage_service.get_object_metadata, expected_key)
    except ObjectNotFoundError:
        raise HTTPException(400, detail={"code": "UPLOAD_NOT_READY", "message": "The document upload has not finished."}) from None
    actual_size = metadata.size
    if actual_size != doc_in.file_size or actual_size <= 0 or actual_size > settings.MAX_FILE_SIZE_MB * 1024 * 1024:
        raise HTTPException(400, detail={"code": "INVALID_DOCUMENT_SIZE", "message": "Uploaded document size is invalid."})

    now = metadata.uploaded_at
    expires_at = storage_service.calculate_expiration(now)

    doc_data = {
        "id": document_id,
        "user_id": user.id,
        "original_filename": doc_in.original_filename,
        "file_type": doc_in.file_type.lower().lstrip("."),
        "mime_type": doc_in.mime_type,
        "file_size": doc_in.file_size,
        "page_count": 0,
        "s3_object_key": doc_in.s3_object_key,
        "uploaded_at": now.isoformat(),
        "expires_at": expires_at.isoformat(),
        "object_identity": metadata.identity,
        "object_version": metadata.version,
        "object_etag": metadata.etag,
        "processing_status": "UPLOADED",
        "processing_error": None
    }

    created = await documents_repo.register(doc_data)

    # Durable dispatch; separate workers parse/OCR/embed outside the API process.
    await dispatch_job("document_ingestion", user.id, document_id, background_tasks)

    return created

@router.get("", response_model=list[DocumentResponse])
async def list_documents(user: AuthenticatedUser = Depends(get_current_user), limit: int = Query(100, ge=1, le=100), offset: int = Query(0, ge=0, le=100000)):
    return await documents_repo.list_by_user(user.id, limit, offset)

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
        suggested_topics=doc.get("suggested_topics", []),
        page_count=doc.get("page_count"),
    )

@router.delete("/{document_id}")
async def delete_document(
    document_id: str,
    user: AuthenticatedUser = Depends(get_current_user)
):
    doc = await documents_repo.get_by_id(document_id, user.id)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"code": "DOCUMENT_NOT_FOUND", "message": "Not found"})

    ticket = await upload_ticket_repo.get(document_id, user.id)
    if not ticket or ticket.get("provider") != storage_service.provider or ticket.get("bucket") != storage_service.bucket:
        raise HTTPException(409, detail={"code": "UPLOAD_UNAVAILABLE", "message": "The document storage destination requires verification."})
    expected_key = storage_service.build_object_key(user.id, document_id, doc["file_type"])
    if doc.get("s3_object_key") != expected_key:
        raise HTTPException(409, detail={"code": "UPLOAD_UNAVAILABLE", "message": "The document is unavailable."})
    if not await upload_ticket_repo.retire(document_id, user.id):
        raise HTTPException(409, detail={"code": "UPLOAD_UNAVAILABLE", "message": "The document is unavailable."})
    await chunks_repo.delete_by_document_id(document_id, user.id)
    await documents_repo.delete(document_id, user.id)
    return {"deleted": True, "document_id": document_id}
