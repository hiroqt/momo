import logging

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.dependencies import AuthenticatedUser, get_current_user
from app.services.ai.ai_provider import ai_provider
from app.services.security.guardrails_service import guardrails_service
from app.services.security.rate_limiter import require_rate_limit

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/math", tags=["math"])

class MathSolveRequest(BaseModel):
    base64_image: str | None = None
    equation_text: str | None = None

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
    except Exception as e:  # noqa: BLE001 - expose only a safe provider failure
        logger.error("Math solving failed (%s)", type(e).__name__)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "MATH_SOLVE_FAILED", "message": "Failed to analyze and solve the math problem."}
        ) from None
