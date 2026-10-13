import hashlib
import json
import logging
import uuid
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, status

from app.db.repositories.documents_repo import documents_repo
from app.db.repositories.generation_repo import generation_repo
from app.dependencies import AuthenticatedUser, get_current_user
from app.schemas.generation import GenerationCreateRequest, GenerationJobResponse
from app.services.security.guardrails_service import guardrails_service
from app.services.security.rate_limiter import require_rate_limit
from app.workers.dispatch import dispatch_generation_retry, dispatch_job

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/generations", tags=["Generations"])


def _response(job: dict) -> GenerationJobResponse:
    return GenerationJobResponse(generation_id=job["id"], **{k: v for k, v in job.items() if k != "id"})


async def _dispatch_pending(job: dict, user_id: str, tasks: BackgroundTasks) -> GenerationJobResponse:
    if job["status"] == "PENDING":
        # Automatic orphan recovery has a lifetime budget. A create replay may
        # requeue terminal work only when an explicit retry authorized that reset.
        retry_pending = bool(job.get("retry_dispatch_pending"))
        revision = str(job["updated_at"])
        if retry_pending:
            await dispatch_generation_retry(user_id, job["id"], revision, tasks)
        else:
            await dispatch_job("study_generation", user_id, job["id"], tasks)
    return _response(job)

@router.post(
    "",
    response_model=GenerationJobResponse,
    dependencies=[Depends(require_rate_limit(category="generation"))]
)
async def create_generation(
    req: GenerationCreateRequest,
    background_tasks: BackgroundTasks,
    user: AuthenticatedUser = Depends(get_current_user),
    idempotency_key: Annotated[str | None, Header(min_length=8, max_length=128, pattern=r"^[A-Za-z0-9_.:-]+$")] = None,
):
    fingerprint = hashlib.sha256(json.dumps(req.model_dump(), sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()).hexdigest()
    if idempotency_key:
        existing = await generation_repo.get_requested_job(user.id, idempotency_key, fingerprint)
        if existing:
            return await _dispatch_pending(existing, user.id, background_tasks)
    # 1. Guardrail validation on custom instructions and topic
    if req.custom_instruction:
        g_check = guardrails_service.validate_user_input(req.custom_instruction)
        if not g_check.passed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "UNSAFE_INSTRUCTION", "message": g_check.refusal_response}
            )
        req.custom_instruction = g_check.sanitized_text

    if req.topic:
        g_check = guardrails_service.validate_user_input(req.topic)
        if not g_check.passed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "UNSAFE_TOPIC", "message": g_check.refusal_response}
            )
        req.topic = g_check.sanitized_text

    if req.learner_focus:
        g_check = guardrails_service.validate_user_input(req.learner_focus)
        if not g_check.passed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "UNSAFE_FOCUS", "message": g_check.refusal_response}
            )
        req.learner_focus = g_check.sanitized_text

    # 2. Verify document exists & owned by user
    doc = await documents_repo.get_by_id(req.document_id, user.id)
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "DOCUMENT_NOT_FOUND", "message": "Document not found."}
        )

    # 3. Verify document is READY for generation
    if not generation_repo.source_ready(doc):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "DOCUMENT_NOT_READY",
                "message": f"Document is not ready for generation (current status: {doc.get('processing_status')})"
            }
        )

    # 3. Create generation job
    job_id = str(uuid.uuid4())
    job_data = {
        "id": job_id,
        "user_id": user.id,
        "document_id": req.document_id,
        "study_set_id": None,
        "status": "PENDING",
        "stage": "Reading document",
        "progress": 5,
        "message": "Initializing reviewer generation...",
        "error": None,
        "generation_config": req.model_dump()
    }
    created_job = (await generation_repo.create_requested_job(job_data, idempotency_key, fingerprint)
                   if idempotency_key else await generation_repo.create_job(job_data))

    # 4. Durable dispatch; a separate worker runs retrieval and generation.
    return await _dispatch_pending(created_job, user.id, background_tasks)

@router.get("/{generation_id}", response_model=GenerationJobResponse)
async def get_generation_status(
    generation_id: str,
    user: AuthenticatedUser = Depends(get_current_user)
):
    job = await generation_repo.get_job(generation_id, user.id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "GENERATION_NOT_FOUND", "message": "Generation job not found."}
        )

    return GenerationJobResponse(
        generation_id=job["id"],
        document_id=job["document_id"],
        status=job["status"],
        stage=job["stage"],
        progress=job["progress"],
        message=job.get("message", ""),
        study_set_id=job.get("study_set_id"),
        generation_config=job.get("generation_config"),
        error=job.get("error"),
        created_at=job["created_at"],
        updated_at=job["updated_at"]
    )

@router.post(
    "/{generation_id}/retry",
    response_model=GenerationJobResponse,
    dependencies=[Depends(require_rate_limit(category="generation"))]
)
async def retry_generation(
    generation_id: str,
    background_tasks: BackgroundTasks,
    user: AuthenticatedUser = Depends(get_current_user)
):
    job = await generation_repo.get_job(generation_id, user.id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "GENERATION_NOT_FOUND", "message": "Generation job not found."}
        )

    # Clean retry: reset status and progress
    updated = await generation_repo.retry_failed(generation_id, user.id)
    if not updated:
        raise HTTPException(409, detail={"code": "GENERATION_NOT_RETRYABLE", "message": "Only failed generations can be retried."})

    # retry_failed atomically authorized this restart; requeue the finished queue row.
    await _dispatch_pending(updated, user.id, background_tasks)

    return GenerationJobResponse(
        generation_id=generation_id,
        document_id=job["document_id"],
        status="PENDING",
        stage="Restarting reviewer generation",
        progress=5,
        message="Retrying generation...",
        study_set_id=None,
        generation_config=job.get("generation_config"),
        error=None,
        created_at=updated["created_at"],
        updated_at=updated["updated_at"]
    )
