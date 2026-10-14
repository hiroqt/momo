import json

import pytest

from app.services.validation.typesafe_grounding import (
    BATCH_SIZE,
    MAX_REQUEST_BYTES,
    GroundingVerificationUnavailable,
)
from scripts.jev_grounding_eval import load_cases, request_payload, score_results


def test_metrics_compare_exact_production_auto_accept_to_labeled_support():
    cases = [
        {"id": "p1", "expected": "supports"},
        {"id": "p2", "expected": "supports"},
        {"id": "n1", "expected": "contradicts"},
        {"id": "n2", "expected": "says_nothing"},
    ]
    answers = {
        "p1": {"type": "choice", "choice": "supports", "confidence": 0.91,
            "probabilities": {"supports": 0.91, "contradicts": 0.05, "says_nothing": 0.04}},
        "p2": {"type": "choice", "choice": "says_nothing", "confidence": 0.88,
            "probabilities": {"supports": 0.04, "contradicts": 0.08, "says_nothing": 0.88}},
        "n1": {"type": "choice", "choice": "supports", "confidence": 0.90,
            "probabilities": {"supports": 0.90, "contradicts": 0.06, "says_nothing": 0.04}},
        "n2": {"type": "choice", "choice": "says_nothing", "confidence": 0.87,
            "probabilities": {"supports": 0.07, "contradicts": 0.06, "says_nothing": 0.87}},
    }

    metrics = score_results(cases, answers)

    assert metrics == {
        "total": 4,
        "auto_accept": {
            "true_positive": 1, "false_positive": 1,
            "true_negative": 1, "false_negative": 1,
            "false_accept_rate": 0.5, "false_reject_rate": 0.5,
        },
    }


def test_evaluation_fixture_is_bounded_unique_and_covers_all_labels():
    cases = load_cases()

    assert len(cases) <= 24
    assert (len(cases) + BATCH_SIZE - 1) // BATCH_SIZE == 2
    assert len({case["id"] for case in cases}) == len(cases)
    assert {case["expected"] for case in cases} == {
        "supports", "contradicts", "says_nothing"
    }
    assert next(case for case in cases if case["id"] == "unknown_injected_evidence")["expected"] == "contradicts"
    assert all(len(case["evidence"]) <= 2_000 for case in cases)


def test_request_payload_reuses_runtime_prompt_and_batch_limit():
    cases = load_cases()[:BATCH_SIZE]

    payload = request_payload(cases)

    assert len(payload["questions"]) == len(cases)
    assert payload["questions"]["item_0"]["instructions"]["question"].startswith(
        "How does the cited evidence relate to the proposed answer"
    )
    assert len(json.dumps(payload, ensure_ascii=False).encode("utf-8")) <= MAX_REQUEST_BYTES


def test_request_payload_rejects_multibyte_overflow():
    cases = load_cases()[:5]
    for index in range(len(cases)):
        cases[index] = {**cases[index], "evidence": "🧠" * 8_000}

    with pytest.raises(GroundingVerificationUnavailable):
        request_payload(cases)
