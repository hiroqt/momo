import pytest
from app.services.extraction.txt_extractor import txt_extractor
from app.services.extraction.chunking_service import chunking_service
from app.domain.documents.models import DocumentContent, DocumentPage, ExtractedSection

@pytest.mark.asyncio
async def test_txt_extractor():
    sample_text = b"Photosynthesis is the process by which green plants use sunlight to synthesize nutrients."
    pages = await txt_extractor.extract(sample_text)
    assert len(pages) == 1
    assert "Photosynthesis" in pages[0].text
    assert pages[0].page_number == 1

@pytest.mark.asyncio
async def test_chunking_preserves_metadata():
    pages = [
        DocumentPage(
            page_number=1,
            text="Cellular respiration converts glucose into ATP.",
            sections=[
                ExtractedSection(
                    title="Glycolysis",
                    content="Glycolysis occurs in the cytoplasm and breaks down glucose."
                )
            ]
        )
    ]
    doc = DocumentContent(
        document_id="doc-test-1",
        title="Biology.txt",
        source_type="txt",
        pages=pages,
        total_pages=1
    )

    chunks = chunking_service.chunk_document(doc)
    assert len(chunks) >= 1
    assert chunks[0].document_id == "doc-test-1"
    assert chunks[0].section == "Glycolysis"
    assert chunks[0].page_start == 1
    assert "Glycolysis occurs in the cytoplasm" in chunks[0].content

@pytest.mark.asyncio
async def test_suggested_topics_extraction():
    from app.services.extraction.extractor_service import extractor_service
    pages = [
        DocumentPage(
            page_number=1,
            text="Cardiovascular anatomy overview.",
            sections=[
                ExtractedSection(title="1.1 Cardiac Muscle Physiology", content="Heart tissue details."),
                ExtractedSection(title="1.2 Coronary Circulation", content="Blood vessel details.")
            ]
        ),
        DocumentPage(
            page_number=2,
            text="Electrical conduction.",
            sections=[
                ExtractedSection(title="1.3 Sinoatrial Node Function", content="Pacemaker details.")
            ]
        )
    ]
    topics = extractor_service.extract_suggested_topics(pages, "Human_Cardiovascular_System.pdf")
    assert len(topics) >= 2
    assert "Entire Document (Human Cardiovascular System)" in topics[0]
    assert any("Cardiac Muscle Physiology" in t for t in topics)
    assert any("Coronary Circulation" in t for t in topics)
