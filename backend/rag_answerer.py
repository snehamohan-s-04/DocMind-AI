import time
from typing import List, Tuple

from google.genai import types

from embeddings import get_gemini_client
from models import RetrievedChunk

GENERATION_MODEL = "gemini-4-hydrogen"

SYSTEM_INSTRUCTION = """You are DocMind AI, a strictly grounded document question-answering assistant.

Rules you MUST follow without exception:
1. Answer ONLY using facts explicitly stated in the provided Retrieved Document Context below.
2. NEVER use outside knowledge, assumptions, or unverified extrapolations.
3. If the retrieved context does not contain sufficient information to answer the question, respond clearly that the uploaded document does not provide sufficient information to answer this question, and do not guess.
4. Cite page numbers inline where applicable using the format (Page X) or (Pages X, Y).
5. Keep the answer concise, well-structured, and directly responsive to the user's question."""

INSUFFICIENT_MARKER = "does not provide sufficient information"


def _build_context_block(chunks: List[RetrievedChunk]) -> str:
    sections: List[str] = []
    for chunk in chunks:
        header = (
            f"[{chunk.chunk_id} | Document: {chunk.document_name} | "
            f"Page {chunk.page_number} | Similarity: {chunk.similarity_score:.4f}]"
        )
        sections.append(f"{header}\n{chunk.text}")
    return "\n\n---\n\n".join(sections)


def generate_grounded_answer(
    question: str,
    retrieved_chunks: List[RetrievedChunk],
) -> Tuple[str, List[int], bool]:
    if not retrieved_chunks:
        return (
            "The uploaded document does not provide sufficient information to answer this question.",
            [],
            False,
        )

    client = get_gemini_client()
    context_text = _build_context_block(retrieved_chunks)
    prompt = (
        "Retrieved Document Context:\n"
        f"{context_text}\n\n"
        "User Question:\n"
        f"{question}\n\n"
        "Instructions: Answer strictly from the Retrieved Document Context above. "
        "Include inline page citations like (Page N). If the context does not contain "
        "the answer, state clearly that the uploaded document does not provide sufficient information."
    )

    last_error: Exception | None = None
    answer_text = ""
    for attempt in range(3):
        try:
            response = client.models.generate_content(
                model=GENERATION_MODEL,
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=SYSTEM_INSTRUCTION,
                ),
            )
            answer_text = (response.text or "").strip()
            break
        except Exception as exc:
            last_error = exc
            if attempt < 2:
                time.sleep(1.5 * (2 ** attempt))
    else:
        raise RuntimeError(f"Gemini answer generation failed: {last_error}")

    if not answer_text:
        answer_text = "The uploaded document does not provide sufficient information to answer this question."

    lowered = answer_text.lower()
    sufficient_context = not (
        INSUFFICIENT_MARKER in lowered
        or "cannot be answered from the provided" in lowered
        or "not mentioned in the provided" in lowered
    )

    source_pages = sorted({chunk.page_number for chunk in retrieved_chunks}) if sufficient_context else []

    return answer_text, source_pages, sufficient_context
