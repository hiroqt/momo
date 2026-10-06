import logging

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.dependencies import AuthenticatedUser, get_current_user
from app.services.ai.ai_provider import ProviderUnavailableError, ai_provider
from app.services.security.guardrails_service import guardrails_service
from app.services.security.rate_limiter import require_rate_limit

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/math", tags=["math"])

class MathSolveRequest(BaseModel):
    # Bounded untrusted inputs (~6 MB decoded image, typed problem text).
    base64_image: str | None = Field(default=None, max_length=8_000_000)
    equation_text: str | None = Field(default=None, max_length=2000)

class MathSolveResponse(BaseModel):
    problem: str
    category: str | None = "General Math"
    difficulty: str | None = "Unknown"
    key_concepts: list[str] | None = []
    steps: list[str]
    final_answer: str
    explanation: str

@router.post(
    "/solve",
    response_model=MathSolveResponse,
    dependencies=[Depends(require_rate_limit(category="math"))]
)
async def solve_math_problem(
    req: MathSolveRequest,
    user: AuthenticatedUser = Depends(get_current_user)
):
    if not req.base64_image and not req.equation_text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "MISSING_INPUT", "message": "Either base64_image or equation_text must be provided."}
        )

    try:
        result = await ai_provider.solve_math(req.base64_image, equation_text=req.equation_text)
        # Sanitize any output against credential leaks
        if isinstance(result, dict):
            if "explanation" in result and isinstance(result["explanation"], str):
                result["explanation"] = guardrails_service.sanitize_model_output(result["explanation"])
            if "steps" in result and isinstance(result["steps"], list):
                result["steps"] = [guardrails_service.sanitize_model_output(s) for s in result["steps"]]
        return result
    except ProviderUnavailableError:
        logger.warning("Math provider unavailable")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "AI_UNAVAILABLE", "message": "The math solver is temporarily unavailable. Please try again shortly."}
        ) from None
    except Exception as e:  # noqa: BLE001 - expose only a safe provider failure
        logger.error("Math solving failed (%s)", type(e).__name__)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "MATH_SOLVE_FAILED", "message": "Failed to analyze and solve the math problem."}
        ) from None
