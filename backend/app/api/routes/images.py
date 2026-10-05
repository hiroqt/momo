import logging
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.dependencies import AuthenticatedUser, get_current_user
from app.services.ai.image_service import ImageProviderUnavailableError, image_service
from app.services.security.guardrails_service import guardrails_service
from app.services.security.rate_limiter import require_rate_limit

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/images", tags=["Images"])

class ImageGenerateRequest(BaseModel):
    prompt: str = Field(..., min_length=2, max_length=1000, description="Image or educational diagram to create")
    topic: str | None = Field(None, max_length=150, description="Optional explicit concept or topic title")
    context: str | None = Field(None, max_length=2000, description="Optional contextual study notes for grounding")
    requirements: str | None = Field(None, max_length=500, description="Optional user requirements, sub-topics, or custom values")
    mode: Literal["image", "diagram"] = Field("diagram", description="General image generation or structured diagram rendering")
    aspect_ratio: Literal["1:1", "16:9", "9:16", "4:3", "3:4"] = "1:1"

class ImageGenerateResponse(BaseModel):
    image_base64: str
    provider: str
    prompt: str
    mime_type: str = "image/png"
    mode: Literal["image", "diagram"]

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
    Generates either an original image or a structured educational diagram.
    Rate limited to 5 requests per minute per user and protected by safety guardrails.
    """
    # 1. Guardrail validation for every user-controlled text field.
    safe_fields = {}
    for field_name in ("prompt", "topic", "context", "requirements"):
        value = getattr(req, field_name)
        if not value:
            safe_fields[field_name] = value
            continue
        guardrail = guardrails_service.validate_user_input(value)
        if not guardrail.passed:
            logger.warning("Image generation input blocked for user %s", user.id)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "code": "UNSAFE_IMAGE_PROMPT",
                    "message": guardrail.refusal_response or "The requested image prompt cannot be generated.",
                },
            )
        safe_fields[field_name] = guardrail.sanitized_text

    # 2. Route the typed request to the selected provider.
    try:
        result = await image_service.generate_image(
            prompt=safe_fields["prompt"],
            topic=safe_fields["topic"],
            context=safe_fields["context"],
            requirements=safe_fields["requirements"],
            mode=req.mode,
            aspect_ratio=req.aspect_ratio,
        )
        return ImageGenerateResponse(
            image_base64=result["image_base64"],
            provider=result["provider"],
            prompt=result["prompt"],
            mime_type=result.get("mime_type", "image/png"),
            mode=result["mode"],
        )
    except ImageProviderUnavailableError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "IMAGE_PROVIDER_UNAVAILABLE", "message": "Image generation is currently unavailable."},
        ) from None
    except Exception as e:  # noqa: BLE001 - expose only a safe provider failure
        logger.error("Error generating study image for user %s: %s", user.id, type(e).__name__)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "IMAGE_GENERATION_FAILED", "message": "Failed to generate the requested image."},
        ) from None
