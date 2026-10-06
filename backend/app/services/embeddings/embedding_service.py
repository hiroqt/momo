import hashlib
import logging
from abc import ABC, abstractmethod

import httpx
import numpy as np

from app.config import is_placeholder, settings

logger = logging.getLogger(__name__)

class EmbeddingProvider(ABC):
    @abstractmethod
    async def embed(self, texts: list[str]) -> list[list[float]]:
        """Generate embedding vectors for input texts."""
        pass

class LocalDeterministicEmbeddingProvider(EmbeddingProvider):
    """
    Generates fast 1536-dimensional normalized deterministic vectors
    based on word hashes for local development, offline runs, and unit tests.
    """
    def __init__(self, dimension: int = 1536):
        self.dimension = dimension

    async def embed(self, texts: list[str]) -> list[list[float]]:
        results: list[list[float]] = []
        for text in texts:
            vec: np.ndarray = np.zeros(self.dimension, dtype=np.float32)
            words = text.lower().split()
            if not words:
                words = ["empty"]
            for word in words:
                h = int(hashlib.md5(word.encode("utf-8")).hexdigest(), 16)
                idx = h % self.dimension
                vec[idx] += 1.0
            norm = np.linalg.norm(vec)
            if norm > 0:
                vec = vec / norm
            results.append(vec.tolist())
        return results

EMBEDDING_DIMENSION = 1536  # Must match document_chunks.embedding VECTOR(1536).


class EmbeddingUnavailableError(RuntimeError):
    """Controlled embedding failure with no raw provider details."""


class OpenRouterEmbeddingProvider(EmbeddingProvider):
    BATCH_SIZE = 64
    TIMEOUT_SECONDS = 30.0

    def __init__(self, api_key: str, model: str):
        self.api_key = api_key
        self.model = model
        self.base_url = f"{settings.OPENROUTER_BASE_URL}/embeddings"

    async def _embed_batch(self, client: httpx.AsyncClient, texts: list[str]) -> list[list[float]]:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        payload = {"model": self.model, "input": texts}
        try:
            resp = await client.post(self.base_url, headers=headers, json=payload)
            if resp.status_code != 200:
                logger.warning("Embedding provider returned HTTP %s", resp.status_code)
                raise EmbeddingUnavailableError("Embedding provider unavailable")
            data = resp.json()
        except EmbeddingUnavailableError:
            raise
        except Exception as exc:  # noqa: BLE001 - provider boundary; log class only
            logger.warning("Embedding request failed (%s)", type(exc).__name__)
            raise EmbeddingUnavailableError("Embedding provider unavailable") from None
        rows = data.get("data", []) if isinstance(data, dict) else None
        if not isinstance(rows, list) or len(rows) != len(texts):
            raise ValueError("Invalid embedding count")
        if any(not isinstance(row, dict) or type(row.get("index")) is not int for row in rows):
            raise ValueError("Invalid embedding indices")
        rows = sorted(rows, key=lambda row: row["index"])
        if [row["index"] for row in rows] != list(range(len(texts))):
            raise ValueError("Invalid embedding order")
        vectors = [row.get("embedding") for row in rows]
        validate_vectors(vectors, len(texts))
        return vectors

    async def embed(self, texts: list[str]) -> list[list[float]]:
        vectors: list[list[float]] = []
        async with httpx.AsyncClient(timeout=self.TIMEOUT_SECONDS) as client:
            for start in range(0, len(texts), self.BATCH_SIZE):
                vectors.extend(await self._embed_batch(client, texts[start:start + self.BATCH_SIZE]))
        return vectors

def validate_vectors(vectors, count):
    if not isinstance(vectors, list) or len(vectors) != count:
        raise ValueError("Invalid embedding count")
    for vector in vectors:
        if not isinstance(vector, list) or len(vector) != EMBEDDING_DIMENSION:
            raise ValueError("Invalid embedding dimension")
        if any(type(value) not in {int, float} or not np.isfinite(value) for value in vector):
            raise ValueError("Invalid embedding values")


class EmbeddingService:
    def __init__(self):
        if settings.EMBEDDING_PROVIDER == "openrouter" and not is_placeholder(settings.OPENROUTER_API_KEY):
            # Honor the configured model; never silently substitute another index space.
            self.provider: EmbeddingProvider = OpenRouterEmbeddingProvider(
                api_key=settings.OPENROUTER_API_KEY, model=settings.EMBEDDING_MODEL
            )
        elif settings.EMBEDDING_PROVIDER == "local" and settings.ENVIRONMENT in {"development", "test"}:
            # Word-hash vectors are a development/test stand-in, not semantic retrieval.
            self.provider = LocalDeterministicEmbeddingProvider()
        else:
            raise ValueError("Embedding provider is not configured")

    async def embed_texts(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        vectors = await self.provider.embed(texts)
        validate_vectors(vectors, len(texts))
        return vectors

    async def embed_query(self, query: str) -> list[float]:
        res = await self.embed_texts([query])
        return res[0]

embedding_service = EmbeddingService()
