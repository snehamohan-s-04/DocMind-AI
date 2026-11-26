import { Layers, Search } from 'lucide-react';
import type { RetrievedChunk } from '../types/rag';

interface RetrievedChunksPanelProps {
  chunks: RetrievedChunk[];
  isLoading: boolean;
  hasAsked: boolean;
  highlightedPage: number | null;
  onClearHighlight: () => void;
}

export function RetrievedChunksPanel({
  chunks,
  isLoading,
  hasAsked,
  highlightedPage,
  onClearHighlight,
}: RetrievedChunksPanelProps) {
  return (
    <section
      aria-labelledby="retrieved-chunks-heading"
      className="flex flex-col bg-white border border-slate-200 rounded-xl overflow-hidden"
    >
      <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
        <div>
          <h2 id="retrieved-chunks-heading" className="text-base font-semibold text-slate-900">
            02. Retrieved Chunks
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Top-5 FAISS cosine similarity matches
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {highlightedPage !== null && (
            <button
              type="button"
              onClick={onClearHighlight}
              className="text-xs font-medium text-blue-700 hover:text-blue-800 whitespace-nowrap shrink-0 cursor-pointer"
            >
              Show all ({chunks.length})
            </button>
          )}
          <span className="text-xs font-mono text-slate-500 tabular-nums whitespace-nowrap shrink-0">
            {chunks.length > 0 ? `${chunks.length} chunks` : 'Top 5'}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto max-h-[720px]">
        {isLoading ? (
          <div className="divide-y divide-slate-200">
            {[1, 2, 3, 4].map((idx) => (
              <div key={idx} className="p-6 space-y-3 animate-pulse">
                <div className="flex items-center justify-between gap-4">
                  <div className="h-3.5 w-44 bg-slate-200 rounded" />
                  <div className="h-3.5 w-20 bg-slate-200 rounded" />
                </div>
                <div className="h-3 w-full bg-slate-100 rounded" />
                <div className="h-3 w-11/12 bg-slate-100 rounded" />
                <div className="h-3 w-4/5 bg-slate-100 rounded" />
              </div>
            ))}
          </div>
        ) : chunks.length === 0 ? (
          <div className="h-full min-h-[360px] p-8 flex flex-col items-center justify-center text-center">
            <div className="w-11 h-11 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-500 mb-3.5">
              {hasAsked ? <Search className="w-5 h-5" /> : <Layers className="w-5 h-5" />}
            </div>
            <p className="text-sm font-medium text-slate-900">
              {hasAsked ? 'No matching chunks retrieved' : 'Retrieved evidence will appear here'}
            </p>
            <p className="text-xs text-slate-500 max-w-xs mt-1.5 leading-relaxed">
              {hasAsked
                ? 'Try rephrasing your question with terms present in the uploaded document.'
                : 'When you ask a question, DocMind AI embeds your query and retrieves the top 5 matching chunks from the FAISS index.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {chunks.map((chunk, index) => {
              const isHighlighted =
                highlightedPage !== null && chunk.page_number === highlightedPage;
              const similarityPct = Math.max(0, Math.min(100, Math.round(chunk.similarity_score * 100)));

              return (
                <article
                  key={`${chunk.chunk_id}-${index}`}
                  id={`chunk-${chunk.chunk_id}`}
                  className={`p-6 transition-colors ${
                    isHighlighted ? 'bg-blue-50/60' : 'bg-white hover:bg-slate-50/60'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-mono text-slate-600 tabular-nums">
                      <span className="font-semibold text-slate-900">{chunk.chunk_id}</span>
                      <span aria-hidden="true" className="text-slate-300">·</span>
                      <span>Page {chunk.page_number}</span>
                      <span aria-hidden="true" className="text-slate-300">·</span>
                      <span>{chunk.token_count} tokens</span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-mono font-medium text-slate-700 tabular-nums">
                        {chunk.similarity_score.toFixed(4)}
                      </span>
                      <div
                        className="w-14 h-1.5 bg-slate-100 rounded-full overflow-hidden"
                        title={`Cosine similarity: ${chunk.similarity_score.toFixed(4)}`}
                      >
                        <div
                          className="h-full bg-blue-700 rounded-full"
                          style={{ width: `${similarityPct}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap break-words">
                    {chunk.text}
                  </p>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
