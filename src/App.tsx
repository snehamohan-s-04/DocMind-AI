import { useEffect, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { ArchitectureDrawer } from './components/ArchitectureDrawer';
import { FinalAnswerPanel } from './components/FinalAnswerPanel';
import { QuestionPanel } from './components/QuestionPanel';
import { RetrievedChunksPanel } from './components/RetrievedChunksPanel';
import { askQuestion, fetchHealth, uploadDocument } from './services/api';
import type { AskResponse, HealthResponse, RetrievedChunk, UploadResponse } from './types/rag';

export default function App() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [uploadedDoc, setUploadedDoc] = useState<UploadResponse | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [question, setQuestion] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);

  const [retrievedChunks, setRetrievedChunks] = useState<RetrievedChunk[]>([]);
  const [answerResult, setAnswerResult] = useState<AskResponse | null>(null);
  const [hasAsked, setHasAsked] = useState(false);
  const [highlightedPage, setHighlightedPage] = useState<number | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    fetchHealth()
      .then((data) => setHealth(data))
      .catch(() => {
        // Backend may still be booting; individual requests report errors cleanly
      });
  }, []);

  const handleFileSelected = async (file: File) => {
    setUploadError(null);
    setAskError(null);
    setIsUploading(true);

    try {
      const result = await uploadDocument(file);
      setUploadedDoc(result);
      setRetrievedChunks([]);
      setAnswerResult(null);
      setHasAsked(false);
      setHighlightedPage(null);
      setQuestion('');

      fetchHealth()
        .then((data) => setHealth(data))
        .catch(() => {});
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to process uploaded document.';
      setUploadError(message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleAsk = async () => {
    const trimmed = question.trim();
    if (!trimmed || !uploadedDoc) return;

    setAskError(null);
    setIsAsking(true);
    setHasAsked(true);
    setHighlightedPage(null);

    try {
      const response = await askQuestion(trimmed, 5);
      setRetrievedChunks(response.retrieved_chunks);
      setAnswerResult(response);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate answer.';
      setAskError(message);
    } finally {
      setIsAsking(false);
    }
  };

  const handleSelectPage = (page: number) => {
    setHighlightedPage((prev) => (prev === page ? null : page));
    const matchingChunk = retrievedChunks.find((c) => c.page_number === page);
    if (matchingChunk) {
      const el = document.getElementById(`chunk-${matchingChunk.chunk_id}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-[1440px] mx-auto px-6 py-3.5 flex items-center justify-between gap-8">
          <a
            href="/"
            className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            DocMind AI
          </a>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <a
              href="#question-panel-heading"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Document
            </a>
            <a
              href="#retrieved-chunks-heading"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Retrieved Chunks
            </a>
            <a
              href="#final-answer-heading"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Final Answer
            </a>
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Pipeline
            </button>
          </nav>

          <div className="shrink-0">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50 min-h-[40px]"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Document</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1440px] w-full mx-auto px-6 py-6 flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-1">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
              Document Question-Answering Workspace
            </h1>
            <p className="text-sm text-slate-600 mt-1 max-w-2xl">
              Answers are synthesized strictly from the top 5 FAISS vector matches in your uploaded document.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-slate-500 tabular-nums shrink-0">
            <span>{health?.embedding_model || 'gemini-embedding-2'}</span>
            <span aria-hidden="true">·</span>
            <span>FAISS IndexFlatIP</span>
            <span aria-hidden="true">·</span>
            <span>{health?.generation_model || 'gemini-4-hydrogen'}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch flex-1">
          <div className="lg:col-span-4 flex flex-col">
            <QuestionPanel
              uploadedDoc={uploadedDoc}
              isUploading={isUploading}
              uploadError={uploadError}
              question={question}
              onQuestionChange={setQuestion}
              onFileSelected={handleFileSelected}
              onAsk={handleAsk}
              isAsking={isAsking}
              askError={askError}
              fileInputRef={fileInputRef}
            />
          </div>

          <div className="lg:col-span-4 flex flex-col">
            <RetrievedChunksPanel
              chunks={retrievedChunks}
              isLoading={isAsking}
              hasAsked={hasAsked}
              highlightedPage={highlightedPage}
              onClearHighlight={() => setHighlightedPage(null)}
            />
          </div>

          <div className="lg:col-span-4 flex flex-col">
            <FinalAnswerPanel
              result={answerResult}
              isLoading={isAsking}
              highlightedPage={highlightedPage}
              onSelectPage={handleSelectPage}
            />
          </div>
        </div>
      </main>

      <ArchitectureDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        health={health}
      />
    </div>
  );
}
