from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from typing import Optional
import logging

from app.dependencies import get_current_user, AuthenticatedUser
from app.services.security.rate_limiter import require_rate_limit
from app.services.security.guardrails_service import guardrails_service
from app.services.ai.image_service import image_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/images", tags=["Images"])

class ImageGenerateRequest(BaseModel):
    prompt: str = Field(..., min_length=2, max_length=500, description="Educational diagram or visual concept to illustrate")
    topic: Optional[str] = Field(None, max_length=150, description="Optional explicit concept or topic title")
    context: Optional[str] = Field(None, max_length=2000, description="Optional contextual study notes for grounding")
    requirements: Optional[str] = Field(None, max_length=500, description="Optional user requirements, sub-topics, or custom values")

class ImageGenerateResponse(BaseModel):
    image_base64: str
    provider: str
    prompt: str

@router.post(
    "/generate",
    response_model=ImageGenerateResponse,
    dependencies=[Depends(require_rate_limit(category="math", limit_override=5))]
)
async def generate_study_image(
    req: ImageGenerateRequest,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """
    Generates a theme-aligned 2D educational diagram for a study concept.
    Rate limited to 5 requests per minute per user and protected by safety guardrails.
    """
    # 1. Guardrail validation
    guardrail = guardrails_service.validate_user_input(req.prompt)
    if not guardrail.passed:
        logger.warning(f"Image generation prompt blocked by guardrail for user {user.id}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "UNSAFE_IMAGE_PROMPT",
                "message": guardrail.refusal_response or "The requested image prompt cannot be generated."
            }
        )

    # 2. Generate diagram
    try:
        result = await image_service.generate_image(
            prompt=guardrail.sanitized_text,
            topic=req.topic,
            context=req.context,
            requirements=req.requirements
        )
        return ImageGenerateResponse(
            image_base64=result["image_base64"],
            provider=result["provider"],
            prompt=result["prompt"]
        )
    except Exception as e:
        logger.error(f"Error generating study diagram for user {user.id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "IMAGE_GENERATION_FAILED", "message": "Failed to generate study diagram."}
        )
