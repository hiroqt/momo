---
tags: [momo, backend, extraction, ocr]
updated: 2026-10-16
---
# Momo Document Extraction

`ExtractorService` routes PDF, DOCX, PPTX and TXT inputs to format-specific extractors, then passes ordered `DocumentPage` records into topic discovery and ingestion. For PDFs, [`pdf_extractor.py`](../../backend/app/services/extraction/pdf_extractor.py) extracts embedded text and section metadata first. Pages with fewer than 50 characters are treated as sparse; the OCR provider result is accepted only when page numbers exactly match the PDF order and every returned page is marked `is_ocr`. Extracted text remains authoritative on text-rich pages, while OCR fills sparse pages. A document with no readable text fails closed.

The mixed-PDF regression covers an embedded-text page followed by a raster-only page. It passed with the full loopback PostgreSQL/PostgREST suite (1,047 tests, zero skips/errors/failures), Ruff (147 files), mypy (77 files), and the no-skip gate on 2026-10-16. This is synthetic/local verification. The OCR service currently renders the full PDF when any page is sparse, so mixed PDFs may use extra bounded CPU. Representative real-world OCR quality and hosted/native upload-to-processing behavior remain open under DOC-01/DOC-02.

See [[Momo Public Readiness]] for the public-release gates and [[Momo Readiness Map.canvas]] for task dependencies.
