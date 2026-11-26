# DocMind AI

DocMind AI is a full-stack Retrieval-Augmented Generation (RAG) document question-answering application. Users upload a PDF, DOCX, or TXT document, ask natural-language questions, inspect the top-5 retrieved chunks ranked by cosine similarity in FAISS, and read a strictly grounded Gemini answer with page references.

## Architecture

```
Document Upload (PDF / DOCX / TXT)
  -> Text Extraction (PyMuPDF / python-docx / UTF-8 text)
  -> Token Chunking (~600 tokens, 100-token overlap, page metadata)
  -> Gemini Embeddings (gemini-embedding-2, L2-normalized)
  -> FAISS Vector Index (IndexFlatIP cosine similarity)
  -> Top-5 Chunk Retrieval
  -> Grounded Gemini Generation (gemini-4-hydrogen)
```

## Project Structure

```
.
├── backend/
│   ├── main.py                # FastAPI app & /health, /upload, /ask endpoints
│   ├── document_processor.py  # PDF (PyMuPDF), DOCX (python-docx), TXT extraction
│   ├── chunker.py             # ~600-token chunker with 100-token overlap
│   ├── embeddings.py          # Gemini API embedding client (gemini-embedding-2)
│   ├── vector_store.py        # FAISS IndexFlatIP indexing & top-k similarity search
│   ├── rag_answerer.py        # Grounded Gemini answer generation (gemini-4-hydrogen)
│   ├── models.py              # Pydantic request/response schemas
│   └── requirements.txt       # Python backend dependencies
├── src/
│   ├── App.tsx                # Three-panel DocMind AI React workspace
│   ├── components/            # Modular UI panels (Question, Retrieved Chunks, Answer)
│   ├── types/rag.ts           # Shared TypeScript interfaces
│   └── index.css              # Tailwind CSS v4 styling & typography
├── server.ts                  # Express bridge spawning FastAPI + serving Vite/dist
├── package.json
└── .env.example
```

## Setup Instructions

### 1. Environment Variables

Set `GEMINI_API_KEY` on the server (never in client-side environment variables):

```bash
export GEMINI_API_KEY="your-gemini-api-key"
```

### 2. Python Backend Setup

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
```

To run the FastAPI backend standalone on port `8000`:

```bash
uvicorn main:app --app-dir backend --host 0.0.0.0 --port 8000
```

### 3. Frontend & Full-Stack Dev Server

```bash
npm install
npm run dev
```

The unified server runs on port `3000`, automatically launching the Python FastAPI RAG backend and serving the React frontend.

## API Endpoints

- `GET /health` — Reports backend readiness, loaded document name, chunk count, and active Gemini models.
- `POST /upload` — Accepts multipart `file` (`.pdf`, `.docx`, `.txt`), extracts pages, chunks text (~600 tokens with overlap), embeds with Gemini, and builds the FAISS index.
- `POST /ask` — Accepts `{ "question": "...", "top_k": 5 }`, embeds the query, retrieves the top 5 FAISS chunks, and returns the grounded Gemini answer, chunk metadata, and source page numbers.
