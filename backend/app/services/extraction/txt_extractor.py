
from app.domain.documents.models import DocumentPage, ExtractedSection


class TXTExtractor:
    async def extract(self, file_bytes: bytes) -> list[DocumentPage]:
        try:
            text = file_bytes.decode("utf-8-sig")
        except UnicodeDecodeError:
            raise ValueError("The text document must use UTF-8 encoding") from None

        if "\x00" in text:
            raise ValueError("The text document contains binary data")

        # Split roughly every 2500 characters into pseudo pages
        chunk_size = 2500
        pages: list[DocumentPage] = []
        for i in range(0, len(text), chunk_size):
            page_text = text[i:i + chunk_size]
            page_num = (i // chunk_size) + 1
            pages.append(
                DocumentPage(
                    page_number=page_num,
                    text=page_text.strip(),
                    sections=[ExtractedSection(title=f"Page {page_num}", content=page_text.strip())]
                )
            )

        return pages if pages else [DocumentPage(page_number=1, text="")]

txt_extractor = TXTExtractor()
