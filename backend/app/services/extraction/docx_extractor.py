import io
from typing import List
import docx
from app.domain.documents.models import DocumentPage, ExtractedSection, ExtractedTable
import logging

logger = logging.getLogger(__name__)

class DocxExtractor:
    async def extract(self, file_bytes: bytes) -> List[DocumentPage]:
        try:
            stream = io.BytesIO(file_bytes)
            doc = docx.Document(stream)
        except Exception as e:
            logger.warning(f"Failed to parse docx package ({e}), attempting text fallback.")
            try:
                decoded = file_bytes.decode("utf-8", errors="replace").strip()
                if decoded:
                    return [DocumentPage(page_number=1, text=decoded, sections=[], tables=[])]
            except Exception:
                pass
            raise

        sections: List[ExtractedSection] = []
        tables: List[ExtractedTable] = []
        full_text_blocks: List[str] = []

        current_heading = "Introduction"
        current_content: List[str] = []

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
        return [
            DocumentPage(
                page_number=1,
                text=combined_text,
                sections=sections,
                tables=tables
            )
        ]

docx_extractor = DocxExtractor()
