import { X } from 'lucide-react';
import type { HealthResponse } from '../types/rag';

interface ArchitectureDrawerProps {
  open: boolean;
  onClose: () => void;
  health: HealthResponse | null;
}

export function ArchitectureDrawer({ open, onClose, health }: ArchitectureDrawerProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-900/30"
      role="dialog"
      aria-modal="true"
      aria-labelledby="architecture-drawer-title"
    >
      <div className="w-full max-w-md bg-white h-full border-l border-slate-200 flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <h2 id="architecture-drawer-title" className="text-base font-semibold text-slate-900">
            RAG Pipeline Architecture
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close architecture panel"
            className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-700">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 mb-2">Retrieval Pipeline</h3>
            <ol className="space-y-2.5 text-xs text-slate-600 leading-relaxed list-decimal list-inside">
              <li>
                <span className="font-medium text-slate-900">Document Extraction:</span> PDF pages via PyMuPDF, DOCX via python-docx, and plain UTF-8 TXT.
              </li>
              <li>
                <span className="font-medium text-slate-900">Token Chunking:</span> ~600-token chunks with 100-token overlap, preserving document name, chunk ID, and page number.
              </li>
              <li>
                <span className="font-medium text-slate-900">Vector Indexing:</span> L2-normalized embeddings via{' '}
                <code className="font-mono text-slate-900">{health?.embedding_model || 'gemini-embedding-2'}</code> indexed in FAISS <code className="font-mono text-slate-900">IndexFlatIP</code>.
              </li>
              <li>
                <span className="font-medium text-slate-900">Top-5 Grounded Generation:</span> Top 5 cosine-similarity chunks are passed to{' '}
                <code className="font-mono text-slate-900">{health?.generation_model || 'gemini-4-hydrogen'}</code> with strict context-only instructions.
              </li>
            </ol>
          </div>

          <div className="border-t border-slate-200 pt-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-2">Backend Endpoints</h3>
            <dl className="space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                <dt className="text-slate-900 font-medium">POST /upload</dt>
                <dd className="text-slate-500">Extract, chunk, embed, index</dd>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                <dt className="text-slate-900 font-medium">POST /ask</dt>
                <dd className="text-slate-500">FAISS top-5 search + Gemini answer</dd>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <dt className="text-slate-900 font-medium">GET /health</dt>
                <dd className="text-slate-500">Index &amp; model configuration</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
