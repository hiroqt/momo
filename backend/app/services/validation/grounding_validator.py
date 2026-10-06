"""Schema, provenance and deterministic evidence-support checks for study items.

Support checks are conservative lexical heuristics: an item is kept only when its
answer (and explanation, if any) is covered by the text of the exact owned chunk it
cites, with matching negation polarity. They reduce fabricated or contradicted
content but do not prove semantic truth; thresholds are provisional until a
labeled evaluation corpus is measured (AI-02). Uncertain items are rejected.
"""

import re
from collections.abc import Mapping
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, ValidationError, field_validator

StudyItemType = Literal[
    "flashcard",
    "multiple_choice",
    "true_false",
    "identification",
    "fill_in_the_blank",
    "glossary",
    "concept_outline",
    "cheat_sheet",
    "compare_contrast",
    "qa_study_sheet",
    "timeline_process",
    "summary",
    "qa",
    "explanation",
    "topic_explanation",
]

PROVENANCE_KEYS = ("document_id", "chunk_id", "source_id", "page", "section", "snippet")
DIFFICULTIES = frozenset({"easy", "medium", "hard"})

_STOPWORDS = frozenset(
    """a an the and or but if then than so of in on at to for from by with into onto over under
    as is are was were be been being am do does did done has have had having it its this that
    these those there their them they he she his her we our you your i me my which who whom whose
    what when where why how can could should would may might must shall will also such each other
    any all some most more many much very just only about via per vs versus etc using use used
    one two both either eg ie e g i e true false question answer explanation
    don doesn didn isn aren wasn weren won couldn shouldn wouldn hasn haven hadn""".split()
)
_NEGATION = re.compile(r"\b(?:not|no|never|none|cannot|neither|nor|without)\b|n['’]t\b", re.IGNORECASE)
_SENTENCE = re.compile(r"(?<=[.!?;])\s+|\n+")
_BLANK = re.compile(r"_{3,}")
_TF_PREFIX = re.compile(r"^\s*true\s+or\s+false\s*[:\-–]?\s*", re.IGNORECASE)


def _stem(token: str) -> str:
    if len(token) > 4 and token.endswith("ies"):
        return token[:-3] + "y"
    if len(token) > 4 and token.endswith("es") and not token.endswith("ses"):
        return token[:-2]
    if len(token) > 3 and token.endswith("s") and not token.endswith("ss"):
        return token[:-1]
    return token


def content_terms(text: str) -> set[str]:
    tokens = re.findall(r"\w+", text.casefold().replace("’", "'"))
    return {
        _stem(token)
        for token in tokens
        if token not in _STOPWORDS and (len(token) > 1 or token.isdigit()) and token != "t"
    }


def _coverage(claim: str, evidence_terms: set[str]) -> float:
    terms = content_terms(claim)
    if not terms:
        return 0.0
    return len(terms & evidence_terms) / len(terms)


def _negated(text: str) -> bool:
    return bool(_NEGATION.search(text))


class StudyItemCandidate(BaseModel):
    model_config = ConfigDict(strict=True, extra="allow")
    type: StudyItemType
    question: str
    answer: str
    explanation: str | None = None
    options: list[str] | None = None
    source_metadata: dict[str, Any]

    @field_validator("type")
    @classmethod
    def canonicalize_type(cls, value: str) -> str:
        return "topic_explanation" if value == "explanation" else value


class GroundingValidator:
    # Provisional thresholds; evaluate on labeled fixtures before relaxing (AI-02).
    SHORT_CLAIM_TERMS = 3
    ANSWER_MIN_COVERAGE = 0.75
    EXPLANATION_MIN_COVERAGE = 0.5
    MCQ_OPTION_COUNT = 4
    HINT_MAX_CHARS = 300

    def _normalize_text(self, text: str) -> str:
        return " ".join(re.sub(r"[^\w\s]", "", text.lower().strip()).split())

    def _structural(self, raw: Any, allowed: set[str]) -> StudyItemCandidate | None:
        try:
            item = StudyItemCandidate.model_validate(raw)
        except ValidationError:
            return None
        question, answer = item.question.strip(), item.answer.strip()
        if not question or not answer or (allowed and item.type not in allowed):
            return None
        if self._normalize_text(question) == self._normalize_text(answer):
            return None
        if len(question) < (2 if item.type in {"glossary", "cheat_sheet"} else 6):
            return None
        options = item.options
        if item.type == "multiple_choice":
            # Exactly four distinct non-empty choices with one exact answer; never repaired.
            if (
                not options
                or len(options) != self.MCQ_OPTION_COUNT
                or any(not option.strip() for option in options)
                or len({self._normalize_text(option) for option in options}) != len(options)
                or answer not in options
            ):
                return None
        if item.type == "true_false":
            if answer.casefold() not in {"true", "false"}:
                return None
            if options is not None and [o.casefold() for o in options] != ["true", "false"]:
                return None
        if item.type == "fill_in_the_blank" and not _BLANK.search(question):
            return None
        metadata = item.source_metadata
        if not metadata or not (metadata.get("page") or metadata.get("section")):
            return None
        return item

    def validate_structure(self, raw: dict[str, Any], allowed_types: list[str] | None = None) -> bool:
        """Schema/format checks only; provenance and support are checked by callers."""
        allowed = {"topic_explanation" if t == "explanation" else t for t in allowed_types or []}
        return self._structural(raw, allowed) is not None

    def _supported_claim(self, claim: str, sentences: list[str], evidence_terms: set[str], minimum: float) -> bool:
        if _coverage(claim, evidence_terms) < minimum:
            return False
        claim_terms = content_terms(claim)
        # Polarity must agree with the evidence sentence that best covers the claim.
        best = max(sentences, key=lambda s: len(claim_terms & content_terms(s)), default="")
        return _negated(best) == _negated(claim)

    def _supported(self, item: StudyItemCandidate, evidence: str) -> bool:
        evidence_terms = content_terms(evidence)
        sentences = [s for s in _SENTENCE.split(evidence) if s.strip()]
        if not evidence_terms or not sentences:
            return False
        question, answer = item.question.strip(), item.answer.strip()

        if item.type == "true_false":
            claim = _TF_PREFIX.sub("", question)
            if _coverage(claim, evidence_terms) < self.ANSWER_MIN_COVERAGE:
                return False
            claim_terms = content_terms(claim)
            best = max(sentences, key=lambda s: len(claim_terms & content_terms(s)))
            agrees = _negated(best) == _negated(claim)
            # "True" needs agreeing polarity; "False" must be a polarity contradiction.
            if agrees != (answer.casefold() == "true"):
                return False
        elif item.type == "fill_in_the_blank":
            filled = _BLANK.sub(answer, question)
            if not self._supported_claim(filled, sentences, evidence_terms, self.ANSWER_MIN_COVERAGE):
                return False
        else:
            answer_terms = content_terms(answer)
            if not answer_terms:
                return False
            if len(answer_terms) <= self.SHORT_CLAIM_TERMS:
                # Short terms must appear verbatim (by term) in the cited evidence, and the
                # question+answer relation must not contradict it.
                if not answer_terms <= evidence_terms:
                    return False
                claim_terms = content_terms(f"{question} {answer}")
                best = max(sentences, key=lambda s: len(claim_terms & content_terms(s)))
                if _negated(best) != _negated(f"{question} {answer}"):
                    return False
            else:
                answer_sentences = [s for s in _SENTENCE.split(answer) if content_terms(s)]
                if _coverage(answer, evidence_terms) < self.ANSWER_MIN_COVERAGE:
                    return False
                for sentence in answer_sentences:
                    claim_terms = content_terms(sentence)
                    best = max(sentences, key=lambda s: len(claim_terms & content_terms(s)))
                    if _negated(best) != _negated(sentence):
                        return False

        explanation = (item.explanation or "").strip()
        if explanation and not self._supported_claim(
            explanation, sentences, evidence_terms, self.EXPLANATION_MIN_COVERAGE
        ):
            return False
        return True

    def validate_and_deduplicate(
        self,
        raw_items: list[dict[str, Any]],
        target_count: int,
        allowed_types: list[str] | None = None,
        *,
        trusted_sources: list[dict[str, Any]],
        evidence: Mapping[str, str] | None = None,
    ) -> list[dict[str, Any]]:
        """Keep only items bound to a trusted owned source and supported by its text.

        ``trusted_sources`` must come from owner-scoped retrieval; model-supplied
        attribution is never trusted. ``evidence`` maps chunk_id to the full chunk
        text; when absent, the shorter stored snippet is used (stricter).
        """
        if target_count <= 0 or not isinstance(raw_items, list) or not trusted_sources:
            return []
        normalized_allowed = {
            "topic_explanation" if value == "explanation" else value
            for value in allowed_types or []
        }
        evidence = evidence or {}
        valid, seen = [], set()
        for raw in raw_items:
            item = self._structural(raw, normalized_allowed)
            if item is None:
                continue
            normalized = self._normalize_text(item.question)
            if normalized in seen:
                continue
            metadata = item.source_metadata
            match = next(
                (
                    source
                    for source in trusted_sources
                    if source.get("document_id")
                    and all(metadata.get(key) == source.get(key) for key in PROVENANCE_KEYS)
                ),
                None,
            )
            if match is None:
                continue
            chunk_text = evidence.get(str(match.get("chunk_id"))) or match.get("snippet") or ""
            if not isinstance(chunk_text, str) or not self._supported(item, chunk_text):
                continue
            difficulty = raw.get("difficulty", "medium")
            if difficulty not in DIFFICULTIES:
                continue
            seen.add(normalized)
            # Whitelisted output: model-chosen ids, images, refs or other keys never
            # reach persistence. Provenance is the trusted retrieved copy.
            output: dict[str, Any] = {
                "type": item.type,
                "question": item.question.strip(),
                "answer": item.answer.strip(),
                "difficulty": difficulty,
                "source_metadata": dict(match),
            }
            if item.explanation is not None:
                output["explanation"] = item.explanation.strip()
            if item.options is not None:
                output["options"] = list(item.options)
            hint = raw.get("hint")
            if isinstance(hint, str) and hint.strip() and len(hint) <= self.HINT_MAX_CHARS:
                output["hint"] = hint.strip()
            valid.append(output)
            if len(valid) >= target_count:
                break
        return valid


grounding_validator = GroundingValidator()
