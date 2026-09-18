from abc import ABC, abstractmethod
from typing import List
from app.domain.documents.models import DocumentPage
import logging

logger = logging.getLogger(__name__)

class OCRProvider(ABC):
    @abstractmethod
    async def extract(self, file_bytes: bytes) -> List[DocumentPage]:
        """Extract text and pages via OCR when standard extraction yields no text."""
        pass

class MockOCRProvider(OCRProvider):
    async def extract(self, file_bytes: bytes) -> List[DocumentPage]:
        logger.info("Running Mock OCR extraction")
        return [
            DocumentPage(
                page_number=1,
                text="[OCR Extracted Text]: Scanned educational notes and diagrams.",
                is_ocr=True
            )
        ]

class OCRService:
    def __init__(self, provider: OCRProvider = None):
        self.provider = provider or MockOCRProvider()

    async def extract_ocr(self, file_bytes: bytes) -> List[DocumentPage]:
        return await self.provider.extract(file_bytes)

ocr_service = OCRService()
