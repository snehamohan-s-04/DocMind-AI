from typing import List, Optional
from pydantic import BaseModel, Field


class PageContent(BaseModel):
    page_number: int
    text: str


class ChunkMetadata(BaseModel):
    chunk_id: str
    document_name: str
    page_number: int
    chunk_index: int
    token_count: int


class DocumentChunk(BaseModel):
    metadata: ChunkMetadata
    text: str


class RetrievedChunk(BaseModel):
    chunk_id: str
    document_name: str
    page_number: int
    chunk_index: int
    token_count: int
    similarity_score: float
    text: str


class UploadResponse(BaseModel):
    status: str
    document_name: str
    page_count: int
    total_chunks: int
    embedding_model: str
    index_dimension: int


class AskRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=4000)
    top_k: int = Field(default=5, ge=1, le=20)


class AskResponse(BaseModel):
    question: str
    answer: str
    retrieved_chunks: List[RetrievedChunk]
    source_pages: List[int]
    document_name: str
    sufficient_context: bool


class HealthResponse(BaseModel):
    status: str
    document_loaded: bool
    document_name: Optional[str] = None
    total_chunks: int = 0
    embedding_model: str
    generation_model: str
