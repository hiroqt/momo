import pytest
from app.services.embeddings.embedding_service import embedding_service
from app.services.synthesis.synthesis_service import synthesis_service

@pytest.mark.asyncio
async def test_embedding_generation():
    texts = ["Biology notes about cells", "Computer architecture and memory"]
    embs = await embedding_service.embed_texts(texts)
    assert len(embs) == 2
    assert len(embs[0]) == 1536
    assert len(embs[1]) == 1536

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
