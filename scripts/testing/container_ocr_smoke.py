"""Run inside the backend image using synthetic scanned notes, without network.

    docker run --rm -i --network none --read-only --tmpfs /tmp \
      --cap-drop ALL --security-opt no-new-privileges \
      -e APP_ENV=local -e DATABASE_BACKEND=memory momo-backend:local \
      python - < scripts/testing/container_ocr_smoke.py
"""
import asyncio
import io
import os
import shutil

from PIL import Image, ImageDraw, ImageFont
from pypdf import PdfReader

from app.services.extraction.pdf_extractor import pdf_extractor


async def main():
    assert os.getuid() == 10001, "Expected the non-root runtime user"
    assert shutil.which("tesseract") and shutil.which("pdftoppm"), "OCR binaries missing"
    image = Image.new("RGB", (1800, 1000), "white")
    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 48)
    draw = ImageDraw.Draw(image)
    draw.text((100, 200), "Ribosomes synthesize proteins.", font=font, fill="black")
    draw.text((100, 300), "Mitochondria produce energy for cells.", font=font, fill="black")
    buffer = io.BytesIO()
    image.save(buffer, format="PDF", resolution=150)
    scanned_pdf = buffer.getvalue()
    assert not PdfReader(io.BytesIO(scanned_pdf)).pages[0].extract_text()
    pages = await pdf_extractor.extract(scanned_pdf)
    assert len(pages) == 1 and pages[0].page_number == 1 and pages[0].is_ocr
    assert "ribosomes synthesize proteins" in pages[0].text.lower()
    assert "mitochondria produce energy" in pages[0].text.lower()
    print("PASS: non-root, network-isolated scanned-PDF OCR preserves page and text")


asyncio.run(main())
