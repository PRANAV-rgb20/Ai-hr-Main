"""Local sentence-transformer embeddings — no API calls, runs entirely on device."""
import asyncio
import logging

import numpy as np

logger = logging.getLogger("hrms.ai.embeddings")

_model = None


def _load_model():
    global _model
    if _model is None:
        logger.info("Loading sentence-transformers model all-MiniLM-L6-v2…")
        from sentence_transformers import SentenceTransformer
        _model = SentenceTransformer("all-MiniLM-L6-v2")
        logger.info("Embedding model loaded")
    return _model


def _encode(text: str) -> list[float]:
    m = _load_model()
    return m.encode(text, normalize_embeddings=True).tolist()


async def get_embedding(text: str) -> list[float]:
    """Async wrapper — runs encoding in a thread pool to not block the event loop."""
    return await asyncio.to_thread(_encode, text)


def cosine_similarity(a: list[float], b: list[float]) -> float:
    va, vb = np.array(a), np.array(b)
    na, nb = np.linalg.norm(va), np.linalg.norm(vb)
    if na == 0 or nb == 0:
        return 0.0
    return float(np.dot(va, vb) / (na * nb))
