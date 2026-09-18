import re
from typing import List, Dict, Any, Tuple, Optional
import logging

logger = logging.getLogger(__name__)

class GroundingValidator:
    def __init__(self):
        pass

    def _normalize_text(self, text: str) -> str:
        # Strip punctuation, extra spaces, lowercase
        text = text.lower().strip()
        text = re.sub(r"[^\w\s]", "", text)
        return " ".join(text.split())

    def validate_and_deduplicate(
        self,
        raw_items: List[Dict[str, Any]],
        target_count: int,
        allowed_types: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        valid_items: List[Dict[str, Any]] = []
        seen_normalized_questions: set = set()
        normalized_allowed = [t.lower().strip() for t in allowed_types] if allowed_types else None

        for idx, item in enumerate(raw_items):
            # 1. Required fields
            question = item.get("question", "").strip()
            answer = item.get("answer", "").strip()
            item_type = item.get("type", "flashcard").lower().strip()

            # Strict format check: must be one of the requested study formats
            if normalized_allowed and item_type not in normalized_allowed:
                logger.warning(f"Item #{idx} type '{item_type}' not in allowed formats {normalized_allowed}. Dropping.")
                continue

            if not question or not answer:
                logger.warning(f"Item #{idx} missing question or answer. Dropping.")
                continue

            # Quality check: question and answer cannot be identical or mere echoes
            if self._normalize_text(question) == self._normalize_text(answer):
                logger.warning(f"Item #{idx} question and answer are identical. Dropping.")
                continue

            # Length validation: questions must be meaningful (>= 6 chars)
            if len(question) < 6 or len(answer) < 1:
                logger.warning(f"Item #{idx} question or answer too short. Dropping.")
                continue

            # 2. MCQ specific validation
            if item_type == "multiple_choice":
                options = item.get("options", [])
                if not isinstance(options, list) or len(options) < 2:
                    logger.warning(f"Item #{idx} MCQ has invalid options ({options}). Dropping.")
                    continue
                # Ensure answer exists in options or add it
                if answer not in options:
                    options.append(answer)
                    item["options"] = options

            # 3. Source grounding check
            source_meta = item.get("source_metadata", {})
            if not source_meta or not (source_meta.get("page") or source_meta.get("section")):
                logger.warning(f"Item #{idx} lacking source grounding attribution. Dropping.")
                continue

            # 4. Duplicate detection
            norm_q = self._normalize_text(question)
            if norm_q in seen_normalized_questions:
                logger.info(f"Duplicate question detected: '{question}'. Dropping.")
                continue

            seen_normalized_questions.add(norm_q)
            valid_items.append(item)

            if len(valid_items) >= target_count:
                break

        return valid_items

grounding_validator = GroundingValidator()
