import logging
from typing import Any

from app.db.repositories.documents_repo import documents_repo
from app.db.repositories.generation_repo import generation_repo
from app.services.ai.ai_provider import ai_provider
from app.services.retrieval.retrieval_service import retrieval_service
from app.services.synthesis.synthesis_service import synthesis_service
from app.services.validation.grounding_validator import grounding_validator

logger = logging.getLogger(__name__)

class GenerationWorker:
    async def process_generation(
        self,
        job_id: str,
        user_id: str,
        document_id: str,
        generation_spec: dict[str, Any]
    ):
        job = await generation_repo.get_job(job_id, user_id)
        if not job or job.get("status") == "COMPLETED" or job.get("study_set_id"):
            return
        try:
            logger.info(f"Starting generation job: {job_id}")

            # 1. Indexing & Evidence Retrieval
            await generation_repo.update_job(
                job_id=job_id,
                status="PROCESSING",
                stage="Understanding content",
                progress=20,
                message="Retrieving relevant study concepts..."
            )

            topic = generation_spec.get("topic", "General Review")
            custom_instruction = generation_spec.get("custom_instruction")
            target_count = generation_spec.get("count", 15)
            section_filter = generation_spec.get("focus_sections")
            mode = generation_spec.get("generation_mode", "reviewer")
            content_level = generation_spec.get("content_level", "moderate")
            document_ids = generation_spec.get("document_ids")

            if mode == "reviewer":
                if content_level == "light":
                    target_count = 12
                elif content_level == "detailed":
                    target_count = 35
                else:
                    target_count = 20
                effective_types = generation_spec.get("reviewer_types") or [
                    "glossary", "concept_outline", "cheat_sheet", "compare_contrast", "qa_study_sheet", "timeline_process"
                ]
            elif mode == "both":
                rev_types = generation_spec.get("reviewer_types") or ["glossary", "concept_outline", "cheat_sheet"]
                quiz_types = generation_spec.get("question_types") or ["flashcard", "multiple_choice"]
                effective_types = rev_types + quiz_types
            else:
                effective_types = generation_spec.get("question_types") or ["flashcard", "multiple_choice"]

            # Build rich semantic search query combining topic + custom user instructions
            search_query = retrieval_service.build_search_query(topic, custom_instruction)

            # Rich signal density window (up to 40 diverse non-redundant chunks to maximize coverage)
            evidence_chunks = await retrieval_service.retrieve_evidence(
                user_id=user_id,
                document_id=document_id,
                query=search_query,
                top_k=min(max(10, target_count), 40),
                section_filter=section_filter,
                document_ids=document_ids
            )

            # 2. Synthesize Grounded Context
            await generation_repo.update_job(
                job_id=job_id,
                status="PROCESSING",
                stage="Preparing study material",
                progress=40,
                message="Extracting key study concepts and facts from your document..."
            )

            synthesized = synthesis_service.synthesize_context(evidence_chunks)

            # Enrich sources with human-readable original document filename
            try:
                doc = await documents_repo.get_by_id(document_id, user_id)
                doc_name = doc.get("original_filename") if doc else "Source Material"
                for s in synthesized.sources:
                    s["document_name"] = doc_name
            except Exception as e:  # noqa: BLE001 - source names are optional metadata.
                logger.debug("Could not resolve document filename (%s)", type(e).__name__)

            # Check source sufficiency (Strict grounding rule!)
            if not synthesized.is_sufficient:
                logger.warning("Insufficient source evidence")
                await generation_repo.update_job(
                    job_id=job_id,
                    status="FAILED",
                    stage="Insufficient Source",
                    progress=100,
                    message="The uploaded material does not contain enough information about the requested topic.",
                    error="INSUFFICIENT_SOURCE"
                )
                return

            # 3. Model Generation (Fast parallel batching)
            is_reviewer = mode in ("reviewer", "both")
            stage_title = "Cooking your reviewer" if is_reviewer else "Crafting your quiz"
            gen_msg = "Momo is compiling your high-yield reviewer study guide..." if is_reviewer else "Momo is crafting your questions and flashcards..."

            await generation_repo.update_job(
                job_id=job_id,
                status="GENERATING",
                stage=stage_title,
                progress=65,
                message=gen_msg
            )

            # Pass generation buffer (+20%) so deduplication yields the maximum requested target count
            buffered_spec = dict(generation_spec)
            buffered_spec["count"] = target_count + max(2, target_count // 5)
            buffered_spec["effective_types"] = effective_types

            system_instruction = (
                "You are an expert educational reviewer and study guide synthesizer strictly bound to the supplied study evidence."
                if is_reviewer else
                "You are an expert educational quiz generator strictly bound to the supplied study evidence."
            )
            raw_items = await ai_provider.generate_study_material(
                system_instruction=system_instruction,
                generation_spec=buffered_spec,
                source_evidence=synthesized.context_text,
                sources_metadata=synthesized.sources
            )

            if not raw_items:
                await generation_repo.update_job(
                    job_id=job_id,
                    status="FAILED",
                    stage="Generation Failed",
                    progress=100,
                    message="Could not generate study reviewer from the material.",
                    error="EMPTY_AI_RESPONSE"
                )
                return

            # 4. Validation & Deduplication (Strict format matching)
            await generation_repo.update_job(
                job_id=job_id,
                status="VALIDATING",
                stage="Fact-checking content",
                progress=85,
                message="Fact-checking concepts and verifying grounded material..."
            )

            valid_items = grounding_validator.validate_and_deduplicate(
                raw_items=raw_items,
                target_count=target_count,
                allowed_types=effective_types
            )

            if not valid_items:
                await generation_repo.update_job(
                    job_id=job_id,
                    status="FAILED",
                    stage="Validation Failed",
                    progress=100,
                    message="Generated items could not be verified against the material.",
                    error="VALIDATION_FAILED"
                )
                return

            # Save the reviewer, its items, and the completed job in one transaction.
            await generation_repo.update_job(
                job_id=job_id,
                status="VALIDATING",
                stage="Packaging reviewer",
                progress=95,
                message="Packaging your high-yield reviewer..."
            )

            custom_title = generation_spec.get("title")
            set_title = custom_title.strip() if custom_title and custom_title.strip() else f"{topic} Reviewer"

            study_set = await generation_repo.complete_with_study_set(job_id, user_id, {
                "user_id": user_id,
                "document_id": document_id,
                "title": set_title,
                "description": f"Generated from uploaded study material ({len(valid_items)} items)",
                "generation_config": generation_spec,
                "generation_status": "COMPLETED",
                "item_count": len(valid_items)
            }, valid_items)
            logger.info(f"Generation job {job_id} successfully created study set {study_set['id']}")

        except Exception as e:  # noqa: BLE001 - worker boundary records a controlled failure.
            logger.error("Generation worker failed (%s)", type(e).__name__)
            await generation_repo.update_job(
                job_id=job_id,
                status="FAILED",
                stage="Failed",
                progress=100,
                message="An unexpected error occurred during reviewer generation.",
                error="Reviewer generation failed. Please retry."
            )

generation_worker = GenerationWorker()
