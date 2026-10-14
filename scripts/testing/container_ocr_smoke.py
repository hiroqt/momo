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
    font_path = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
    font = ImageFont.truetype(font_path, 48)
    pages = []

    clear = Image.new("RGB", (1800, 1000), "white")
    draw = ImageDraw.Draw(clear)
    draw.text((100, 200), "Ribosomes synthesize proteins.", font=font, fill="black")
    draw.text((100, 300), "Mitochondria produce energy for cells.", font=font, fill="black")
    pages.append(clear)

    low_density = Image.new("RGB", (1800, 1000), "white")
    ImageDraw.Draw(low_density).text(
        (100, 200), "Water freezes at zero degrees Celsius.", font=font, fill="black"
    )
    pages.append(low_density)

    low_contrast = Image.new("RGB", (1800, 1000), "#f4f4f4")
    ImageDraw.Draw(low_contrast).text(
        (100, 200),
        "Chloroplasts capture light during photosynthesis.",
        font=font,
        fill="#666666",
    )
    pages.append(low_contrast)

    pages.append(Image.new("RGB", (1800, 1000), "white"))
    buffer = io.BytesIO()
    pages[0].save(
        buffer, format="PDF", resolution=150, save_all=True, append_images=pages[1:]
    )
    scanned_pdf = buffer.getvalue()
    source_pages = PdfReader(io.BytesIO(scanned_pdf)).pages
    assert len(source_pages) == 4
    assert all(not page.extract_text() for page in source_pages)
    extracted = await pdf_extractor.extract(scanned_pdf)
    assert [page.page_number for page in extracted] == [1, 2, 3, 4]
    assert all(page.is_ocr for page in extracted)
    assert "ribosomes synthesize proteins" in extracted[0].text.lower()
    assert "mitochondria produce energy" in extracted[0].text.lower()
    assert "water freezes at zero degrees celsius" in extracted[1].text.lower()
    assert "chloroplasts capture light during photosynthesis" in extracted[2].text.lower()
    assert extracted[3].text == ""
    print(
        "PASS: non-root, network-isolated four-page scanned-PDF corpus preserves "
        "order, OCR flags, varied text and blank-page output"
    )


asyncio.run(main())
