from typing import Any

from pydantic import BaseModel, Field


class ExtractedSection(BaseModel):
    title: str
    content: str
    level: int = 1

class ExtractedTable(BaseModel):
    headers: list[str] = Field(default_factory=list)
    rows: list[list[str]] = Field(default_factory=list)

    def to_markdown(self) -> str:
        if not self.headers and not self.rows:
            return ""
        lines = []
        if self.headers:
            lines.append(" | ".join(self.headers))
            lines.append(" | ".join(["---"] * len(self.headers)))
        for row in self.rows:
            lines.append(" | ".join(row))
        return "\n".join(lines)

class DocumentPage(BaseModel):
    page_number: int
    text: str
    sections: list[ExtractedSection] = Field(default_factory=list)
    tables: list[ExtractedTable] = Field(default_factory=list)
    is_ocr: bool = False

class DocumentContent(BaseModel):
    document_id: str
    title: str
    source_type: str
    pages: list[DocumentPage] = Field(default_factory=list)
    total_pages: int = 0
    metadata: dict[str, Any] = Field(default_factory=dict)

class DocumentChunk(BaseModel):
    chunk_id: str
    document_id: str
    chunk_index: int
    content: str
    page_start: int
    page_end: int
    section: str = "General"
    source_type: str
    embedding: list[float] | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
