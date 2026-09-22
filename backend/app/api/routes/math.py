from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel
from typing import Optional, List
import logging
from app.dependencies import get_current_user, AuthenticatedUser
from app.services.ai.ai_provider import ai_provider
from app.services.security.rate_limiter import require_rate_limit
from app.services.security.guardrails_service import guardrails_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/math", tags=["math"])

class MathSolveRequest(BaseModel):
    base64_image: str

class MathSolveResponse(BaseModel):
    problem: str
    category: Optional[str] = "General Math"
    difficulty: Optional[str] = "Unknown"
    key_concepts: Optional[List[str]] = []
    steps: List[str]
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
    try:
        result = await ai_provider.solve_math(req.base64_image)
        # Sanitize any output against credential leaks
        if isinstance(result, dict):
            if "explanation" in result and isinstance(result["explanation"], str):
                result["explanation"] = guardrails_service.sanitize_model_output(result["explanation"])
            if "steps" in result and isinstance(result["steps"], list):
                result["steps"] = [guardrails_service.sanitize_model_output(s) for s in result["steps"]]
        return result
    except Exception as e:
        logger.error(f"Error solving math problem for user {user.id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "MATH_SOLVE_FAILED", "message": "Failed to analyze and solve the math problem."}
        )
