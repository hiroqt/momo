import re
from dataclasses import dataclass
from typing import Optional, List, Tuple
import logging

logger = logging.getLogger(__name__)

@dataclass
class GuardrailResult:
    passed: bool
    flagged_category: Optional[str] = None
    refusal_response: Optional[str] = None
    sanitized_text: str = ""

class AIGuardrailsService:
    """
    Enterprise-grade AI Guardrails for the AI Study Platform.
    Enforces:
    1. Prompt injection, jailbreak, and system prompt extraction defenses.
    2. Prohibited topic and safety policy enforcement (self-harm, explosives, malware, live cheating).
    3. Output scanning and credential/secret redaction before delivering to users.
    4. Structured isolation of untrusted user input and document evidence.
    """

    def __init__(self):
        # 1. Prompt injection / jailbreak patterns
        self._injection_patterns = [
            re.compile(r"ignore\s+(?:all|previous|prior|system)\s+instructions?", re.IGNORECASE),
            re.compile(r"disregard\s+(?:all|previous|prior|system)\s+instructions?", re.IGNORECASE),
            re.compile(r"bypass\s+(?:all\s+)?(?:safety|guardrails?|guidelines?|rules?)", re.IGNORECASE),
            re.compile(r"override\s+(?:system\s+)?(?:prompt|instructions?|rules?)", re.IGNORECASE),
            re.compile(r"\bDAN\s+mode\b", re.IGNORECASE),
            re.compile(r"\bdeveloper\s+mode\s+enabled\b", re.IGNORECASE),
            re.compile(r"\bact\s+as\s+an\s+unrestricted\b", re.IGNORECASE),
            re.compile(r"\bjailbreak\b", re.IGNORECASE),
            re.compile(r"reveal\s+(?:your\s+)?(?:internal\s+)?system\s+instructions?", re.IGNORECASE),
            re.compile(r"what\s+is\s+your\s+system\s+prompt", re.IGNORECASE),
            re.compile(r"repeat\s+(?:the\s+)?(?:text|words|prompt)\s+above\s+verbatim", re.IGNORECASE),
            re.compile(r"output\s+your\s+instructions\s+above", re.IGNORECASE),
            re.compile(r"print\s+(?:your\s+)?system\s+(?:prompt|message)", re.IGNORECASE),
            re.compile(r"show\s+me\s+the\s+initial\s+prompt", re.IGNORECASE),
        ]

        # 2. Harmful / dangerous topics
        self._harmful_patterns = [
            (
                "self_harm",
                re.compile(r"\b(?:how\s+to\s+(?:commit\s+suicide|kill\s+myself|hang\s+myself|cut\s+myself)|suicide\s+methods)\b", re.IGNORECASE),
                "I cannot assist with self-harm or suicide. If you or someone you know is struggling or in crisis, help is available. You can call or text 988 in the US/Canada or contact your local emergency services."
            ),
            (
                "weapons_explosives",
                re.compile(r"\b(?:how\s+to\s+make\s+(?:(?:a|an)\s+)?(?:bomb|pipe\s+bomb|explosive|molotov|poison|ricin|biological\s+weapon)|(?:pipe\s+bomb|make\s+a\s+bomb)|synthesize\s+(?:ricin|sarin|anthrax))\b", re.IGNORECASE),
                "I am Momo, your study buddy designed exclusively for academic and educational learning. I cannot assist with weapons, explosives, or hazardous materials."
            ),
            (
                "cyberattacks_malware",
                re.compile(r"\b(?:create|write|generate)\s+(?:(?:a\s+)?ransomware|(?:a\s+)?keylogger|(?:a\s+)?ddos\s+bot|(?:a\s+)?trojan\s+virus|malware\s+script)\b", re.IGNORECASE),
                "I cannot assist with writing malware, exploits, or malicious scripts. I can, however, explain defensive cybersecurity principles and secure coding concepts!"
            ),
            (
                "live_proctored_cheating",
                re.compile(r"\b(?:solve\s+this\s+(?:proctored|live)\s+(?:test|exam)\s+right\s+now|cheat\s+on\s+my\s+(?:proctored|online)\s+exam\s+now)\b", re.IGNORECASE),
                "I cannot take active proctored tests or assist with live exam cheating. I am here to help you study and understand the underlying concepts so you can succeed independently!"
            ),
            (
                "fake_citations_fabrication",
                re.compile(r"\b(?:invent|fabricate|make\s+up)\s+(?:fake\s+)?(?:citations?|quotes?|sources?|page\s+numbers?)\b", re.IGNORECASE),
                "I cannot fabricate fake citations or quotes. I only provide factually grounded answers from verified study materials and established academic knowledge."
            )
        ]

        # 3. Output credential leak patterns (for redaction and API key protection)
        self._credential_patterns = [
            (re.compile(r"nvapi-[a-zA-Z0-9_\-]{20,}", re.IGNORECASE), "[REDACTED_NVIDIA_KEY]"),
            (re.compile(r"sk-or-v1-[a-zA-Z0-9_\-]{32,}", re.IGNORECASE), "[REDACTED_OPENROUTER_KEY]"),
            (re.compile(r"sk-[a-zA-Z0-9_\-]{24,}", re.IGNORECASE), "[REDACTED_AI_API_KEY]"),
            (re.compile(r"AKIA[0-9A-Z]{16}"), "[REDACTED_AWS_KEY]"),
            (re.compile(r"sbp_[a-zA-Z0-9_\-]{20,}"), "[REDACTED_SUPABASE_KEY]"),
            (re.compile(r"eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}"), "[REDACTED_JWT_TOKEN]"),
            (re.compile(r"Bearer\s+[a-zA-Z0-9_\-\.]{24,}", re.IGNORECASE), "Bearer [REDACTED_BEARER_TOKEN]"),
            (re.compile(r"(?:OPENROUTER_API_KEY|AWS_SECRET_ACCESS_KEY|SUPABASE_SERVICE_ROLE_KEY|NVIDIA_API_KEY|SUPABASE_JWT_SECRET)\s*[:=]\s*[^\s]+", re.IGNORECASE), "[REDACTED_SECRET]"),
            (re.compile(r"(?i)(?:api[_-]?key|secret[_-]?key|access[_-]?token)\s*[:=]\s*['\"]?[a-zA-Z0-9_\-\.]{16,}['\"]?"), "[REDACTED_CREDENTIAL]"),
        ]

    def validate_user_input(self, text: str) -> GuardrailResult:
        """
        Validates user input against prompt injection and harmful content.
        Returns a GuardrailResult indicating pass/fail with safe refusal if flagged.
        """
        if not text or not text.strip():
            return GuardrailResult(passed=True, sanitized_text=text)

        cleaned = text.strip()

        # Check prompt injection attempts
        for pat in self._injection_patterns:
            if pat.search(cleaned):
                logger.warning(f"Guardrail triggered: prompt injection detected matching '{pat.pattern}'")
                return GuardrailResult(
                    passed=False,
                    flagged_category="prompt_injection",
                    refusal_response=(
                        "I'm Momo, your dedicated AI study companion! I stay focused strictly on helping you learn "
                        "academic concepts and study your coursework. Let's focus on your study materials!"
                    ),
                    sanitized_text=cleaned
                )

        # Check harmful/prohibited content
        for category, pat, refusal in self._harmful_patterns:
            if pat.search(cleaned):
                logger.warning(f"Guardrail triggered: prohibited topic '{category}' detected")
                return GuardrailResult(
                    passed=False,
                    flagged_category=category,
                    refusal_response=refusal,
                    sanitized_text=cleaned
                )

        # Sanitize zero-width characters or malicious control characters
        sanitized = re.sub(r"[\u200B-\u200D\uFEFF]", "", cleaned)

        return GuardrailResult(
            passed=True,
            sanitized_text=sanitized
        )

    def sanitize_model_output(self, text: str) -> str:
        """
        Scans model output and redacts accidental credential, secret, or PII leakage
        before delivering to the client.
        """
        if not text:
            return text

        result = text
        for pat, replacement in self._credential_patterns:
            if pat.search(result):
                logger.critical(f"Guardrail intercepted sensitive credential leak in model output! Redacting.")
                result = pat.sub(replacement, result)

        return result

    def redact_secrets(self, text: str) -> str:
        """Alias for sanitize_model_output to protect API keys and credentials."""
        return self.sanitize_model_output(text)

    def wrap_untrusted_input(self, user_content: str) -> str:
        """
        Wraps user query with structural XML boundary indicating to the model
        that the contents are untrusted data, not system instructions.
        """
        sanitized = user_content.replace("<user_query>", "").replace("</user_query>", "")
        return f"<user_query>\n{sanitized.strip()}\n</user_query>"

    def wrap_untrusted_evidence(self, evidence: str) -> str:
        """
        Wraps document evidence with structural XML boundary indicating to the model
        that the contents are reference evidence, not system instructions.
        """
        sanitized = evidence.replace("<source_evidence>", "").replace("</source_evidence>", "")
        return f"<source_evidence>\n{sanitized.strip()}\n</source_evidence>"

guardrails_service = AIGuardrailsService()
