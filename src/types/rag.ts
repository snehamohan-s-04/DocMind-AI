export interface RetrievedChunk {
  chunk_id: string;
  document_name: string;
  page_number: number;
  chunk_index: number;
  token_count: number;
  similarity_score: number;
  text: string;
}

export interface UploadResponse {
  status: string;
  document_name: string;
  page_count: number;
  total_chunks: number;
  embedding_model: string;
  index_dimension: number;
}

export interface AskResponse {
  question: string;
  answer: string;
  retrieved_chunks: RetrievedChunk[];
  source_pages: number[];
  document_name: string;
  sufficient_context: boolean;
}

export interface HealthResponse {
  status: string;
  document_loaded: boolean;
  document_name: string | null;
  total_chunks: number;
  embedding_model: string;
  generation_model: string;
}
