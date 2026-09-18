import pytest
from app.services.validation.grounding_validator import grounding_validator

def test_grounding_validation_filters_invalid_items():
    raw_items = [
        # Valid item
        {
            "type": "flashcard",
            "question": "What is the primary function of mitochondria?",
            "answer": "To generate ATP through aerobic respiration.",
            "source_metadata": {"page": 12, "section": "Organelles"}
        },
        # Missing answer
        {
            "type": "flashcard",
            "question": "What is ribosome?",
            "answer": "",
            "source_metadata": {"page": 13, "section": "Organelles"}
        },
        # Missing source metadata
        {
            "type": "flashcard",
            "question": "What is Golgi apparatus?",
            "answer": "Packages proteins.",
            "source_metadata": {}
        }
    ]

    valid = grounding_validator.validate_and_deduplicate(raw_items, target_count=5)
    assert len(valid) == 1
    assert valid[0]["question"] == "What is the primary function of mitochondria?"

def test_grounding_validation_deduplicates():
    raw_items = [
        {
            "type": "flashcard",
            "question": "What is HTTP?",
            "answer": "Hypertext Transfer Protocol",
            "source_metadata": {"page": 1, "section": "Web"}
        },
        # Exact duplicate
        {
            "type": "flashcard",
            "question": "what is http?",
            "answer": "Hypertext Transfer Protocol",
            "source_metadata": {"page": 1, "section": "Web"}
        },
        # Duplicate with punctuation variation
        {
            "type": "flashcard",
            "question": "What is HTTP?!",
            "answer": "Hypertext Transfer Protocol",
            "source_metadata": {"page": 1, "section": "Web"}
        }
    ]

    valid = grounding_validator.validate_and_deduplicate(raw_items, target_count=5)
    assert len(valid) == 1

def test_grounding_validation_rejects_identical_question_and_answer():
    raw_items = [
        {
            "type": "flashcard",
            "question": "Photosynthesis",
            "answer": "Photosynthesis",
            "source_metadata": {"page": 5, "section": "Botany"}
        },
        {
            "type": "flashcard",
            "question": "What process converts sunlight into chemical energy in plants?",
            "answer": "Photosynthesis",
            "explanation": "Connection: Plants use chlorophyll to convert light energy into glucose.",
            "source_metadata": {"page": 5, "section": "Botany"}
        }
    ]
    valid = grounding_validator.validate_and_deduplicate(raw_items, target_count=5)
    assert len(valid) == 1
    assert valid[0]["answer"] == "Photosynthesis"

def test_grounding_validation_rejects_too_short_questions():
    raw_items = [
        {
            "type": "flashcard",
            "question": "What",
            "answer": "Energy",
            "source_metadata": {"page": 1, "section": "Physics"}
        },
        {
            "type": "flashcard",
            "question": "What is the SI unit of energy?",
            "answer": "Joule (J)",
            "explanation": "Connection: One joule represents work done by one newton over one meter.",
            "source_metadata": {"page": 1, "section": "Physics"}
        }
    ]
    valid = grounding_validator.validate_and_deduplicate(raw_items, target_count=5)
    assert len(valid) == 1
    assert valid[0]["answer"] == "Joule (J)"

def test_grounding_validation_enforces_allowed_types():
    raw_items = [
        {
            "type": "flashcard",
            "question": "What is the powerhouse of the cell?",
            "answer": "Mitochondria",
            "source_metadata": {"page": 2, "section": "Biology"}
        },
        {
            "type": "multiple_choice",
            "question": "Which organelle generates ATP?",
            "answer": "Mitochondria",
            "options": ["Mitochondria", "Nucleus", "Ribosome", "Vacuole"],
            "source_metadata": {"page": 2, "section": "Biology"}
        },
        {
            "type": "true_false",
            "question": "Mitochondria produce cellular energy in the form of ATP.",
            "answer": "True",
            "options": ["True", "False"],
            "source_metadata": {"page": 2, "section": "Biology"}
        }
    ]

    # Only multiple_choice allowed
    valid_mcq = grounding_validator.validate_and_deduplicate(
        raw_items, target_count=5, allowed_types=["multiple_choice"]
    )
    assert len(valid_mcq) == 1
    assert valid_mcq[0]["type"] == "multiple_choice"

    # Only flashcard allowed
    valid_fc = grounding_validator.validate_and_deduplicate(
        raw_items, target_count=5, allowed_types=["flashcard"]
    )
    assert len(valid_fc) == 1
    assert valid_fc[0]["type"] == "flashcard"

    # multiple_choice and true_false allowed
    valid_quiz = grounding_validator.validate_and_deduplicate(
        raw_items, target_count=5, allowed_types=["multiple_choice", "true_false"]
    )
    assert len(valid_quiz) == 2
    assert {i["type"] for i in valid_quiz} == {"multiple_choice", "true_false"}


