import asyncio
import io
import logging

import docx

from app.config import settings
from app.domain.documents.models import DocumentPage, ExtractedSection, ExtractedTable
from app.services.extraction.archive_guard import validate_office_archive

logger = logging.getLogger(__name__)

class DocxExtractor:
    async def extract(self, file_bytes: bytes) -> list[DocumentPage]:
        validate_office_archive(file_bytes, "word/document.xml")
        try:
            stream = io.BytesIO(file_bytes)
            doc = await asyncio.to_thread(docx.Document, stream)
        except Exception as exc:  # noqa: BLE001 - untrusted archive parser boundary
            logger.warning("Office extraction failed (%s)", type(exc).__name__)
            raise ValueError("The DOCX could not be extracted") from None

        sections: list[ExtractedSection] = []
        tables: list[ExtractedTable] = []
        full_text_blocks: list[str] = []

        current_heading = "Introduction"
        current_content: list[str] = []

        for p in doc.paragraphs:
            text = p.text.strip()
            if not text:
                continue

            if p.style and p.style.name and p.style.name.startswith("Heading"):
                if current_content:
                    sections.append(
                        ExtractedSection(
                            title=current_heading,
                            content="\n".join(current_content)
                        )
                    )
                    current_content = []
                current_heading = text
                current_content.append(text)
            else:
                current_content.append(text)
            full_text_blocks.append(text)

        if current_content:
            sections.append(
                ExtractedSection(
                    title=current_heading,
                    content="\n".join(current_content)
                )
            )

        # Extract tables
        for tbl in doc.tables:
            rows_data = []
            for row in tbl.rows:
                rows_data.append([cell.text.strip() for cell in row.cells])
            if rows_data:
                headers = rows_data[0]
                rows = rows_data[1:] if len(rows_data) > 1 else []
                tables.append(ExtractedTable(headers=headers, rows=rows))

        combined_text = "\n\n".join(full_text_blocks)
        for t in tables:
            md = t.to_markdown()
            if md:
                combined_text += f"\n\n[Table]\n{md}"

        # Group into pseudo-pages (approx 500 words/page)
        items: list[tuple[ExtractedSection, ExtractedTable | None]] = [
            (section, None) for section in sections
        ]
        items.extend(
            (ExtractedSection(title="Table", content=f"[Table]\n{table.to_markdown()}"), table)
            for table in tables
            if table.to_markdown()
        )
        pages: list[DocumentPage] = []
        page_sections: list[ExtractedSection] = []
        page_tables: list[ExtractedTable] = []
        page_text: list[str] = []
        page_word_count = 0

        def finish_page() -> None:
            if page_sections:
                pages.append(
                    DocumentPage(
                        page_number=len(pages) + 1,
                        text="\n\n".join(page_text),
                        sections=page_sections.copy(),
                        tables=page_tables.copy(),
                    )
                )
                page_sections.clear()
                page_tables.clear()
                page_text.clear()

        for section, table in items:
            words = section.content.split()
            while words:
                if page_word_count == 500:
                    finish_page()
                    page_word_count = 0
                if not page_sections and len(pages) >= settings.MAX_PAGE_COUNT:
                    raise ValueError("Document exceeds maximum page count")
                take = min(500 - page_word_count, len(words))
                content = " ".join(words[:take])
                page_sections.append(ExtractedSection(title=section.title, content=content))
                page_text.append(content)
                if table and all(existing is not table for existing in page_tables):
                    page_tables.append(table)
                page_word_count += take
                words = words[take:]

        finish_page()
        return pages or [DocumentPage(page_number=1, text=combined_text)]

docx_extractor = DocxExtractor()
