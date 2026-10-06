"""Optional local OCR with bounded processes and no fabricated extraction."""

import asyncio
import io
import shutil
import tempfile
from abc import ABC, abstractmethod
from pathlib import Path

from pypdf import PdfReader
from pypdf.errors import PyPdfError

from app.config import settings
from app.domain.documents.models import DocumentPage


class OCRUnavailableError(RuntimeError):
    pass


class OCRProvider(ABC):
    @abstractmethod
    async def extract(self, file_bytes: bytes) -> list[DocumentPage]:
        pass


class MockOCRProvider(OCRProvider):
    """Explicit test double; never selected by deployment defaults."""

    def __init__(self) -> None:
        if settings.ENVIRONMENT not in {"development", "test"}:
            raise OCRUnavailableError("Mock OCR is restricted to development/test")

    async def extract(self, file_bytes: bytes) -> list[DocumentPage]:
        return [
            DocumentPage(
                page_number=1,
                text="[OCR Test Fixture]: Scanned educational notes and diagrams.",
                is_ocr=True,
            )
        ]


class TesseractOCRProvider(OCRProvider):
    MAX_BYTES = 15 * 1024 * 1024
    MAX_PAGES = 50
    MAX_TEXT_BYTES = 2 * 1024 * 1024
    PROCESS_TIMEOUT_SECONDS = 30
    TOTAL_TIMEOUT_SECONDS = 180

    def __init__(self, tesseract: str | None = None, rasterizer: str | None = None):
        self.tesseract = tesseract or shutil.which("tesseract")
        self.rasterizer = rasterizer or shutil.which("pdftoppm")

    async def _run(self, *args: str) -> None:
        process = await asyncio.create_subprocess_exec(
            *args, stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.DEVNULL
        )
        try:
            await asyncio.wait_for(process.wait(), self.PROCESS_TIMEOUT_SECONDS)
            if process.returncode:
                raise OCRUnavailableError("OCR process failed")
        except BaseException:
            if process.returncode is None:
                process.kill()
                await process.wait()
            raise

    async def extract(self, file_bytes: bytes) -> list[DocumentPage]:
        if not self.tesseract or not self.rasterizer:
            raise OCRUnavailableError(
                "Local OCR requires Tesseract and a PDF rasterizer"
            )
        if not file_bytes.startswith(b"%PDF-") or len(file_bytes) > self.MAX_BYTES:
            raise ValueError("Invalid OCR document")
        try:
            pages = await asyncio.to_thread(
                lambda: len(PdfReader(io.BytesIO(file_bytes)).pages)
            )
        except (ValueError, TypeError, PyPdfError):
            raise ValueError("Invalid OCR document") from None
        if not 1 <= pages <= self.MAX_PAGES:
            raise ValueError("OCR page limit exceeded")
        async with asyncio.timeout(self.TOTAL_TIMEOUT_SECONDS):
            with tempfile.TemporaryDirectory(prefix="momo-ocr-") as directory:
                root = Path(directory)
                source = root / "source.pdf"
                source.write_bytes(file_bytes)
                result = []
                total_text = 0
                for number in range(1, pages + 1):
                    image = root / "page"
                    await self._run(
                        self.rasterizer,
                        "-f",
                        str(number),
                        "-l",
                        str(number),
                        "-singlefile",
                        "-scale-to",
                        "2000",
                        "-png",
                        str(source),
                        str(image),
                    )
                    # Longest side capped at 2000 pixels: <=4 million pixels/page.
                    output = root / "text"
                    await self._run(
                        self.tesseract,
                        str(image.with_suffix(".png")),
                        str(output),
                        "-l",
                        "eng",
                    )
                    text_file = output.with_suffix(".txt")
                    total_text += text_file.stat().st_size
                    if total_text > self.MAX_TEXT_BYTES:
                        raise ValueError("OCR text limit exceeded")
                    text = text_file.read_text(encoding="utf-8").strip()
                    result.append(
                        DocumentPage(page_number=number, text=text, is_ocr=True)
                    )
                if not any(page.text for page in result):
                    raise OCRUnavailableError("OCR did not extract readable text")
                return result


class OCRService:
    def __init__(self, provider: OCRProvider | None = None):
        self.provider = provider or TesseractOCRProvider()

    async def extract_ocr(self, file_bytes: bytes) -> list[DocumentPage]:
        return await self.provider.extract(file_bytes)


ocr_service = OCRService()


def extract_text_from_base64_image(base64_image: str) -> str:
    # Math image extraction is a separately scoped capability.
    return ""
