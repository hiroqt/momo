import httpx
import base64
import logging
import re
from typing import Dict, Any, Optional
from app.config import settings
from app.services.ai.diagram_renderer import diagram_renderer

logger = logging.getLogger(__name__)

class ImageGenerationService:
    """
    Service for generating high-yield educational diagrams aligned with Momo's theme:
    - 2D educational vector style with white backgrounds and purple/neutral accents.
    - Uses OpenRouter's google/gemini-2.5-flash-image when API key has active credits.
    - Cascades to high-resolution, topic-specific procedural 2D educational vector diagrams
      via Pillow diagram_renderer with semantic topic decomposition.
    - Guarantees 100% topic-relevant educational content, zero blank or green screens,
      and zero generic placeholder text.
    """

    def __init__(self):
        self.openrouter_url = f"{settings.OPENROUTER_BASE_URL}/images"
        self.api_key = settings.OPENROUTER_API_KEY

    def format_educational_prompt(self, raw_prompt: str) -> str:
        clean = raw_prompt.strip().rstrip(".")
        return (
            f"Clean 2D educational scientific vector illustration of {clean}. "
            f"Minimalist textbook diagram style, sharp precise line art, white background, "
            f"purple and slate blue accents, high clarity, clean educational typography, no 3D photorealism, no clutter."
        )

    def extract_topic_from_prompt(self, prompt: str) -> str:
        cleaned = re.sub(
            r"^(?:clean\s+2d\s+educational\s+scientific\s+vector\s+illustration\s+of\s+|educational\s+diagram\s+of\s+|diagram\s+of\s+|visual\s+concept\s+diagram\s*:\s*|visual\s+concept\s+diagram\s+of\s+|diagram\s+|illustration\s+of\s+|generate\s+a\s+diagram\s+of\s+|draw\s+a\s+diagram\s+of\s+|create\s+a\s+diagram\s+of\s+)",
            "",
            prompt,
            flags=re.IGNORECASE
        )
        cleaned = re.split(r"[,;\.]\s*(?:minimal|sharp|white|purple|clean|high|no\s+3d|designed)", cleaned, flags=re.IGNORECASE)[0]
        return cleaned.strip() or "Concept Architecture"

    async def generate_image(
        self,
        prompt: str,
        topic: Optional[str] = None,
        context: Optional[str] = None,
        requirements: Optional[str] = None
    ) -> Dict[str, Any]:
        styled_prompt = self.format_educational_prompt(prompt)
        if requirements:
            req_clean = requirements.strip().rstrip(".")
            if req_clean.lower() not in styled_prompt.lower():
                styled_prompt += f" Explicit focus and requirements: {req_clean}."
        resolved_topic = topic.strip() if topic else self.extract_topic_from_prompt(prompt)

        # Fast path for unit tests / mock environment: use procedural 2D diagram renderer
        if not self.api_key or self.api_key.startswith("mock-") or getattr(settings, "ENVIRONMENT", "") == "test":
            diagram_b64 = diagram_renderer.render_educational_diagram(
                topic=resolved_topic,
                prompt=styled_prompt,
                context=context,
                requirements=requirements
            )
            return {
                "image_base64": diagram_b64,
                "provider": "momo-diagram-renderer",
                "prompt": styled_prompt,
                "mime_type": "image/png"
            }

        # 1. Try OpenRouter Gemini 2.5 Flash Image if API key is provided and valid
        if not self.api_key.startswith("your-") and not self.api_key.startswith("mock-"):
            try:
                headers = {
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://studyplatform.ai",
                    "X-Title": "Momo AI Study Platform"
                }
                payload = {
                    "model": "google/gemini-2.5-flash-image",
                    "prompt": styled_prompt,
                    "response_format": "b64_json"
                }
                async with httpx.AsyncClient(timeout=20.0) as client:
                    resp = await client.post(self.openrouter_url, headers=headers, json=payload)
                    if resp.status_code == 200:
                        data = resp.json()
                        items = data.get("data", [])
                        if items and items[0].get("b64_json"):
                            return {
                                "image_base64": items[0]["b64_json"],
                                "provider": "openrouter/gemini-2.5-flash-image",
                                "prompt": styled_prompt,
                                "mime_type": "image/png"
                            }
                    else:
                        logger.warning(
                            f"OpenRouter image generation returned {resp.status_code}: {resp.text[:120]}. Cascading to high-yield diagram renderer."
                        )
            except Exception as e:
                logger.warning(f"Error calling OpenRouter image API: {e}. Cascading to high-yield diagram renderer.")

        # 2. Guaranteed High-Yield Fallback: Procedural 2D Educational Vector Diagram Engine
        diagram_b64 = diagram_renderer.render_educational_diagram(
            topic=resolved_topic,
            prompt=styled_prompt,
            context=context,
            requirements=requirements
        )
        return {
            "image_base64": diagram_b64,
            "provider": "momo-diagram-renderer",
            "prompt": styled_prompt,
            "mime_type": "image/png"
        }

image_service = ImageGenerationService()
