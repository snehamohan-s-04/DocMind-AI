from threading import RLock
from typing import List, Optional

import faiss
import numpy as np

from models import DocumentChunk, RetrievedChunk


class FAISSVectorStore:
    def __init__(self) -> None:
        self._lock = RLock()
        self._index: Optional[faiss.IndexFlatIP] = None
        self._chunks: List[DocumentChunk] = []
        self._document_name: Optional[str] = None
        self._dimension: int = 0

    @property
    def is_ready(self) -> bool:
        with self._lock:
            return self._index is not None and len(self._chunks) > 0

    @property
    def document_name(self) -> Optional[str]:
        with self._lock:
            return self._document_name

    @property
    def total_chunks(self) -> int:
        with self._lock:
            return len(self._chunks)

    @property
    def dimension(self) -> int:
        with self._lock:
            return self._dimension

    def build_index(
        self,
        document_name: str,
        chunks: List[DocumentChunk],
        embeddings: np.ndarray,
    ) -> int:
        if (
            not chunks
            or embeddings.ndim != 2
            or embeddings.shape[0] != len(chunks)
            or embeddings.shape[1] == 0
        ):
            embedding_count = embeddings.shape[0] if embeddings.ndim > 0 else 0
            raise ValueError(
                "Cannot build FAISS index: "
                f"received {len(chunks)} chunks and {embedding_count} embeddings "
                f"with shape {embeddings.shape}; counts must match and dimensions "
                "must be non-empty."
            )

        dimension = int(embeddings.shape[1])
        index = faiss.IndexFlatIP(dimension)
        index.add(np.ascontiguousarray(embeddings, dtype="float32"))

        with self._lock:
            self._index = index
            self._chunks = list(chunks)
            self._document_name = document_name
            self._dimension = dimension

        return dimension

    def search(self, query_embedding: np.ndarray, top_k: int = 5) -> List[RetrievedChunk]:
        with self._lock:
            if self._index is None or not self._chunks:
                raise RuntimeError("No document index is loaded. Please upload a document first.")

            k = min(top_k, len(self._chunks))
            query_vec = np.ascontiguousarray(query_embedding, dtype="float32")
            scores, indices = self._index.search(query_vec, k)

            results: List[RetrievedChunk] = []
            for score, idx in zip(scores[0], indices[0]):
                if idx < 0 or idx >= len(self._chunks):
                    continue
                chunk = self._chunks[int(idx)]
                # Clamp cosine similarity to [0.0, 1.0] for clean display while preserving order
                similarity = float(max(0.0, min(1.0, score)))
                results.append(
                    RetrievedChunk(
                        chunk_id=chunk.metadata.chunk_id,
                        document_name=chunk.metadata.document_name,
                        page_number=chunk.metadata.page_number,
                        chunk_index=chunk.metadata.chunk_index,
                        token_count=chunk.metadata.token_count,
                        similarity_score=round(similarity, 4),
                        text=chunk.text,
                    )
                )

            return results


vector_store = FAISSVectorStore()
