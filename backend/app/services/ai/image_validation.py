from __future__ import annotations

import base64
import binascii
import io

from PIL import Image, UnidentifiedImageError

MAX_IMAGE_BYTES = 15 * 1024 * 1024
MAX_IMAGE_PIXELS = 16_000_000
IMAGE_FORMAT_MIME_TYPES = {"PNG": "image/png", "JPEG": "image/jpeg", "WEBP": "image/webp"}


def validate_base64_image(encoded: str, *, max_bytes: int = MAX_IMAGE_BYTES) -> str:
    """Validate encoded image bytes and return their MIME type."""
    try:
        image_bytes = base64.b64decode(encoded, validate=True)
        if len(image_bytes) > max_bytes:
            raise ValueError("Image exceeds allowed size")
        with Image.open(io.BytesIO(image_bytes)) as image:
            mime_type = IMAGE_FORMAT_MIME_TYPES.get(image.format or "")
            if mime_type is None or image.width * image.height > MAX_IMAGE_PIXELS:
                raise ValueError("Image format or dimensions are unsupported")
            image.verify()
            return mime_type
    except (binascii.Error, Image.DecompressionBombError, UnidentifiedImageError, OSError, SyntaxError) as exc:
        raise ValueError("Invalid image data") from exc
