import pytest

from app.services.embeddings.embedding_service import embedding_service
from app.services.synthesis.synthesis_service import synthesis_service


@pytest.mark.asyncio
async def test_embedding_generation():
    texts = ["Biology notes about cells", "Computer architecture and memory"]
    embs = await embedding_service.embed_texts(texts)
    assert len(embs) == 2
    assert len(embs[0]) == 2048
    assert len(embs[1]) == 2048

def test_synthesis_service_sufficiency():
    empty_chunks = []
    syn_empty = synthesis_service.synthesize_context(empty_chunks)
    assert not syn_empty.is_sufficient

    chunks = [
        {
            "document_id": "doc-1",
            "page_start": 4,
            "section": "Cardiology",
            "content": "The myocardium is the muscular tissue of the heart which contracts rhythmically."
        }
    ]
    syn = synthesis_service.synthesize_context(chunks)
    assert syn.is_sufficient
    assert "Cardiology" in syn.context_text
    assert len(syn.sources) == 1
    assert syn.sources[0]["page"] == 4


def test_synthesis_context_budget_keeps_ranked_sentences_and_matching_validation_text():
    chunks = [
        {
            "id": "first",
            "document_id": "doc-1",
            "page_start": 1,
            "section": "Biology",
            "content": "Café cells use glucose. Mitochondria produce ATP.",
        },
        {
            "id": "second",
            "document_id": "doc-1",
            "page_start": 2,
            "section": "Energy",
            "content": "Chloroplasts capture light energy.",
        },
    ]
    one_source_budget = len(
        '<evidence source_id="1" page="1" section="Biology">\n'
        'Café cells use glucose.\n</evidence>'
    .encode())
    evidence = synthesis_service.synthesize_context(
        chunks, min_total_chars=1, max_context_bytes=one_source_budget
    )

    assert evidence.is_sufficient
    assert [source["chunk_id"] for source in evidence.sources] == ["first"]
    assert evidence.evidence_texts == {"first": "Café cells use glucose."}
    assert "Mitochondria" not in evidence.context_text
    assert len(evidence.context_text.encode("utf-8")) <= one_source_budget


def test_synthesis_context_budget_drops_incomplete_chunk_tail():
    evidence = synthesis_service.synthesize_context(
        [{"id": "chunk", "content": "A complete sentence. A cut off final fragment"}],
        min_total_chars=1,
        max_context_bytes=1000,
    )
    assert evidence.evidence_texts == {"chunk": "A complete sentence."}


def test_synthesis_validation_evidence_matches_escaped_model_content():
    evidence = synthesis_service.synthesize_context(
        [{"id": "chunk", "content": "A <cell> & its nucleus."}],
        min_total_chars=1,
        max_context_bytes=1000,
    )
    assert evidence.evidence_texts == {"chunk": "A &lt;cell&gt; &amp; its nucleus."}
    assert evidence.evidence_texts["chunk"] in evidence.context_text


def test_synthesis_context_budget_retains_complete_unpunctuated_bullet():
    evidence = synthesis_service.synthesize_context(
        [{"id": "bullet", "content": "- Ribosomes synthesize proteins from amino acids"}],
        min_total_chars=1,
        max_context_bytes=500,
    )
    assert evidence.evidence_texts == {"bullet": "- Ribosomes synthesize proteins from amino acids"}
