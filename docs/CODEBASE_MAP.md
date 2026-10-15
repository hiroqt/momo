# Codebase Map

Start with [`PRODUCTION_READINESS_CHECKLIST.md`](PRODUCTION_READINESS_CHECKLIST.md) for task IDs, dependencies, and evidence; [`ARD_PRD.md`](../ARD_PRD.md) remains the product contract.

## Backend path

- `backend/app/main.py` configures FastAPI and middleware; `backend/app/api/routes/` exposes API contracts.
- `backend/app/services/extraction/` dispatches PDF, DOCX, PPTX, and TXT to format-specific extractors. PDF page and OCR behavior lives in `pdf_extractor.py`; OCR provider boundaries live in `services/ocr/`.
- `backend/app/services/embeddings/`, `retrieval/`, `synthesis/`, `ai/`, and `validation/` implement the grounded generation pipeline.
- `backend/app/db/` contains repositories and Supabase/PostgREST access; `backend/migrations/` is the ordered schema/RLS/RPC source.
- `backend/tests/` contains unit and integration coverage. The loopback PostgreSQL/PostgREST harness and no-skip gate are documented in `scripts/testing/README.md`.

## Current extraction evidence

DOC-02 mixed-PDF sparse-page recovery is local-tested. The implementation preserves embedded text on dense pages and fills sparse pages from OCR after validating ordered page metadata. See [[knowledge/Momo Document Extraction]] for behavior, verification, and open OCR-quality gates.
