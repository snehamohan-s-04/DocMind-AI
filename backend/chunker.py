import re
from typing import List

from models import ChunkMetadata, DocumentChunk, PageContent

try:
    import tiktoken
    _ENCODER = tiktoken.get_encoding("cl100k_base")
except Exception:
    _ENCODER = None

TARGET_CHUNK_TOKENS = 600
OVERLAP_TOKENS = 100


def count_tokens(text: str) -> int:
    if _ENCODER is not None:
        return len(_ENCODER.encode(text))
    # Fallback approximation if tokenizer cache is unavailable
    words = re.findall(r"\S+", text)
    return max(1, int(len(words) * 1.3))


def _tokenize(text: str) -> List[int] | List[str]:
    if _ENCODER is not None:
        return _ENCODER.encode(text)
    return re.findall(r"\S+|\n", text)


def _detokenize(tokens: List[int] | List[str]) -> str:
    if _ENCODER is not None:
        return _ENCODER.decode(tokens)  # type: ignore[arg-type]
    return " ".join(tokens).replace(" \n ", "\n").strip()  # type: ignore[arg-type]


def _chunk_page_text(
    page_text: str,
    target_tokens: int = TARGET_CHUNK_TOKENS,
    overlap_tokens: int = OVERLAP_TOKENS,
) -> List[str]:
    tokens = _tokenize(page_text)
    if not tokens:
        return []

    if len(tokens) <= target_tokens:
        return [page_text.strip()]

    chunks: List[str] = []
    step = max(1, target_tokens - overlap_tokens)
    start = 0

    while start < len(tokens):
        end = min(len(tokens), start + target_tokens)
        chunk_text = _detokenize(tokens[start:end]).strip()

        # Trim partial edge words when slicing sub-word tokens mid-stream
        if start > 0 and chunk_text and not chunk_text[0].isalnum():
            chunk_text = chunk_text.lstrip()

        if chunk_text:
            chunks.append(chunk_text)

        if end >= len(tokens):
            break
        start += step

    return chunks


def chunk_document_pages(
    document_name: str,
    pages: List[PageContent],
    target_tokens: int = TARGET_CHUNK_TOKENS,
    overlap_tokens: int = OVERLAP_TOKENS,
) -> List[DocumentChunk]:
    all_chunks: List[DocumentChunk] = []
    chunk_counter = 1

    for page in pages:
        page_chunks = _chunk_page_text(
            page.text,
            target_tokens=target_tokens,
            overlap_tokens=overlap_tokens,
        )
        for text in page_chunks:
            chunk_id = f"chunk-{chunk_counter:03d}"
            token_len = count_tokens(text)
            metadata = ChunkMetadata(
                chunk_id=chunk_id,
                document_name=document_name,
                page_number=page.page_number,
                chunk_index=chunk_counter - 1,
                token_count=token_len,
            )
            all_chunks.append(DocumentChunk(metadata=metadata, text=text))
            chunk_counter += 1

    return all_chunks
