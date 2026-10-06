import asyncio
import io
import logging
import re

from pypdf import PdfReader

from app.config import settings
from app.domain.documents.models import DocumentPage, ExtractedSection
from app.services.ocr.ocr_service import ocr_service

logger = logging.getLogger(__name__)

class PDFExtractor:
    def _detect_running_headers_footers(self, raw_pages_lines: list[list[str]]) -> tuple[set, set]:
        """
        Detect running headers and footers that repeat at the top or bottom across multiple pages.
        """
        if len(raw_pages_lines) <= 1:
            return set(), set()

        first_lines: dict[str, int] = {}
        last_lines: dict[str, int] = {}
        for lines in raw_pages_lines:
            if not lines:
                continue
            top = lines[0].strip()
            if top and len(top) < 100:
                first_lines[top] = first_lines.get(top, 0) + 1
            bottom = lines[-1].strip()
            if bottom and len(bottom) < 100:
                last_lines[bottom] = last_lines.get(bottom, 0) + 1

        # Any line appearing on 2+ pages as top/bottom is considered a running header/footer
        running_headers = {line for line, count in first_lines.items() if count >= 2}
        running_footers = {line for line, count in last_lines.items() if count >= 2}
        return running_headers, running_footers

    def _is_heading_candidate(self, line: str) -> bool:
        """
        Determines if a line is likely a conceptual heading/topic rather than body text.
        """
        cleaned = line.strip()
        if not cleaned or len(cleaned) > 80:
            return False
        # Ignore page numbers like "12" or "Page 12"
        if re.match(r"^(page\s+)?\d+(\s+of\s+\d+)?$", cleaned, re.IGNORECASE):
            return False
        # Numbered headings: e.g. "1.1 Introduction", "Chapter 2", "Section A"
        if re.match(r"^(chapter|section|part|unit)?\s*(\d+(\.\d+)*|[A-Z])[\.\:\-]\s+[A-Za-z]", cleaned, re.IGNORECASE):
            return True
        # Title ending with colon: e.g. "Key Mechanisms:"
        if cleaned.endswith(":") and len(cleaned.split()) <= 8:
            return True
        # Uppercase or Title Case short lines without terminal period
        words = cleaned.split()
        if 1 <= len(words) <= 7 and not cleaned.endswith((".", "!", "?", ";", ",")):
            if cleaned.isupper() or all(w[0].isupper() for w in words if w.isalpha()):
                return True
        return False

    def _extract_sections_from_page(self, lines: list[str], page_num: int) -> tuple[list[ExtractedSection], str]:
        sections: list[ExtractedSection] = []
        current_title = ""
        current_lines: list[str] = []
        cleaned_body_lines: list[str] = []

        for line in lines:
            if self._is_heading_candidate(line):
                if current_lines and current_title:
                    sec_content = "\n".join(current_lines).strip()
                    if sec_content:
                        sections.append(ExtractedSection(title=current_title, content=sec_content))
                current_lines = []
                current_title = line.strip().rstrip(":")
            else:
                current_lines.append(line)
                cleaned_body_lines.append(line)

        if current_lines and current_title:
            sec_content = "\n".join(current_lines).strip()
            if sec_content:
                sections.append(ExtractedSection(title=current_title, content=sec_content))

        cleaned_text = "\n".join(cleaned_body_lines).strip() if cleaned_body_lines else "\n".join(lines).strip()
        return sections, cleaned_text

    def _read_lines(self, file_bytes: bytes) -> list[list[str]]:
        reader = PdfReader(io.BytesIO(file_bytes))
        if reader.is_encrypted:
            raise ValueError("Encrypted PDFs are unsupported")
        # Enforce the page cap before text extraction or OCR does any per-page work.
        if not 1 <= len(reader.pages) <= settings.MAX_PAGE_COUNT:
            raise ValueError("PDF page count is outside the allowed range")
        raw_pages_lines: list[list[str]] = []
        for page in reader.pages:
            text = page.extract_text() or ""
            raw_pages_lines.append([line.strip() for line in text.splitlines() if line.strip()])
        return raw_pages_lines

    async def extract(self, file_bytes: bytes) -> list[DocumentPage]:
        if not file_bytes.startswith(b"%PDF-"):
            raise ValueError("Invalid PDF document")

        try:
            # CPU-bound parsing runs off the event loop.
            raw_pages_lines = await asyncio.to_thread(self._read_lines, file_bytes)

            # Detect and eliminate running headers/footers
            running_headers, running_footers = self._detect_running_headers_footers(raw_pages_lines)

            pages: list[DocumentPage] = []
            total_extracted_text = ""

            for idx, lines in enumerate(raw_pages_lines):
                # Filter out repetitive running headers and footers from each page
                filtered_lines = [
                    line for line in lines
                    if line not in running_headers and line not in running_footers
                ]

                sections, cleaned_text = self._extract_sections_from_page(filtered_lines, idx + 1)
                pages.append(
                    DocumentPage(
                        page_number=idx + 1,
                        text=cleaned_text,
                        sections=sections,
                        is_ocr=False
                    )
                )
                total_extracted_text += cleaned_text

            # Scanned/low-text PDF: run the configured OCR provider. If OCR is unavailable
            # or reads nothing, extraction fails; no placeholder text reaches generation.
            if len(total_extracted_text.strip()) < 50:
                logger.info("PDF text insufficient (<50 chars), invoking OCR")
                ocr_pages = await ocr_service.extract_ocr(file_bytes)
                if not ocr_pages or not any(page.text.strip() for page in ocr_pages):
                    raise ValueError("No readable text")
                return ocr_pages

            return pages
        except Exception as exc:  # noqa: BLE001 - untrusted parser/OCR boundary; log class only
            logger.warning("PDF extraction failed (%s)", type(exc).__name__)
            raise ValueError("The PDF could not be extracted") from None

pdf_extractor = PDFExtractor()
