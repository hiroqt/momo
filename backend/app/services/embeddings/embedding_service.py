from abc import ABC, abstractmethod
from typing import List
import hashlib
import numpy as np
import httpx
from app.config import settings
import logging

logger = logging.getLogger(__name__)

class EmbeddingProvider(ABC):
    @abstractmethod
    async def embed(self, texts: List[str]) -> List[List[float]]:
        """Generate embedding vectors for input texts."""
        pass

class LocalDeterministicEmbeddingProvider(EmbeddingProvider):
    """
    Generates fast 1536-dimensional normalized deterministic vectors
    based on word hashes for local development, offline runs, and unit tests.
    """
    def __init__(self, dimension: int = 1536):
        self.dimension = dimension

    async def embed(self, texts: List[str]) -> List[List[float]]:
        results: List[List[float]] = []
        for text in texts:
            vec = np.zeros(self.dimension, dtype=np.float32)
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

class OpenRouterEmbeddingProvider(EmbeddingProvider):
    def __init__(self, api_key: str, model: str = "text-embedding-3-small"):
        self.api_key = api_key
        self.model = model
        self.base_url = "https://openrouter.ai/api/v1/embeddings"

    async def embed(self, texts: List[str]) -> List[List[float]]:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": self.model,
            "input": texts
        }
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(self.base_url, headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()
            return [item["embedding"] for item in data["data"]]

class EmbeddingService:
    def __init__(self):
        if (
            settings.EMBEDDING_PROVIDER == "openrouter"
            and settings.OPENROUTER_API_KEY != "mock-openrouter-key"
        ):
            self.provider: EmbeddingProvider = OpenRouterEmbeddingProvider(
                api_key=settings.OPENROUTER_API_KEY
            )
        else:
            self.provider = LocalDeterministicEmbeddingProvider()

    async def embed_texts(self, texts: List[str]) -> List[List[float]]:
        if not texts:
            return []
        return await self.provider.embed(texts)

    async def embed_query(self, query: str) -> List[float]:
        res = await self.provider.embed([query])
        return res[0]

embedding_service = EmbeddingService()
