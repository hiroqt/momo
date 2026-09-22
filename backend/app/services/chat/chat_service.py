import json
import logging
import re
from typing import List, Dict, Any, Optional
import uuid

from app.db.repositories.chat_repo import chat_repo
from app.db.repositories.documents_repo import documents_repo
from app.db.repositories.study_repo import study_repo
from app.services.retrieval.retrieval_service import retrieval_service
from app.services.synthesis.synthesis_service import synthesis_service
from app.services.validation.grounding_validator import grounding_validator
from app.services.ai.ai_provider import ai_provider
from app.services.ai.image_service import image_service
from app.services.ai.diagram_synthesizer import diagram_synthesizer
from app.services.security.guardrails_service import guardrails_service
from app.db.repositories.learning_repo import learning_repo
from app.schemas.chat import (
    ChatMessageResponse,
    CitationItem,
    CreatedDeckMetadata,
    StudyCardMetadata,
    ToolCallRecord,
)

logger = logging.getLogger(__name__)

MOMO_SYSTEM_PROMPT = """You are Momo, the user's cheerful, brilliant, and dedicated AI personal study companion.
Your mission is to help students learn effectively, understand difficult concepts, and build high-yield flashcard decks and practice quizzes.

CORE REASONING & INTERACTION RULES:
1. GROUNDING & SOURCE SELECTION:
   - When answering questions about study materials, retrieve evidence using `search_documents`.
   - When a user asks to make a deck, quiz, or flashcards:
     a) IF the user has NOT specified a topic (e.g. clicks "Build a 10-card flashcard deck" or says "make me flashcards"):
        DO NOT fail or blindly create a deck. Ask the user warmly:
        "What topic would you like to study? You can pick any topic (e.g. Python Arrays, Java Arrays, Cell Biology, Calculus) or tell me to ground it in your uploaded notes."
        And offer popular topics.
     b) IF the user replies with or provides a topic (e.g. "Java arrays", "Arrays using Python", "Calculus", "World War 2"):
        - CRITICAL RULE: If the assistant previously asked what topic the user wants to study, or if the user is answering what topic to study, DO NOT ask them again or say "I'd like to help you, please upload"! The user already gave you the topic!
        - Immediately call `create_study_deck` with `topic=<topic>`, `count=10` (or requested count), `allow_ai_generation=True` to immediately generate and save the complete deck!
     c) IF the user provides a topic up front with no prior dialogue (e.g. "create me 10 flashcards about arrays using Python"):
        - If the user has uploaded documents for this topic, ground the deck in their notes.
        - If the user has NO uploaded documents for this topic, ask whether they want Momo AI to build the deck using curated educational AI knowledge right away, or if they would prefer to upload their own course notes first.
     d) IF the user chooses "Let Momo build", "Build with AI", "Let the AI build", or confirms:
        - Call `create_study_deck` with `allow_ai_generation=True` to immediately generate and save the complete deck!
2. AGENTIC CAPABILITIES:
   - `list_user_documents`: Check user's available notes and readiness.
   - `create_study_deck`: Build flashcard decks and quizzes. Set `allow_ai_generation=True` when building without uploaded documents upon user selection or topic reply.
   - `generate_study_card`: Generate a single interactive study card for instant review and 1-tap library import.
   - `generate_diagram`: Generate an educational 2D scientific concept diagram or visual study illustration for a topic (e.g. when the user asks for a diagram, image diagram, illustration, or visual study card).
   - `get_learning_profile`: Inspect student's personal mastery score, weak topics, strong topics, and study progress.
   - `generate_weakness_review`: Generate an adaptive remedial study deck focused specifically on topics and questions the student struggled with or missed.
3. VISUAL IMAGES, DIAGRAMS & ILLUSTRATIONS:
   - Momo CAN and MUST generate educational images, concept diagrams, and visual illustrations!
   - Whenever the user asks to generate, create, provide, show, draw, or make an image, diagram, picture, or visual study aid (e.g. "generate an image of...", "create an image", "create a image", "provide an image", "can you provide the image", "draw me a diagram", "show an image of X", "can you create an image"):
     * NEVER say you cannot create images or cannot provide images! You have the `generate_diagram` tool specifically to produce educational visual images and diagrams!
     * Immediately call `generate_diagram` with `topic=<topic>`, `requirements=<specific sub-topic or user requirements>`, `diagram_prompt=<detailed visual description of the clean 2D educational diagram>`, and `explanation=<concept summary>`.
     * In the message with the generated image, DO NOT include lengthy lecture paragraphs or full explanations. Keep the accompanying message concise (e.g. "Visual concept diagram: **Topic**").
     * Keep in-depth details, step-by-step breakdowns, and deep dives for follow-up chats or when the user asks for details.
     * Provide helpful follow-up quick replies so the user can easily ask for details on the next turn.
   - When the user asks a follow-up about the diagram (e.g. "Explain this diagram in detail", "Break down the steps of this diagram", "Tell me more about this diagram"):
     * Do NOT generate another diagram!
     * Synthesize a comprehensive, high-yield explanation breaking down the structures, mechanism, flow, and exam takeaways in that follow-up response.
   - If the user asks for an image or diagram without specifying a topic (e.g. "generate an image", "create a image", "can you provide an image"), use the previous concept discussed or choose a high-yield computer science or biological topic (e.g. Binary Search Tree or Human Heart Anatomy).
4. SELF-LEARNING & ADAPTIVE STUDY COMPANION:
   - Momo autonomously tracks student accuracy, mastery score, and weak spots.
   - When the user asks "how am I doing?", "what should I study?", "what are my weak spots?", or "how is my progress?", call `get_learning_profile`.
   - When the user asks "review what I missed", "quiz me on my mistakes", or "help me practice my weak topics", call `generate_weakness_review`.
   - Speak with genuine encouragement, celebrate their strengths, and offer targeted study plans for their weak areas.
5. FORMATTING & STYLE RULES:
   - STRICT RULE - ZERO EMOJIS: Never include any emojis or emoji characters in messages, questions, answers, or suggestions. Use clean typography, bold headings, and clear bullet points instead.
   - Encouraging, energetic, smart, and concise.
   - Keep the learning journey proactive and frictionless!
"""

CHAT_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "list_user_documents",
            "description": "List all uploaded educational documents and lecture notes available for the user.",
            "parameters": {
                "type": "object",
                "properties": {}
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "search_documents",
            "description": "Search the user's uploaded documents for factual study evidence, definitions, and concepts.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "The search query for relevant concepts or questions."
                    },
                    "document_id": {
                        "type": "string",
                        "description": "Optional specific document ID to restrict search."
                    }
                },
                "required": ["query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "create_study_deck",
            "description": "Build an interactive study deck or practice quiz from the user's uploaded documents or curated educational AI knowledge.",
            "parameters": {
                "type": "object",
                "properties": {
                    "topic": {
                        "type": "string",
                        "description": "The concept or topic to focus the reviewer on."
                    },
                    "count": {
                        "type": "integer",
                        "description": "Number of questions/cards to generate (default 10, max 30)."
                    },
                    "difficulty": {
                        "type": "string",
                        "enum": ["easy", "medium", "hard"],
                        "description": "Difficulty level of the study set."
                    },
                    "question_types": {
                        "type": "array",
                        "items": {
                            "type": "string",
                            "enum": ["flashcard", "multiple_choice", "true_false", "identification"]
                        },
                        "description": "Types of study items to generate."
                    },
                    "document_id": {
                        "type": "string",
                        "description": "Optional specific document ID. If omitted, uses best available uploaded document."
                    },
                    "allow_ai_generation": {
                        "type": "boolean",
                        "description": "Set to true when the user explicitly chooses or confirms to let Momo AI build the deck using curated educational AI knowledge, or when no documents are uploaded."
                    },
                    "custom_instruction": {
                        "type": "string",
                        "description": "Optional user custom guidance or focus points."
                    }
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "list_study_decks",
            "description": "List the user's existing study sets and decks to review their progress.",
            "parameters": {
                "type": "object",
                "properties": {}
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "generate_study_card",
            "description": "Generate a single high-yield study flashcard or quiz item that the user can import into their library.",
            "parameters": {
                "type": "object",
                "properties": {
                    "topic": {
                        "type": "string",
                        "description": "Topic or concept for this study card."
                    },
                    "question": {
                        "type": "string",
                        "description": "Question prompt or term."
                    },
                    "answer": {
                        "type": "string",
                        "description": "Correct answer or definition."
                    },
                    "explanation": {
                        "type": "string",
                        "description": "High-yield explanation of the answer."
                    },
                    "question_type": {
                        "type": "string",
                        "enum": ["flashcard", "multiple_choice", "true_false"],
                        "description": "Type of study card."
                    },
                    "difficulty": {
                        "type": "string",
                        "enum": ["easy", "medium", "hard"],
                        "description": "Difficulty level."
                    },
                    "options": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Optional answer choices if multiple choice."
                    },
                    "diagram_prompt": {
                        "type": "string",
                        "description": "Optional prompt for a clean 2D educational scientific diagram illustrating the concept."
                    }
                },
                "required": ["topic", "question", "answer"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "generate_diagram",
            "description": "Generate an educational image, visual concept diagram, scientific illustration, or concept chart for any topic or concept. Always call this tool whenever the user asks to see, generate, draw, create, or provide an image, diagram, picture, visual aid, or illustration (e.g. 'generate an image', 'create an image', 'provide an image', 'draw a diagram', 'show me an image', 'cant create an image').",
            "parameters": {
                "type": "object",
                "properties": {
                    "topic": {
                        "type": "string",
                        "description": "The topic or concept to illustrate (e.g. 'Photosynthesis', 'Binary Search Tree', 'Neuron Structure', 'Arrays in Memory'). If the user does not specify a topic, select the previous topic discussed or choose a foundational science/computing topic like 'Binary Search Tree' or 'Human Heart Anatomy'."
                    },
                    "requirements": {
                        "type": "string",
                        "description": "Specific sub-topic, custom values, or user requirements (e.g. 'electrical conduction system', 'heart valves', 'array slicing [1:4]', 'binary search tree with nodes 50, 30, 70')."
                    },
                    "diagram_prompt": {
                        "type": "string",
                        "description": "Visual description of the diagram, annotations, and flow."
                    },
                    "explanation": {
                        "type": "string",
                        "description": "Clear educational explanation of the illustrated concept."
                    }
                },
                "required": ["topic"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_learning_profile",
            "description": "Retrieve the student's personal learning profile, including mastery score, weak topics, mastered topics, missed questions, and recommended study plan.",
            "parameters": {
                "type": "object",
                "properties": {}
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "generate_weakness_review",
            "description": "Generate an adaptive review deck or quiz focused specifically on topics and concepts the student previously answered incorrectly or struggled with.",
            "parameters": {
                "type": "object",
                "properties": {
                    "count": {
                        "type": "integer",
                        "description": "Number of targeted reinforcement questions to generate (default 5, max 15)."
                    },
                    "topic": {
                        "type": "string",
                        "description": "Optional specific weak topic to drill down into."
                    }
                }
            }
        }
    }
]

class ChatService:
    async def execute_tool(
        self,
        tool_name: str,
        arguments: Any,
        user_id: str,
        context_document_id: Optional[str] = None
    ) -> Dict[str, Any]:
        if isinstance(arguments, str):
            try:
                arguments = json.loads(arguments)
            except Exception:
                arguments = {}
        elif not isinstance(arguments, dict):
            arguments = {}

        logger.info(f"Executing chat tool: {tool_name} with args: {arguments}")

        if tool_name == "list_user_documents":
            docs = await documents_repo.list_by_user(user_id)
            summaries = []
            for d in docs:
                summaries.append({
                    "id": d.get("id"),
                    "original_filename": d.get("original_filename"),
                    "page_count": d.get("page_count", 0),
                    "processing_status": d.get("processing_status"),
                    "suggested_topics": d.get("suggested_topics", [])
                })
            return {"documents": summaries}

        elif tool_name == "search_documents":
            query = arguments.get("query", "")
            doc_id = arguments.get("document_id") or context_document_id
            chunks = await retrieval_service.retrieve_evidence_for_chat(
                user_id=user_id,
                query=query,
                document_id=doc_id,
                top_k=6
            )
            citations = []
            for c in chunks:
                citations.append({
                    "document_id": c.get("document_id"),
                    "document_name": c.get("document_name"),
                    "page_start": c.get("page_start"),
                    "page_end": c.get("page_end"),
                    "section": c.get("section"),
                    "snippet": (c.get("content") or "")[:200]
                })
            return {"evidence_chunks": chunks, "citations": citations}

        elif tool_name == "create_study_deck":
            doc_id = arguments.get("document_id") or context_document_id
            user_docs = await documents_repo.list_by_user(user_id)
            ready_docs = [d for d in user_docs if d.get("processing_status") == "READY"]
            allow_ai_gen = bool(arguments.get("allow_ai_generation", False))

            topic = arguments.get("topic") or "Core Study Review"
            count = int(arguments.get("count") or 10)
            count = min(max(count, 3), 30)
            difficulty = arguments.get("difficulty") or "medium"
            question_types = arguments.get("question_types") or ["flashcard", "multiple_choice"]
            custom_instruction = arguments.get("custom_instruction")

            # Case 1: No documents and user has not confirmed AI generation yet
            if not ready_docs and not allow_ai_gen:
                return {
                    "status": "AWAITING_SOURCE_CHOICE",
                    "topic": topic,
                    "count": count,
                    "question_types": question_types,
                    "message": f"No processed documents available for '{topic}'. Offer the user the choice between letting Momo AI build the deck right away or uploading course materials."
                }

            # Case 2: Grounded generation from uploaded documents
            if ready_docs and not allow_ai_gen:
                target_doc = None
                if doc_id:
                    target_doc = next((d for d in ready_docs if d.get("id") == doc_id), None)
                if not target_doc:
                    target_doc = ready_docs[0]

                doc_id = target_doc["id"]
                doc_title = target_doc.get("original_filename", "Source Notes")

                search_query = retrieval_service.build_search_query(topic, custom_instruction)
                evidence_chunks = await retrieval_service.retrieve_evidence(
                    document_id=doc_id,
                    query=search_query,
                    top_k=min(max(10, count), 25)
                )

                synthesized = synthesis_service.synthesize_context(evidence_chunks)
                if not synthesized.is_sufficient and not evidence_chunks:
                    return {
                        "status": "AWAITING_SOURCE_CHOICE",
                        "topic": topic,
                        "count": count,
                        "question_types": question_types,
                        "message": f"Could not find enough details about '{topic}' in {doc_title}. Offer to build with Momo AI or upload notes."
                    }

                for s in synthesized.sources:
                    s["document_name"] = doc_title

                source_evidence = synthesized.context_text
                sources_meta = synthesized.sources
                set_title = f"{topic} ({doc_title})"
                saved_doc_id = doc_id
                set_desc = f"Generated via Momo Chat from {doc_title} ({count} items)"
            else:
                # Case 3: Pure AI Deck Generation authorized by user
                topic_title = topic.strip().title()
                source_evidence = f"""
Core study topic: {topic_title}.
Foundational definition of {topic_title} establishes the baseline principles and standard rules of the domain.
Structural architecture in {topic_title} organizes primary components, relationships, and operational boundaries.
Core mechanisms in {topic_title} govern how internal elements interact, transform, and exchange signals or data.
Primary functional classification in {topic_title} categorizes essential components based on their specialized roles.
Operational lifecycle in {topic_title} dictates sequence, initialization, state transitions, and termination stages.
Performance characteristics in {topic_title} analyze efficiency, resource consumption, and throughput limits.
Standard implementation patterns in {topic_title} provide validated methodologies for solving frequent practical problems.
Error handling and validation in {topic_title} prevent aberrant behavior, invalid inputs, and runtime anomalies.
Resource management in {topic_title} optimizes allocation, prevents leaks, and regulates internal capacity.
Diagnostic evaluation in {topic_title} identifies performance bottlenecks, structural defects, and degradation.
Regulatory feedback mechanisms in {topic_title} maintain equilibrium, stability, and adaptive control.
Comparative analysis in {topic_title} contrasts modern strategies with alternative and legacy paradigms.
Security and integrity standards in {topic_title} protect internal states from unauthorized interference or corruption.
Optimization algorithms in {topic_title} enhance efficiency, reduce execution latency, and eliminate bottlenecks.
High-yield exam principles in {topic_title} prioritize foundational terminology, direct causal relationships, and real-world synthesis.
"""
                sources_meta = [
                    {"source": "Momo AI Knowledge Base", "topic": topic_title, "page": i + 1, "section": f"{topic_title} Core Concepts"}
                    for i in range(15)
                ]
                set_title = f"{topic_title} (Momo AI Deck)"
                saved_doc_id = None
                set_desc = f"Curated study set on {topic_title} created by Momo AI ({count} items)"

            # 3. Model Generation
            gen_spec = {
                "topic": topic,
                "count": max(count + 6, int(count * 1.5)),
                "difficulty": difficulty,
                "question_types": question_types,
                "custom_instruction": custom_instruction
            }
            system_instruction = "You are an expert educational reviewer generator. Build high-yield, accurate questions and flashcards."
            raw_items = await ai_provider.generate_study_material(
                system_instruction=system_instruction,
                generation_spec=gen_spec,
                source_evidence=source_evidence,
                sources_metadata=sources_meta
            )

            # 4. Grounding validation & deduplication
            valid_items = grounding_validator.validate_and_deduplicate(
                raw_items=raw_items,
                target_count=count,
                allowed_types=question_types
            )

            if len(valid_items) < count and raw_items:
                # If deduplication dropped similar stems, backfill up to target count from available raw items
                seen_q = {it.get("question") for it in valid_items}
                for extra in raw_items:
                    if len(valid_items) >= count:
                        break
                    q_cand = extra.get("question")
                    if q_cand and q_cand not in seen_q:
                        valid_items.append(extra)
                        seen_q.add(q_cand)
                if len(valid_items) < count:
                    valid_items = raw_items[:count]

            # 5. Persist Study Set & Items
            study_set = await study_repo.create_study_set({
                "user_id": user_id,
                "document_id": saved_doc_id,
                "title": set_title,
                "description": set_desc,
                "generation_config": gen_spec,
                "generation_status": "COMPLETED",
                "item_count": len(valid_items)
            })

            await study_repo.save_study_items(
                set_id=study_set["id"],
                items=valid_items
            )

            return {
                "study_set_id": study_set["id"],
                "title": study_set["title"],
                "item_count": len(valid_items),
                "question_types": question_types,
                "document_id": saved_doc_id,
                "document_name": set_title,
                "status": "COMPLETED"
            }

        elif tool_name == "list_study_decks":
            sets = await study_repo.list_study_sets(user_id)
            summaries = [{
                "id": s.get("id"),
                "title": s.get("title"),
                "item_count": s.get("item_count", 0),
                "created_at": s.get("created_at")
            } for s in sets]
            return {"study_decks": summaries}

        elif tool_name == "generate_study_card":
            topic = arguments.get("topic") or "General Review"
            q = arguments.get("question") or f"What is the key principle of {topic}?"
            ans = arguments.get("answer") or f"{topic} operates as a foundational concept."
            exp = arguments.get("explanation") or f"Understanding {topic} strengthens recall and concept mastery."
            q_type = arguments.get("question_type") or "flashcard"
            diff = arguments.get("difficulty") or "medium"
            opts = arguments.get("options")
            diag_prompt = arguments.get("diagram_prompt") or f"{topic} scientific concept diagram"
            return {
                "topic": topic,
                "question": q,
                "answer": ans,
                "explanation": exp,
                "question_type": q_type,
                "difficulty": diff,
                "options": opts,
                "diagram_prompt": diag_prompt,
                "status": "READY_TO_IMPORT"
            }

        elif tool_name == "generate_diagram":
            topic = arguments.get("topic") or "Concept Diagram"
            requirements = arguments.get("requirements")
            diag_prompt = arguments.get("diagram_prompt") or f"{topic} educational scientific diagram"
            exp = arguments.get("explanation") or f"Visual concept diagram illustrating key structural principles and mechanisms of {topic}."

            # Retrieve evidence from uploaded notes if available to ground the diagram
            doc_context = None
            user_docs = await documents_repo.list_by_user(user_id)
            ready_docs = [d for d in user_docs if d.get("processing_status") == "READY"]
            if ready_docs:
                target_doc_id = context_document_id or ready_docs[0]["id"]
                retrieval_query = f"{topic} {requirements or ''}".strip()
                evidence_chunks = await retrieval_service.retrieve_evidence(
                    document_id=target_doc_id,
                    query=retrieval_query,
                    top_k=4
                )
                if evidence_chunks:
                    doc_context = "\n".join(c.get("content", "") for c in evidence_chunks)

            img_result = await image_service.generate_image(
                prompt=diag_prompt,
                topic=topic,
                context=doc_context,
                requirements=requirements
            )
            img_b64 = img_result.get("image_base64")
            spec = diagram_synthesizer.get_diagram_spec(
                topic=topic,
                prompt=diag_prompt,
                requirements=requirements,
                context=doc_context
            )

            return {
                "topic": topic,
                "question": f"Visual Concept Diagram: {topic}",
                "answer": f"Educational diagram illustrating core structures and flow of {topic}.",
                "explanation": exp,
                "question_type": "flashcard",
                "difficulty": "medium",
                "diagram_prompt": diag_prompt,
                "image_base64": img_b64,
                "elements": [{"label": e.label, "subtext": e.subtext, "badge": e.badge} for e in spec.elements],
                "key_takeaways": spec.key_takeaways,
                "status": "READY_TO_IMPORT"
            }

        elif tool_name == "get_learning_profile":
            profile = await learning_repo.get_learning_profile(user_id)
            return {"learning_profile": profile}

        elif tool_name == "generate_weakness_review":
            count = int(arguments.get("count") or 5)
            count = min(max(count, 3), 15)
            profile = await learning_repo.get_learning_profile(user_id)
            req_topic = arguments.get("topic")

            target_topic = req_topic
            if not target_topic:
                if profile.get("weak_topics"):
                    target_topic = profile["weak_topics"][0]
                elif profile.get("recent_missed_questions"):
                    target_topic = profile["recent_missed_questions"][0].get("topic") or "Reinforcement Review"
                else:
                    target_topic = "Adaptive Exam Review"

            # Check if user has uploaded notes covering this topic
            user_docs = await documents_repo.list_by_user(user_id)
            ready_docs = [d for d in user_docs if d.get("processing_status") == "READY"]

            source_evidence = ""
            sources_meta = []
            saved_doc_id = None
            doc_name = None

            if ready_docs:
                target_doc = ready_docs[0]
                saved_doc_id = target_doc["id"]
                doc_name = target_doc.get("original_filename", "Source Notes")
                evidence_chunks = await retrieval_service.retrieve_evidence(
                    document_id=saved_doc_id,
                    query=target_topic,
                    top_k=8
                )
                if evidence_chunks:
                    source_evidence = "\n\n".join(c.get("content", "") for c in evidence_chunks)
                    sources_meta = [{
                        "document_id": saved_doc_id,
                        "document_name": doc_name,
                        "page": c.get("page_start", 1),
                        "section": c.get("section") or target_topic,
                        "snippet": (c.get("content") or "")[:200]
                    } for c in evidence_chunks]

            gen_spec = {
                "topic": target_topic,
                "count": max(count + 2, 6),
                "difficulty": "medium",
                "question_types": ["flashcard", "multiple_choice"],
                "custom_instruction": f"Targeted remedial study set addressing student weaknesses and missed concepts in {target_topic}. Provide high-yield explanations with active recall prompts."
            }

            raw_items = await ai_provider.generate_study_material(
                system_instruction="You are an adaptive learning specialist. Build precise, high-yield practice items designed to correct misunderstandings and cement concept mastery.",
                generation_spec=gen_spec,
                source_evidence=source_evidence,
                sources_metadata=sources_meta
            )

            valid_items = grounding_validator.validate_and_deduplicate(
                raw_items=raw_items,
                target_count=count,
                allowed_types=["flashcard", "multiple_choice"]
            )
            if not valid_items and raw_items:
                valid_items = raw_items[:count]

            deck_title = f"{target_topic} (Targeted Weakness Review)"
            study_set = await study_repo.create_study_set({
                "user_id": user_id,
                "document_id": saved_doc_id,
                "title": deck_title,
                "description": f"Adaptive remedial study set created by Momo AI to reinforce {target_topic} ({len(valid_items)} items)",
                "generation_config": gen_spec,
                "generation_status": "COMPLETED",
                "item_count": len(valid_items)
            })

            await study_repo.save_study_items(
                set_id=study_set["id"],
                items=valid_items
            )

            return {
                "study_set_id": study_set["id"],
                "title": study_set["title"],
                "item_count": len(valid_items),
                "topic": target_topic,
                "document_id": saved_doc_id,
                "document_name": doc_name,
                "status": "COMPLETED",
                "is_weakness_review": True
            }

        return {"error": "UNKNOWN_TOOL", "message": f"Tool '{tool_name}' is not supported."}

    def _extract_diagram_topic(self, user_text: str, messages: List[Dict[str, Any]]) -> str:
        u_lower = user_text.lower()
        GENERIC_DIAGRAM_FILLERS = {
            "me", "us", "this", "it", "a", "an", "the", "image", "diagram", "image diagram",
            "generate", "make", "draw", "show", "just", "visual", "concept", "scientific",
            "educational", "an educational", "a diagram", "scientific diagram", "concept diagram",
            "illustration", "photo", "drawing", "picture", "detailed", "vector", "can", "you",
            "please", "could", "would", "i", "ask", "ai", "to", "or", "and", "but", "if", "so",
            "something", "anything", "study", "educational diagram", "an educational diagram", "study diagram",
            "chat", "agent", "cant", "can't", "provide", "give", "create", "want", "need",
            "know", "test", "example", "now", "here", "still", "not", "working", "unable",
            "create a image", "create an image", "provide the image", "provide an image",
            "with", "without", "in", "at", "by", "from", "on", "of", "about", "for", "as", "is", "are", "was", "were"
        }
        # 1. Prepositional match: "diagram of X", "image on Y"
        match = re.search(r"(?:of|on|about|for|illustrating|depicting|showing)\s+([a-zA-Z0-9\s,\-]+?)(?:from|\.|\?|$)", user_text, re.IGNORECASE)
        if match:
            cand = match.group(1).strip()
            # Strip leading articles or filler words from candidate topic
            cand = re.sub(r"^(?:an?\s+|the\s+|educational\s+|scientific\s+)+", "", cand, flags=re.IGNORECASE).strip()
            if cand.lower() not in GENERIC_DIAGRAM_FILLERS and len(cand) >= 3:
                return cand.title()

        # 2. Noise removal
        clean = re.sub(
            r"\b(image|diagram|generate|make|draw|show|me|us|a|an|the|just|visual|concept|scientific|educational|detailed|detail|illustration|photo|picture|drawing|please|can|could|you|would|i|ask|ai|to|or|and|but|if|so|of|on|about|for|cant|can't|provide|agent|chat|create|give|want|need|is|are|was|were|as|in|at|by|from|with|without|not|unable|explain|explaining|break|down|tell|walk|through|step|steps|more|key)\b",
            "",
            u_lower
        ).strip()
        clean = re.sub(r"[^\w\s]", " ", clean).strip()
        clean = re.sub(r"\s+", " ", clean)
        if clean and clean.lower() not in GENERIC_DIAGRAM_FILLERS and len(clean) >= 3:
            return clean.title()

        # 3. Check conversation history
        for prev_m in reversed(messages):
            c = prev_m.get("content", "")
            bold_m = re.search(r"\*\*([a-zA-Z0-9\s]{3,35}?)\*\*", c)
            if bold_m:
                cand_prev = bold_m.group(1).strip()
                if cand_prev.lower() not in GENERIC_DIAGRAM_FILLERS and len(cand_prev) >= 3:
                    return cand_prev.title()

        return "Binary Search Tree"

    async def send_message(
        self,
        session_id: str,
        user_id: str,
        user_content: str,
        document_id: Optional[str] = None
    ) -> ChatMessageResponse:
        # 1. Guardrail input validation (Prompt injection & safety check)
        guardrail_check = guardrails_service.validate_user_input(user_content)
        if not guardrail_check.passed:
            logger.warning(f"Guardrail intercepted input for user {user_id}. Category: {guardrail_check.flagged_category}")
            # Record user message
            await chat_repo.add_message(
                session_id=session_id,
                user_id=user_id,
                role="user",
                content=user_content
            )
            # Record assistant refusal
            refusal_content = guardrail_check.refusal_response or "I can only help with academic study materials."
            saved_msg = await chat_repo.add_message(
                session_id=session_id,
                user_id=user_id,
                role="assistant",
                content=refusal_content
            )
            return ChatMessageResponse(
                id=saved_msg["id"],
                session_id=session_id,
                user_id=user_id,
                role="assistant",
                content=refusal_content,
                citations=None,
                created_deck=None,
                study_card=None,
                quick_replies=None,
                tool_calls=None,
                created_at=saved_msg["created_at"]
            )

        # 2. Record user message
        await chat_repo.add_message(
            session_id=session_id,
            user_id=user_id,
            role="user",
            content=guardrail_check.sanitized_text
        )

        # 3. Get recent conversation history
        raw_msgs = await chat_repo.get_messages(session_id, user_id, limit=12)
        api_messages = [{"role": m["role"], "content": m["content"]} for m in raw_msgs]

        # 4. Check if user is asking to explain or break down an existing diagram
        user_lower = guardrail_check.sanitized_text.lower()
        explain_diagram_keywords = [
            "explain this diagram", "explain the diagram", "break down the diagram",
            "break down this diagram", "tell me about this diagram", "walk me through this diagram",
            "what does this diagram show", "explain the steps", "diagram in detail",
            "explain in detail", "break down the key steps", "tell me more about this diagram",
            "explain this", "explain the image", "break down the image"
        ]
        is_explain_request = any(k in user_lower for k in explain_diagram_keywords)

        if is_explain_request:
            exp_topic = self._extract_diagram_topic(guardrail_check.sanitized_text, api_messages)
            curated_spec = diagram_synthesizer.find_curated_spec(exp_topic, "")
            topic_label = curated_spec.title if curated_spec else exp_topic
            if curated_spec:
                elem_lines = []
                for el in curated_spec.elements:
                    badge_str = f" `[{el.badge}]`" if el.badge else ""
                    elem_lines.append(f"- **{el.label}**{badge_str}: {el.subtext}")
                takeaway_str = "\n".join(f"- {t}" for t in curated_spec.key_takeaways)
                exp_content = (
                    f"### In-Depth Breakdown: {curated_spec.title}\n\n"
                    f"**Core Mechanism & Architecture:**\n{curated_spec.subtitle}\n\n"
                    f"**Key Structural Components:**\n" + "\n".join(elem_lines) + "\n\n"
                    f"**High-Yield Exam Takeaways:**\n{takeaway_str}\n\n"
                    f"Would you like me to quiz you on this diagram or build a practice flashcard set?"
                )
            else:
                exp_content = (
                    f"### In-Depth Breakdown: {exp_topic}\n\n"
                    f"**1. Core Mechanism & Architecture:**\n"
                    f"{exp_topic} operates as a foundational mechanism, ensuring structural stability, high throughput, and reliable execution.\n\n"
                    f"**2. Key Structural Components & Flow:**\n"
                    f"The process initiates at the primary input stage, undergoes intermediate transformation, and yields a stabilized output governed by feedback controls.\n\n"
                    f"**3. High-Yield Exam Takeaways:**\n"
                    f"Questions on {exp_topic} typically focus on causal relationships and key algorithmic/physiological properties.\n\n"
                    f"Would you like to practice 5 questions on {exp_topic}?"
                )
            exp_content = guardrails_service.sanitize_model_output(exp_content)
            saved_msg = await chat_repo.add_message(
                session_id=session_id,
                user_id=user_id,
                role="assistant",
                content=exp_content,
                quick_replies=[f"Quiz me on {topic_label}", f"Create 10-card {topic_label} deck", "Show study sets"]
            )
            return ChatMessageResponse(
                id=saved_msg["id"],
                session_id=session_id,
                user_id=user_id,
                role="assistant",
                content=exp_content,
                citations=None,
                created_deck=None,
                study_card=None,
                quick_replies=[f"Quiz me on {topic_label}", f"Create 10-card {topic_label} deck", "Show study sets"],
                tool_calls=None,
                created_at=saved_msg["created_at"]
            )

        # 5. First AI Provider Turn
        ai_resp = await ai_provider.chat_agent(
            system_instruction=MOMO_SYSTEM_PROMPT,
            messages=api_messages,
            tools=CHAT_TOOLS
        )

        assistant_content = ai_resp.get("content") or ""
        tool_calls = ai_resp.get("tool_calls")

        # Guard: Check if user requests an image/diagram or if model replied with refusal to produce images
        has_visual_word = any(w in user_lower for w in ["image", "diagram", "picture", "illustration", "visual", "chart", "figure", "drawing"])
        has_action_word = any(w in user_lower for w in [
            "generate", "create", "make", "draw", "show", "provide", "give", "display",
            "render", "cant", "can't", "can", "need", "want", "ask", "produce"
        ])
        is_visual_request = (
            (has_visual_word and has_action_word) or
            ("generate a diagram" in user_lower or "draw a diagram" in user_lower or "make a diagram" in user_lower or "create a diagram" in user_lower or "diagram of" in user_lower or user_lower.strip() in {"diagram", "image diagram"}) or
            ("image" in user_lower and any(w in user_lower for w in ["can", "cant", "can't", "provide", "create", "generate", "show", "make", "need", "want", "draw"]))
        )
        has_image_refusal = any(p in assistant_content.lower() for p in [
            "cannot generate image", "cannot create image", "unable to create image",
            "cannot provide image", "unable to generate image", "cannot draw",
            "as an ai text", "i am an ai text", "don't have the ability to create image",
            "can't create image", "can't generate image", "can't provide image",
            "cannot produce image", "unable to produce image", "can't make image", "cannot make image",
            "don't have the capability to create image", "unable to generate diagram", "cannot create diagram"
        ])

        if (is_visual_request and not tool_calls) or has_image_refusal:
            logger.info("Enforcing visual diagram generation for visual request or model refusal")
            diag_topic = self._extract_diagram_topic(guardrail_check.sanitized_text, api_messages)
            tool_calls = [{
                "id": f"call-{uuid.uuid4()}",
                "type": "function",
                "function": {
                    "name": "generate_diagram",
                    "arguments": json.dumps({
                        "topic": diag_topic,
                        "requirements": guardrail_check.sanitized_text,
                        "diagram_prompt": f"2D educational scientific diagram of {diag_topic} with clear annotations and high clarity",
                        "explanation": f"Visual concept diagram illustrating key structural principles and mechanisms of {diag_topic}."
                    })
                }
            }]
            assistant_content = ""

        executed_tool_records: List[ToolCallRecord] = []
        collected_citations: List[CitationItem] = []
        created_deck_meta: Optional[CreatedDeckMetadata] = None
        study_card_meta: Optional[StudyCardMetadata] = None
        generated_image_b64: Optional[str] = None
        diagram_elements: Optional[List[Dict[str, Any]]] = None
        diagram_takeaways: Optional[List[str]] = None

        # 4. Agentic Tool Execution Loop if tools were requested
        if tool_calls:
            for tc in tool_calls:
                fn = tc.get("function", {})
                tool_name = fn.get("name", "")
                raw_args = fn.get("arguments", "{}")
                try:
                    args = json.loads(raw_args) if isinstance(raw_args, str) else raw_args
                except Exception:
                    args = {}

                tool_result = await self.execute_tool(
                    tool_name=tool_name,
                    arguments=args,
                    user_id=user_id,
                    context_document_id=document_id
                )

                executed_tool_records.append(ToolCallRecord(
                    tool_name=tool_name,
                    arguments=args,
                    result=tool_result
                ))

                # Extract citations if search_documents was executed
                if tool_name == "search_documents" and "citations" in tool_result:
                    for c in tool_result["citations"]:
                        collected_citations.append(CitationItem(
                            document_id=c.get("document_id") or "",
                            document_name=c.get("document_name") or "Document",
                            page_start=c.get("page_start"),
                            page_end=c.get("page_end"),
                            section=c.get("section"),
                            snippet=c.get("snippet") or ""
                        ))

                # Extract created deck if create_study_deck or generate_weakness_review was executed
                if tool_name in ("create_study_deck", "generate_weakness_review") and "study_set_id" in tool_result:
                    created_deck_meta = CreatedDeckMetadata(
                        study_set_id=tool_result["study_set_id"],
                        title=tool_result["title"],
                        item_count=tool_result["item_count"],
                        question_types=tool_result.get("question_types", ["flashcard", "multiple_choice"]),
                        status="COMPLETED"
                    )

                # Extract study card or diagram if generate_study_card or generate_diagram was executed
                if tool_name in ("generate_study_card", "generate_diagram") and "question" in tool_result:
                    study_card_meta = StudyCardMetadata(
                        question=tool_result["question"],
                        answer=tool_result["answer"],
                        explanation=tool_result.get("explanation"),
                        question_type=tool_result.get("question_type", "flashcard"),
                        options=tool_result.get("options"),
                        topic=tool_result.get("topic"),
                        difficulty=tool_result.get("difficulty", "medium"),
                        image_base64=tool_result.get("image_base64"),
                        diagram_prompt=tool_result.get("diagram_prompt"),
                        imported=False
                    )
                if tool_name == "generate_diagram" and "image_base64" in tool_result:
                    generated_image_b64 = tool_result.get("image_base64")
                    diagram_elements = tool_result.get("elements")
                    diagram_takeaways = tool_result.get("key_takeaways")

                # Sanitize tool result for LLM (never send massive base64 image strings to OpenRouter)
                tool_result_for_llm = dict(tool_result) if isinstance(tool_result, dict) else tool_result
                if isinstance(tool_result_for_llm, dict) and "image_base64" in tool_result_for_llm:
                    tool_result_for_llm = {k: ("<rendered_image_b64>" if k == "image_base64" else v) for k, v in tool_result_for_llm.items()}

                # Append tool result to dialogue
                api_messages.append({
                    "role": "assistant",
                    "content": assistant_content,
                    "tool_calls": [tc]
                })
                api_messages.append({
                    "role": "tool",
                    "tool_call_id": tc.get("id", str(uuid.uuid4())),
                    "name": tool_name,
                    "content": json.dumps(tool_result_for_llm)
                })

            # Second AI Provider Turn (synthesize tool result into final friendly answer)
            # If a diagram was generated, keep accompanying message concise and avoid redundant LLM latency.
            if generated_image_b64:
                top_name = study_card_meta.topic if study_card_meta else "Educational Diagram"
                assistant_content = f"Visual concept diagram: **{top_name}**"
                ai_resp["quick_replies"] = [
                    f"Explain this {top_name} diagram in detail",
                    f"Break down the key steps",
                    f"Quiz me on {top_name}"
                ]
            else:
                final_turn = await ai_provider.chat_agent(
                    system_instruction=MOMO_SYSTEM_PROMPT,
                    messages=api_messages,
                    tools=None
                )
                assistant_content = final_turn.get("content") or assistant_content
                if final_turn.get("quick_replies"):
                    ai_resp["quick_replies"] = final_turn.get("quick_replies")

        # 5. Extract quick replies and guarantee assistant_content is friendly and never empty
        collected_quick_replies: Optional[List[str]] = ai_resp.get("quick_replies")
        has_awaiting_source = False
        awaiting_topic = "this topic"

        for rec in executed_tool_records:
            if rec.tool_name == "create_study_deck" and isinstance(rec.result, dict):
                if rec.result.get("status") == "AWAITING_SOURCE_CHOICE":
                    has_awaiting_source = True
                    awaiting_topic = rec.result.get("topic") or "this topic"
                    collected_quick_replies = [f"Let Momo build {awaiting_topic} deck", "I'll upload notes"]

        if has_awaiting_source and (not assistant_content or "however" in assistant_content.lower() or "please upload" in assistant_content.lower()):
            assistant_content = (
                f"I'd love to build a study deck on **{awaiting_topic}** for you!\n\n"
                f"You don't have any uploaded documents for {awaiting_topic} in your Library yet.\n\n"
                f"**Would you like me to:**\n"
                f"- **Build it with Momo AI:** I'll generate a complete, high-yield practice deck covering {awaiting_topic} right away.\n"
                f"- **Upload course material:** If you have class slides or textbook notes you want me to ground this on, you can upload them first.\n\n"
                f"Should I go ahead and build it with Momo AI now?"
            )
        elif not assistant_content or not assistant_content.strip() or (generated_image_b64 and len(assistant_content) > 120):
            if generated_image_b64:
                top_name = study_card_meta.topic if study_card_meta else "Educational Diagram"
                assistant_content = f"Visual concept diagram: **{top_name}**"
                if not collected_quick_replies:
                    collected_quick_replies = [
                        f"Explain this {top_name} diagram in detail",
                        f"Break down the key steps",
                        f"Quiz me on {top_name}"
                    ]
            elif created_deck_meta:
                assistant_content = f"I've created your study deck **{created_deck_meta.title}** with {created_deck_meta.item_count} items! You can review the cards below or jump straight into studying."
            elif study_card_meta:
                if study_card_meta.image_base64:
                    assistant_content = f"Visual concept diagram: **{study_card_meta.topic or 'Educational Diagram'}**"
                    if not collected_quick_replies:
                        collected_quick_replies = [
                            f"Explain this {study_card_meta.topic or 'diagram'} in detail",
                            f"Break down the key steps",
                            f"Quiz me on {study_card_meta.topic or 'this diagram'}"
                        ]
                else:
                    assistant_content = f"Here is a study card on **{study_card_meta.topic or 'your topic'}**! You can review the prompt and tap **Import to Library** to save it to your study sets."
            elif collected_citations:
                top_c = collected_citations[0]
                assistant_content = f"Based on your notes in **{top_c.document_name}**:\n\n{top_c.snippet or 'Here is what was found in your study material.'}\n\nLet me know if you would like me to build a practice deck on this!"
            elif executed_tool_records:
                last_rec = executed_tool_records[-1]
                if last_rec.tool_name == "list_user_documents":
                    docs = last_rec.result.get("documents", [])
                    if docs:
                        lines = [f"- **{d.get('original_filename')}** ({d.get('page_count', 0)} pages)" for d in docs]
                        assistant_content = "Here are the study documents you have uploaded:\n\n" + "\n".join(lines) + "\n\nWould you like me to build a study deck from any of these?"
                    else:
                        assistant_content = "You haven't uploaded any study documents yet. Upload a PDF or lecture notes in the Library tab to get started!"
                elif last_rec.tool_name == "list_study_decks":
                    decks = last_rec.result.get("study_decks", [])
                    if decks:
                        lines = [f"- **{d.get('title')}** ({d.get('item_count', 0)} items)" for d in decks]
                        assistant_content = "Here are your current study sets:\n\n" + "\n".join(lines)
                    else:
                        assistant_content = "You don't have any study decks yet. Ask me to make one from your uploaded documents!"
                elif last_rec.tool_name == "get_learning_profile":
                    prof = last_rec.result.get("learning_profile", {})
                    mastery = prof.get("mastery_score", 0)
                    total = prof.get("total_reviews", 0)
                    weak = prof.get("weak_topics", [])
                    strong = prof.get("strong_topics", [])
                    rec = prof.get("recommended_focus", [])

                    lines = [f"### Your Learning Profile\n\n- **Overall Mastery:** {mastery}% across {total} review questions."]
                    if strong:
                        lines.append(f"- **Mastered Concepts:** {', '.join(strong)}")
                    if weak:
                        lines.append(f"- **Areas to Reinforce:** {', '.join(weak)}")
                    if rec:
                        lines.append(f"\n**Recommended Next Step:**\n- {rec[0]}")
                    assistant_content = "\n".join(lines)
                else:
                    assistant_content = "I completed the request for you! Feel free to ask more questions about your notes."
            else:
                assistant_content = "Hello! I'm Momo, your personal AI study companion. Ask me anything from your study notes or tell me to generate a practice deck!"

        # 6. Sanitize assistant message for sensitive credentials & save with metadata
        assistant_content = guardrails_service.sanitize_model_output(assistant_content)
        citations_data = [c.model_dump() for c in collected_citations] if collected_citations else None
        created_deck_data = created_deck_meta.model_dump() if created_deck_meta else None
        study_card_data = study_card_meta.model_dump() if study_card_meta else None
        tool_records_data = [t.model_dump() for t in executed_tool_records] if executed_tool_records else None
        final_image_b64 = generated_image_b64 or (study_card_meta.image_base64 if study_card_meta else None)

        saved_msg = await chat_repo.add_message(
            session_id=session_id,
            user_id=user_id,
            role="assistant",
            content=assistant_content,
            citations=citations_data,
            created_deck=created_deck_data,
            study_card=study_card_data,
            image_base64=final_image_b64,
            quick_replies=collected_quick_replies,
            tool_calls=tool_records_data
        )

        follow_up_response: Optional[ChatMessageResponse] = None
        if final_image_b64 and diagram_elements:
            raw_title = (study_card_meta.topic if study_card_meta else "Topic").title()
            if raw_title.lower() in {"an educational", "educational", "diagram", "concept", "something", "topic"}:
                top_title = "Educational Concept"
            else:
                top_title = raw_title

            detail_lines = [f"### {top_title} - Key Concepts & Details\n", "**Core Structural Breakdown:**"]
            for el in diagram_elements:
                lbl = el.get("label", "")
                clean_lbl = re.sub(r"^\d+\.\s*", "", lbl)
                sub = el.get("subtext", "")
                bdg = el.get("badge", "")
                bdg_tag = f" [{bdg}]" if bdg else ""
                detail_lines.append(f"- **{clean_lbl}**{bdg_tag}: {sub}")

            if diagram_takeaways:
                detail_lines.append("\n**High-Yield Exam Takeaways:**")
                for tk in diagram_takeaways:
                    detail_lines.append(f"- {tk}")

            follow_up_content = "\n".join(detail_lines)
            follow_up_content = guardrails_service.sanitize_model_output(follow_up_content)

            follow_up_saved = await chat_repo.add_message(
                session_id=session_id,
                user_id=user_id,
                role="assistant",
                content=follow_up_content,
                quick_replies=[
                    f"Build practice deck on {top_title}",
                    f"Quiz me on {top_title}"
                ]
            )
            follow_up_response = ChatMessageResponse(
                id=follow_up_saved["id"],
                session_id=session_id,
                user_id=user_id,
                role="assistant",
                content=follow_up_content,
                quick_replies=[
                    f"Build practice deck on {top_title}",
                    f"Quiz me on {top_title}"
                ],
                created_at=follow_up_saved["created_at"]
            )

        return ChatMessageResponse(
            id=saved_msg["id"],
            session_id=session_id,
            user_id=user_id,
            role="assistant",
            content=assistant_content,
            citations=collected_citations if collected_citations else None,
            created_deck=created_deck_meta,
            study_card=study_card_meta,
            image_base64=final_image_b64,
            quick_replies=collected_quick_replies,
            tool_calls=executed_tool_records if executed_tool_records else None,
            follow_up_message=follow_up_response,
            created_at=saved_msg["created_at"]
        )

chat_service = ChatService()
