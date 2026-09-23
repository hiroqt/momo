import pytest
from pydantic import ValidationError

from app.schemas.generation import GenerationCreateRequest
from app.services.ai.ai_provider import OpenRouterNemotronProvider


def test_generation_academic_level_is_validated():
    request = GenerationCreateRequest(
        document_id="doc", academic_level="Grade 12", learner_focus="Biology"
    )
    assert request.academic_level == "Grade 12"
    with pytest.raises(ValidationError):
        GenerationCreateRequest(document_id="doc", academic_level="Kindergarten")


def test_generation_prompt_respects_level_and_source_only():
    provider = OpenRouterNemotronProvider(api_key="test", model="test")
    prompt = provider._build_system_prompt(
        "Generate only from evidence.", "medium", None,
        ["flashcard"], topic="Cell Biology", academic_level="Grade 12"
    )
    assert "upper-high-school vocabulary" in prompt
    assert "Never supplement with external knowledge" in prompt
    assert "If GENERATION REQUIREMENTS include a learner_focus" in prompt
