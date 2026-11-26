import io
import os
import re
from typing import List, Tuple

import pymupdf
from docx import Document

from models import PageContent

ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt"}
MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024  # 25 MB
LOGICAL_PAGE_WORD_LIMIT = 450


def sanitize_filename(filename: str) -> str:
    base = os.path.basename(filename or "uploaded_document")
    cleaned = re.sub(r"[^\w.\- ]+", "_", base).strip()
    return cleaned or "uploaded_document"


def validate_upload(filename: str, content_bytes: bytes) -> Tuple[str, str]:
    safe_name = sanitize_filename(filename)
    _, ext = os.path.splitext(safe_name.lower())
    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError(
            f"Unsupported file format '{ext or 'unknown'}'. Please upload a PDF, DOCX, or TXT file."
        )
    if not content_bytes:
        raise ValueError("The uploaded file is empty.")
    if len(content_bytes) > MAX_FILE_SIZE_BYTES:
        raise ValueError("File exceeds the 25 MB maximum upload size.")
    return safe_name, ext


def _normalize_whitespace(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _extract_pdf_pages(content_bytes: bytes) -> List[PageContent]:
    pages: List[PageContent] = []
    with pymupdf.open(stream=content_bytes, filetype="pdf") as doc:
        for page_idx in range(len(doc)):
            page = doc[page_idx]
            text = _normalize_whitespace(page.get_text("text"))
            if text:
                pages.append(PageContent(page_number=page_idx + 1, text=text))
    return pages


def _split_into_logical_pages(blocks: List[str]) -> List[PageContent]:
    pages: List[PageContent] = []
    current_blocks: List[str] = []
    current_words = 0
    page_num = 1

    for block in blocks:
        cleaned = _normalize_whitespace(block)
        if not cleaned:
            continue
        word_count = len(cleaned.split())
        if current_blocks and (current_words + word_count > LOGICAL_PAGE_WORD_LIMIT):
            pages.append(PageContent(page_number=page_num, text="\n\n".join(current_blocks)))
            page_num += 1
            current_blocks = [cleaned]
            current_words = word_count
        else:
            current_blocks.append(cleaned)
            current_words += word_count

    if current_blocks:
        pages.append(PageContent(page_number=page_num, text="\n\n".join(current_blocks)))

    return pages


def _extract_docx_pages(content_bytes: bytes) -> List[PageContent]:
    doc = Document(io.BytesIO(content_bytes))
    blocks: List[str] = []

    for para in doc.paragraphs:
        if para.text and para.text.strip():
            blocks.append(para.text.strip())

    for table in doc.tables:
        rows_text: List[str] = []
        for row in table.rows:
            cells = [cell.text.strip() for cell in row.cells if cell.text.strip()]
            if cells:
                rows_text.append(" | ".join(cells))
        if rows_text:
            blocks.append("\n".join(rows_text))

    return _split_into_logical_pages(blocks)


def _extract_txt_pages(content_bytes: bytes) -> List[PageContent]:
    decoded = ""
    for encoding in ("utf-8-sig", "utf-8", "cp1252", "latin-1"):
        try:
            decoded = content_bytes.decode(encoding)
            break
        except UnicodeDecodeError:
            continue

    if not decoded.strip():
        return []

    if "\f" in decoded:
        raw_pages = decoded.split("\f")
        pages: List[PageContent] = []
        for idx, raw_page in enumerate(raw_pages, start=1):
            cleaned = _normalize_whitespace(raw_page)
            if cleaned:
                pages.append(PageContent(page_number=idx, text=cleaned))
        if pages:
            return pages

    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", decoded) if p.strip()]
    if len(paragraphs) <= 1:
        paragraphs = [line.strip() for line in decoded.splitlines() if line.strip()]
    return _split_into_logical_pages(paragraphs)


def extract_document_pages(filename: str, content_bytes: bytes) -> Tuple[str, List[PageContent]]:
    safe_name, ext = validate_upload(filename, content_bytes)

    if ext == ".pdf":
        pages = _extract_pdf_pages(content_bytes)
    elif ext == ".docx":
        pages = _extract_docx_pages(content_bytes)
    elif ext == ".txt":
        pages = _extract_txt_pages(content_bytes)
    else:
        raise ValueError(f"Unsupported file extension: {ext}")

    if not pages:
        raise ValueError(
            "No readable text could be extracted from the uploaded document. "
            "If this is a scanned PDF without embedded text, please upload a text-searchable document."
        )

    return safe_name, pages
