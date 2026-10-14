import asyncio
import json

import httpx
import pytest

from app.config import settings
from app.services.validation.typesafe_grounding import (
    GroundingVerificationUnavailable,
    TypeSafeGroundingVerifier,
)


def item(index: int, evidence: str = "Ribosomes synthesize proteins.") -> dict:
    return {
        "type": "flashcard",
        "question": "What do ribosomes synthesize?",
        "answer": "proteins",
        "source_metadata": {
            "document_id": f"private-doc-{index}",
            "chunk_id": f"chunk-{index}",
        },
    }


def answer(choice: str, confidence: float) -> dict:
    rejected = (1 - confidence) / 2
    return {
        "type": "choice",
        "choice": choice,
        "confidence": confidence,
        "probabilities": {
            "supports": confidence if choice == "supports" else 0.1,
            "contradicts": confidence if choice == "contradicts" else rejected,
            "says_nothing": confidence if choice == "says_nothing" else rejected,
        },
    }


@pytest.mark.asyncio
async def test_verifier_batches_minimal_item_and_exact_evidence_and_filters_uncertainty(
    monkeypatch,
):
    monkeypatch.setattr(settings, "TYPESAFE_API_KEY", "test-only-key")
    captured = []

    def respond(request: httpx.Request) -> httpx.Response:
        captured.append(json.loads(request.content))
        return httpx.Response(
            200,
            json={
                "model": "jev-test",
                "answers": {
                    "item_0": answer("supports", 0.91),
                    "item_1": answer("supports", 0.62),
                },
                "usage": {"input_tokens": 100, "output_tokens": 20},
            },
        )

    verifier = TypeSafeGroundingVerifier()
    verifier._client = httpx.AsyncClient(transport=httpx.MockTransport(respond))
    items = [item(0), item(1)]
    try:
        valid = await verifier.verify(
            items,
            {
                "chunk-0": "Ribosomes synthesize proteins.",
                "chunk-1": "Ribosomes synthesize proteins.",
            },
        )
    finally:
        await verifier.close()

    assert valid == [items[0]]
    assert len(captured) == 1
    encoded = json.dumps(captured[0])
    assert "private-doc" not in encoded
    assert "Ribosomes synthesize proteins." in encoded
    assert captured[0]["model"] == "jev-1.13.0"
    assert set(captured[0]["questions"]) == {"item_0", "item_1"}


@pytest.mark.asyncio
async def test_verifier_fails_closed_on_provider_error_and_malformed_answers(
    monkeypatch,
):
    monkeypatch.setattr(settings, "TYPESAFE_API_KEY", "test-only-key")

    async def rejected_status(status: int) -> None:
        verifier = TypeSafeGroundingVerifier()
        verifier._client = httpx.AsyncClient(
            transport=httpx.MockTransport(
                lambda _: httpx.Response(status, text="private provider body")
            )
        )
        try:
            with pytest.raises(GroundingVerificationUnavailable):
                await verifier.verify(
                    [item(0)], {"chunk-0": "Ribosomes synthesize proteins."}
                )
        finally:
            await verifier.close()

    await rejected_status(429)

    verifier = TypeSafeGroundingVerifier()
    verifier._client = httpx.AsyncClient(
        transport=httpx.MockTransport(
            lambda _: httpx.Response(200, json={"answers": {}, "usage": {}})
        )
    )
    try:
        with pytest.raises(GroundingVerificationUnavailable):
            await verifier.verify(
                [item(0)], {"chunk-0": "Ribosomes synthesize proteins."}
            )
    finally:
        await verifier.close()


@pytest.mark.asyncio
async def test_verifier_retries_only_one_transient_overload(monkeypatch):
    monkeypatch.setattr(settings, "TYPESAFE_API_KEY", "test-only-key")
    calls = 0

    def respond(_: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        if calls == 1:
            return httpx.Response(529)
        return httpx.Response(
            200,
            json={
                "model": "jev-test",
                "answers": {"item_0": answer("supports", 0.91)},
                "usage": {"input_tokens": 10, "output_tokens": 2},
            },
        )

    verifier = TypeSafeGroundingVerifier()
    verifier._client = httpx.AsyncClient(transport=httpx.MockTransport(respond))
    try:
        assert await verifier.verify(
            [item(0)], {"chunk-0": "Ribosomes synthesize proteins."}
        )
    finally:
        await verifier.close()
    assert calls == 2


@pytest.mark.asyncio
async def test_no_exact_evidence_is_never_sent_to_typesafe(monkeypatch):
    monkeypatch.setattr(settings, "TYPESAFE_API_KEY", "test-only-key")
    verifier = TypeSafeGroundingVerifier()
    assert await verifier.verify([item(0)], {}) == []


@pytest.mark.asyncio
async def test_verifier_enforces_total_deadline_across_provider_work(monkeypatch):
    monkeypatch.setattr(settings, "TYPESAFE_API_KEY", "test-only-key")
    monkeypatch.setattr(settings, "TYPESAFE_TIMEOUT_SECONDS", 0.01)
    verifier = TypeSafeGroundingVerifier()

    async def slow_evaluate(*_):
        await asyncio.sleep(1)

    monkeypatch.setattr(verifier, "_evaluate", slow_evaluate)
    with pytest.raises(GroundingVerificationUnavailable, match="timed out"):
        await verifier.verify([item(0)], {"chunk-0": "Ribosomes synthesize proteins."})


def test_support_answer_requires_distribution_and_both_confidence_gates():
    assert TypeSafeGroundingVerifier._supports(answer("supports", 0.9))
    assert not TypeSafeGroundingVerifier._supports(answer("supports", 0.79))
    assert not TypeSafeGroundingVerifier._supports(answer("contradicts", 0.99))
    malformed = answer("supports", 0.95)
    malformed["probabilities"]["says_nothing"] = 0.5
    assert not TypeSafeGroundingVerifier._supports(malformed)
