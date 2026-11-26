import logging
import os
import time
from typing import List

import numpy as np
from google import genai
from google.genai import types

EMBEDDING_MODEL = "gemini-embedding-2"
BATCH_SIZE = 20

logger = logging.getLogger(__name__)


def get_gemini_client() -> genai.Client:
    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key or api_key == "MY_GEMINI_API_KEY":
        raise RuntimeError(
            "GEMINI_API_KEY is not configured on the server. "
            "Set GEMINI_API_KEY in the environment or Secrets panel."
        )
    return genai.Client(
        api_key=api_key,
        http_options={"headers": {"User-Agent": "aistudio-build"}},
    )


def _l2_normalize(vectors: np.ndarray) -> np.ndarray:
    norms = np.linalg.norm(vectors, axis=1, keepdims=True)
    norms = np.where(norms == 0, 1.0, norms)
    return (vectors / norms).astype("float32")


def _embed_with_retry(
    client: genai.Client,
    contents: List[types.Content],
    task_type: str,
    max_retries: int = 3,
) -> List[List[float]]:
    last_error: Exception | None = None
    for attempt in range(max_retries):
        try:
            response = client.models.embed_content(
                model=EMBEDDING_MODEL,
                contents=contents,
                config=types.EmbedContentConfig(task_type=task_type),
            )
            embeddings = response.embeddings or []
            vectors = [list(embedding.values or []) for embedding in embeddings]
            dimension = len(vectors[0]) if vectors else 0
            logger.info(
                "Gemini embedding response: inputs=%d embeddings=%d dimensions=%d task=%s",
                len(contents),
                len(vectors),
                dimension,
                task_type,
            )
            if len(vectors) != len(contents):
                raise RuntimeError(
                    f"Gemini returned {len(vectors)} embeddings for "
                    f"{len(contents)} input texts."
                )
            if not vectors or dimension == 0:
                raise RuntimeError("Gemini embedding API returned empty vectors.")
            if any(len(vector) != dimension for vector in vectors):
                raise RuntimeError("Gemini returned embeddings with inconsistent dimensions.")
            return vectors
        except Exception as exc:
            last_error = exc
            logger.exception(
                "Gemini embedding attempt %d/%d failed for task %s",
                attempt + 1,
                max_retries,
                task_type,
            )
            if attempt < max_retries - 1:
                time.sleep(1.5 * (2 ** attempt))
    raise RuntimeError(f"Failed to generate embeddings: {last_error}")


def _as_embedding_contents(texts: List[str]) -> List[types.Content]:
    return [
        types.Content(parts=[types.Part.from_text(text=text)])
        for text in texts
    ]


def embed_documents(texts: List[str]) -> np.ndarray:
    if not texts:
        return np.empty((0, 0), dtype="float32")

    client = get_gemini_client()
    all_vectors: List[List[float]] = []

    for start in range(0, len(texts), BATCH_SIZE):
        batch = texts[start : start + BATCH_SIZE]
        vectors = _embed_with_retry(
            client=client,
            contents=_as_embedding_contents(batch),
            task_type="RETRIEVAL_DOCUMENT",
        )
        all_vectors.extend(vectors)

    matrix = np.array(all_vectors, dtype="float32")
    logger.info(
        "Generated document embedding matrix: inputs=%d embeddings=%d dimensions=%d",
        len(texts),
        matrix.shape[0],
        matrix.shape[1],
    )
    return _l2_normalize(matrix)


def embed_query(query: str) -> np.ndarray:
    client = get_gemini_client()
    vectors = _embed_with_retry(
        client=client,
        contents=_as_embedding_contents([query]),
        task_type="RETRIEVAL_QUERY",
    )
    matrix = np.array(vectors, dtype="float32")
    return _l2_normalize(matrix)
