from typing import List
from app.domain.documents.models import DocumentPage, DocumentContent
from app.services.extraction.pdf_extractor import pdf_extractor
from app.services.extraction.docx_extractor import docx_extractor
from app.services.extraction.pptx_extractor import pptx_extractor
from app.services.extraction.txt_extractor import txt_extractor
from app.config import settings
import logging

logger = logging.getLogger(__name__)

class ExtractorService:
    async def extract_document(
        self,
        document_id: str,
        filename: str,
        file_type: str,
        file_bytes: bytes
    ) -> DocumentContent:
        file_type_clean = file_type.lower().lstrip(".")

        if file_type_clean == "pdf":
            pages = await pdf_extractor.extract(file_bytes)
        elif file_type_clean in ["docx", "doc"]:
            pages = await docx_extractor.extract(file_bytes)
        elif file_type_clean in ["pptx", "ppt"]:
            pages = await pptx_extractor.extract(file_bytes)
        elif file_type_clean == "txt":
            pages = await txt_extractor.extract(file_bytes)
        else:
            raise ValueError(f"Unsupported file type: {file_type}")

        # Check page count limit
        if len(pages) > settings.MAX_PAGE_COUNT:
            logger.warning(f"Document {document_id} exceeded max pages ({len(pages)} > {settings.MAX_PAGE_COUNT})")
            # Cap pages to MAX_PAGE_COUNT for MVP safety
            pages = pages[:settings.MAX_PAGE_COUNT]

        # Extract suggested study topics from content
        suggested_topics = self.extract_suggested_topics(pages, filename)

        return DocumentContent(
            document_id=document_id,
            title=filename,
            source_type=file_type_clean,
            pages=pages,
            total_pages=len(pages),
            metadata={"suggested_topics": suggested_topics}
        )

    def extract_suggested_topics(self, pages: List[DocumentPage], filename: str) -> List[str]:
        topics: List[str] = []
        clean_name = filename.rsplit(".", 1)[0].replace("_", " ").replace("-", " ").title()
        
        seen = set()
        # 1. Collect from section headings
        for page in pages:
            for sec in page.sections:
                title = sec.title.strip()
                if not title:
                    continue
                # Strip numeric prefixes: "1.1 ", "Chapter 2: "
                import re
                cleaned = re.sub(r"^(chapter|section|part|unit)?\s*(\d+(\.\d+)*|[A-Z])[\.\:\-]\s*", "", title, flags=re.IGNORECASE).strip()
                cleaned = cleaned.rstrip(":")
                
                # Filter out generic/boilerplate headings
                lower = cleaned.lower()
                if any(bad in lower for bad in ["core concepts", "introduction", "conclusion", "table of contents", "references", "overview", "page "]):
                    continue
                if len(cleaned) >= 3 and len(cleaned) <= 60 and lower not in seen:
                    seen.add(lower)
                    topics.append(cleaned)

        # 2. Fallback if few sections found: extract key noun phrases from text
        if len(topics) < 2:
            combined = " ".join(p.text for p in pages[:5])
            # Find capitalized term patterns (e.g. "Action Potential", "Krebs Cycle")
            import re
            candidates = re.findall(r"\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}\b", combined)
            freq = {}
            for c in candidates:
                c_clean = c.strip()
                c_lower = c_clean.lower()
                if c_lower not in seen and len(c_clean) > 4:
                    freq[c_clean] = freq.get(c_clean, 0) + 1
            sorted_candidates = sorted(freq.keys(), key=lambda k: freq[k], reverse=True)
            for cand in sorted_candidates[:4]:
                if cand.lower() not in seen:
                    seen.add(cand.lower())
                    topics.append(cand)

        # 3. Always include a comprehensive option first, followed by top 4 extracted topics
        results = [f"Entire Document ({clean_name})"]
        results.extend(topics[:4])
        return results

extractor_service = ExtractorService()
