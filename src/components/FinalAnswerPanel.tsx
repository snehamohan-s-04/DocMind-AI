import { useState } from 'react';
import { AlertTriangle, BookOpen, Check, Copy, Loader2, Sparkles } from 'lucide-react';
import type { AskResponse } from '../types/rag';

interface FinalAnswerPanelProps {
  result: AskResponse | null;
  isLoading: boolean;
  highlightedPage: number | null;
  onSelectPage: (page: number) => void;
}

export function FinalAnswerPanel({
  result,
  isLoading,
  highlightedPage,
  onSelectPage,
}: FinalAnswerPanelProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!result?.answer) return;
    try {
      await navigator.clipboard.writeText(result.answer);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Ignore clipboard failure in restricted contexts
    }
  };

  return (
    <section
      aria-labelledby="final-answer-heading"
      className="flex flex-col bg-white border border-slate-200 rounded-xl overflow-hidden"
    >
      <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
        <div>
          <h2 id="final-answer-heading" className="text-base font-semibold text-slate-900">
            03. Final Answer
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Grounded strictly in retrieved context
          </p>
        </div>

        {result && !isLoading && (
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-700" />
                <span className="text-emerald-700">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>
        )}
      </div>

      <div className="p-6 flex-1 flex flex-col">
        {isLoading ? (
          <div className="flex-1 min-h-[360px] flex flex-col items-center justify-center text-center px-4">
            <Loader2 className="w-7 h-7 animate-spin text-blue-700 mb-3.5" />
            <p className="text-sm font-medium text-slate-900">
              Generating grounded answer…
            </p>
            <p className="text-xs text-slate-500 mt-1.5 max-w-xs leading-relaxed">
              Searching FAISS vector index and synthesizing a response strictly from retrieved document chunks.
            </p>
          </div>
        ) : !result ? (
          <div className="flex-1 min-h-[360px] flex flex-col items-center justify-center text-center px-4">
            <div className="w-11 h-11 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-500 mb-3.5">
              <BookOpen className="w-5 h-5" />
            </div>
            <p className="text-sm font-medium text-slate-900">
              Answer will appear here
            </p>
            <p className="text-xs text-slate-500 max-w-xs mt-1.5 leading-relaxed">
              Responses are constrained to the uploaded document. If the text does not contain the answer, DocMind AI will inform you explicitly.
            </p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col justify-between gap-6">
            <div className="space-y-4">
              <div className="pb-3 border-b border-slate-200">
                <p className="text-xs font-medium text-slate-500">Question</p>
                <p className="text-sm font-medium text-slate-900 mt-1">{result.question}</p>
              </div>

              {!result.sufficient_context && (
                <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-700" />
                  <span>
                    Insufficient document evidence. The uploaded text does not directly substantiate an answer to this question.
                  </span>
                </div>
              )}

              <div className="text-[15px] text-slate-800 leading-relaxed whitespace-pre-wrap break-words">
                {result.answer}
              </div>
            </div>

            <div className="border-t border-slate-200 pt-4 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-slate-500">
                  Source Page References
                </span>
                <span className="text-xs font-mono text-slate-500 truncate max-w-[180px]" title={result.document_name}>
                  {result.document_name}
                </span>
              </div>

              {result.source_pages.length > 0 ? (
                <div className="flex flex-wrap items-center gap-2">
                  {result.source_pages.map((page) => {
                    const active = highlightedPage === page;
                    return (
                      <button
                        key={page}
                        type="button"
                        onClick={() => onSelectPage(page)}
                        className={`px-3 py-1.5 text-xs font-mono font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer tabular-nums ${
                          active
                            ? 'border-blue-700 bg-blue-700 text-white'
                            : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:text-slate-900'
                        }`}
                      >
                        Page {page}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-slate-500 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-slate-400" />
                  <span>No supporting source pages cited for this query.</span>
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
