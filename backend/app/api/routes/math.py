from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
import logging
from app.services.ai.ai_provider import ai_provider

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

@router.post("/solve", response_model=MathSolveResponse)
async def solve_math_problem(req: MathSolveRequest):
    try:
        result = await ai_provider.solve_math(req.base64_image)
        return result
    except Exception as e:
        logger.error(f"Error solving math problem: {e}")
        raise HTTPException(status_code=500, detail="Failed to solve math problem")
