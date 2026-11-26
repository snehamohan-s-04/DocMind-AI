import logging
import os
from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from chunker import chunk_document_pages
from document_processor import extract_document_pages
from embeddings import EMBEDDING_MODEL, embed_documents, embed_query
from models import AskRequest, AskResponse, HealthResponse, UploadResponse
from rag_answerer import GENERATION_MODEL, generate_grounded_answer
from vector_store import vector_store

load_dotenv()

logger = logging.getLogger(__name__)

app = FastAPI(
    title="DocMind AI RAG Backend",
    description="Document question-answering API powered by PyMuPDF, python-docx, FAISS, and Gemini.",
    version="1.0.0",
)

allowed_origins = os.environ.get("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in allowed_origins if origin.strip()],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse)
def health_check() -> HealthResponse:
    return HealthResponse(
        status="ok",
        document_loaded=vector_store.is_ready,
        document_name=vector_store.document_name,
        total_chunks=vector_store.total_chunks,
        embedding_model=EMBEDDING_MODEL,
        generation_model=GENERATION_MODEL,
    )


@app.post("/upload", response_model=UploadResponse)
async def upload_document(file: UploadFile = File(...)) -> UploadResponse:
    try:
        content_bytes = await file.read()
        document_name, pages = extract_document_pages(file.filename or "document", content_bytes)
        extracted_text_length = sum(len(page.text) for page in pages)
        logger.info(
            "Extracted document text: document=%s characters=%d pages=%d",
            document_name,
            extracted_text_length,
            len(pages),
        )

        chunks = chunk_document_pages(document_name, pages)
        logger.info("Chunked document: document=%s chunks=%d", document_name, len(chunks))
        if not chunks:
            raise ValueError("Document chunking produced zero chunks.")

        texts = [chunk.text for chunk in chunks]
        try:
            embeddings = embed_documents(texts)
        except Exception:
            logger.exception(
                "Embedding generation failed: document=%s chunks=%d",
                document_name,
                len(chunks),
            )
            raise

        embedding_count = embeddings.shape[0] if embeddings.ndim > 0 else 0
        embedding_dimensions = embeddings.shape[1] if embeddings.ndim > 1 else 0
        logger.info(
            "Document embedding result: document=%s chunks=%d embeddings=%d dimensions=%d",
            document_name,
            len(chunks),
            embedding_count,
            embedding_dimensions,
        )
        dimension = vector_store.build_index(document_name, chunks, embeddings)

        return UploadResponse(
            status="indexed",
            document_name=document_name,
            page_count=len(pages),
            total_chunks=len(chunks),
            embedding_model=EMBEDDING_MODEL,
            index_dimension=dimension,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Document processing failed: {exc}") from exc


@app.post("/ask", response_model=AskResponse)
def ask_question(payload: AskRequest) -> AskResponse:
    question = payload.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    if not vector_store.is_ready or not vector_store.document_name:
        raise HTTPException(
            status_code=400,
            detail="No document has been indexed yet. Please upload a PDF, DOCX, or TXT file first.",
        )

    try:
        query_vector = embed_query(question)
        retrieved_chunks = vector_store.search(query_vector, top_k=payload.top_k)
        answer, source_pages, sufficient_context = generate_grounded_answer(
            question=question,
            retrieved_chunks=retrieved_chunks,
        )

        return AskResponse(
            question=question,
            answer=answer,
            retrieved_chunks=retrieved_chunks,
            source_pages=source_pages,
            document_name=vector_store.document_name,
            sufficient_context=sufficient_context,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Question answering failed: {exc}") from exc


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("FASTAPI_PORT", "8000"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
