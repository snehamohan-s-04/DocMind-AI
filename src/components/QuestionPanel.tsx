import React, { useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, FileText, Loader2, Send, Upload } from 'lucide-react';
import type { UploadResponse } from '../types/rag';

interface QuestionPanelProps {
  uploadedDoc: UploadResponse | null;
  isUploading: boolean;
  uploadError: string | null;
  question: string;
  onQuestionChange: (value: string) => void;
  onFileSelected: (file: File) => void;
  onAsk: () => void;
  isAsking: boolean;
  askError: string | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}

const ACCEPTED_TYPES = '.pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain';

export function QuestionPanel({
  uploadedDoc,
  isUploading,
  uploadError,
  question,
  onQuestionChange,
  onFileSelected,
  onAsk,
  isAsking,
  askError,
  fileInputRef,
}: QuestionPanelProps) {
  const [isDragging, setIsDragging] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      onFileSelected(file);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelected(file);
      e.target.value = '';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (uploadedDoc && question.trim() && !isAsking && !isUploading) {
        onAsk();
      }
    }
  };

  const canAsk = Boolean(uploadedDoc) && question.trim().length > 0 && !isAsking && !isUploading;

  return (
    <section
      aria-labelledby="question-panel-heading"
      className="flex flex-col bg-white border border-slate-200 rounded-xl overflow-hidden"
    >
      <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
        <div>
          <h2 id="question-panel-heading" className="text-base font-semibold text-slate-900">
            01. Document &amp; Question
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Upload a document and submit a query
          </p>
        </div>
        <span className="text-xs font-mono text-slate-500 tabular-nums whitespace-nowrap shrink-0">
          PDF · DOCX · TXT
        </span>
      </div>

      <div className="p-6 flex-1 flex flex-col gap-6">
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_TYPES}
            onChange={handleFileInputChange}
            className="hidden"
            aria-label="Upload PDF, DOCX, or TXT document"
          />

          <div
            role="button"
            tabIndex={0}
            onClick={() => !isUploading && fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ' ') && !isUploading) {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`group rounded-lg border border-dashed p-5 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 ${
              isDragging
                ? 'border-blue-700 bg-blue-50/50'
                : 'border-slate-300 bg-slate-50/60 hover:border-slate-400 hover:bg-slate-50'
            } ${isUploading ? 'pointer-events-none opacity-75' : ''}`}
          >
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-lg border border-slate-200 bg-white flex items-center justify-center shrink-0 text-slate-700">
                {isUploading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-blue-700" />
                ) : (
                  <Upload className="w-5 h-5" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900">
                  {isUploading ? 'Processing and indexing document…' : 'Drop a document here, or browse'}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {isUploading
                    ? 'Extracting text, creating ~600-token chunks, generating Gemini embeddings, and building the FAISS index.'
                    : 'Supports PDF (PyMuPDF), DOCX (python-docx), and TXT files up to 25 MB.'}
                </p>
              </div>
            </div>
          </div>

          {uploadError && (
            <div
              role="alert"
              className="mt-3 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-800"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
              <span>{uploadError}</span>
            </div>
          )}
        </div>

        <div className="border-t border-slate-200 pt-5">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs font-medium text-slate-500">Active Document</span>
            {uploadedDoc && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="text-xs font-medium text-blue-700 hover:text-blue-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
              >
                Replace file
              </button>
            )}
          </div>

          {uploadedDoc ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5">
              <div className="flex items-start gap-2.5">
                <FileText className="w-4 h-4 text-slate-700 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900 truncate" title={uploadedDoc.document_name}>
                    {uploadedDoc.document_name}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-mono text-slate-600 tabular-nums">
                    <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Indexed
                    </span>
                    <span aria-hidden="true" className="text-slate-300">·</span>
                    <span>{uploadedDoc.page_count} {uploadedDoc.page_count === 1 ? 'page' : 'pages'}</span>
                    <span aria-hidden="true" className="text-slate-300">·</span>
                    <span>{uploadedDoc.total_chunks} chunks</span>
                    <span aria-hidden="true" className="text-slate-300">·</span>
                    <span>{uploadedDoc.index_dimension}d FAISS</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-slate-200 bg-slate-50/40 p-3.5 text-xs text-slate-500">
              No document uploaded yet. Upload a PDF, DOCX, or TXT file to build the FAISS vector index.
            </div>
          )}
        </div>

        <form
          className="border-t border-slate-200 pt-5 flex-1 flex flex-col justify-between gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (canAsk) onAsk();
          }}
        >
          <div className="flex flex-col gap-2">
            <label htmlFor="question-input" className="text-sm font-medium text-slate-900">
              Ask a Question
            </label>
            <textarea
              ref={textareaRef}
              id="question-input"
              rows={5}
              value={question}
              onChange={(e) => onQuestionChange(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={!uploadedDoc || isUploading}
              placeholder={
                uploadedDoc
                  ? 'Ask a specific question grounded in the uploaded document…'
                  : 'Upload a document above to enable questions…'
              }
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-700/20 disabled:bg-slate-50 disabled:text-slate-400 resize-none leading-relaxed"
            />
            <p className="text-xs text-slate-500">
              Press Enter to ask, or Shift + Enter for a new line.
            </p>

            {askError && (
              <div
                role="alert"
                className="mt-1 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-800"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                <span>{askError}</span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end pt-1">
            <button
              type="submit"
              disabled={!canAsk}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2 disabled:bg-slate-200 disabled:text-slate-500 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0 cursor-pointer min-h-[40px]"
            >
              {isAsking ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Searching &amp; Answering…</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Ask</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
