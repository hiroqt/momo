import io
import re
from typing import List, Tuple
from pypdf import PdfReader
from app.domain.documents.models import DocumentPage, ExtractedSection
from app.services.ocr.ocr_service import ocr_service
import logging

logger = logging.getLogger(__name__)

class PDFExtractor:
    def _detect_running_headers_footers(self, raw_pages_lines: List[List[str]]) -> Tuple[set, set]:
        """
        Detect running headers and footers that repeat at the top or bottom across multiple pages.
        """
        if len(raw_pages_lines) <= 1:
            return set(), set()

        first_lines = {}
        last_lines = {}
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

    def _extract_sections_from_page(self, lines: List[str], page_num: int) -> Tuple[List[ExtractedSection], str]:
        sections: List[ExtractedSection] = []
        current_title = f"Page {page_num} Core Concepts"
        current_lines: List[str] = []
        cleaned_body_lines: List[str] = []

        for line in lines:
            if self._is_heading_candidate(line):
                if current_lines:
                    sec_content = "\n".join(current_lines).strip()
                    if sec_content:
                        sections.append(ExtractedSection(title=current_title, content=sec_content))
                    current_lines = []
                current_title = line.strip().rstrip(":")
            else:
                current_lines.append(line)
                cleaned_body_lines.append(line)

        if current_lines:
            sec_content = "\n".join(current_lines).strip()
            if sec_content:
                sections.append(ExtractedSection(title=current_title, content=sec_content))

        cleaned_text = "\n".join(cleaned_body_lines).strip() if cleaned_body_lines else "\n".join(lines).strip()
        return sections, cleaned_text

    async def extract(self, file_bytes: bytes) -> List[DocumentPage]:
        # Graceful fallback: If file lacks %PDF header (e.g. plain text or mock payload)
        if not file_bytes.startswith(b"%PDF"):
            try:
                decoded_text = file_bytes.decode("utf-8", errors="replace").strip()
                if decoded_text:
                    logger.warning("Document does not contain %PDF header; falling back to text extraction.")
                    lines = [l.strip() for l in decoded_text.splitlines() if l.strip()]
                    sections, _ = self._extract_sections_from_page(lines, 1)
                    return [DocumentPage(page_number=1, text=decoded_text, sections=sections, is_ocr=False)]
            except Exception:
                pass

        try:
            stream = io.BytesIO(file_bytes)
            reader = PdfReader(stream)
            raw_pages_lines: List[List[str]] = []

            for page in reader.pages:
                text = page.extract_text() or ""
                lines = [l.strip() for l in text.splitlines() if l.strip()]
                raw_pages_lines.append(lines)

            # Detect and eliminate running headers/footers
            running_headers, running_footers = self._detect_running_headers_footers(raw_pages_lines)

            pages: List[DocumentPage] = []
            total_extracted_text = ""

            for idx, lines in enumerate(raw_pages_lines):
                # Filter out repetitive running headers and footers from each page
                filtered_lines = [
                    l for l in lines
                    if l not in running_headers and l not in running_footers
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

            # If PDF is scanned (empty or near-empty text across pages), invoke OCR
            if len(total_extracted_text.strip()) < 50:
                logger.info("PDF text insufficient (<50 chars), invoking OCR fallback")
                ocr_pages = await ocr_service.extract_ocr(file_bytes)
                if ocr_pages:
                    return ocr_pages

            return pages
        except Exception as e:
            logger.warning(f"pypdf extraction encountered error ({e}); attempting text and OCR fallback.")
            try:
                decoded_text = file_bytes.decode("utf-8", errors="replace").strip()
                if len(decoded_text) > 20:
                    lines = [l.strip() for l in decoded_text.splitlines() if l.strip()]
                    sections, _ = self._extract_sections_from_page(lines, 1)
                    return [DocumentPage(page_number=1, text=decoded_text, sections=sections, is_ocr=False)]
            except Exception:
                pass
            ocr_pages = await ocr_service.extract_ocr(file_bytes)
            if ocr_pages:
                return ocr_pages
            raise

pdf_extractor = PDFExtractor()
