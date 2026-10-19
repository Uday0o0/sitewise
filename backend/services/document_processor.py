"""Document processing service for text extraction and chunking.

Supports PDF, TXT, Markdown, and CSV files. Extracts text content
and splits it into overlapping chunks suitable for retrieval.
Preserves page numbers from PDFs and detects scanned PDFs requiring OCR.
"""

from __future__ import annotations
import csv
import io
import re
import hashlib
from typing import Optional


# Supported file types and their MIME mappings
SUPPORTED_TYPES = {
    ".pdf": "application/pdf",
    ".txt": "text/plain",
    ".md": "text/markdown",
    ".csv": "text/csv",
}

# Chunking configuration
DEFAULT_CHUNK_SIZE = 500  # approximate words per chunk
DEFAULT_CHUNK_OVERLAP = 50  # words of overlap between consecutive chunks
MIN_CHUNK_SIZE = 15  # minimum words to form a valid chunk


def get_file_type(filename: str) -> Optional[str]:
    """Return normalized extension if supported, else None."""
    lower = filename.lower()
    for ext in SUPPORTED_TYPES:
        if lower.endswith(ext):
            return ext
    return None


def compute_sha256(content: bytes) -> str:
    """Compute SHA-256 hash of raw file bytes."""
    return hashlib.sha256(content).hexdigest()


def extract_text_from_pdf(content: bytes) -> tuple[str, int, bool]:
    """Extract text from PDF bytes using pdfplumber.

    Returns:
        tuple of (full_text, page_count, requires_ocr)
    """
    try:
        import pdfplumber
    except ImportError:
        raise RuntimeError(
            "pdfplumber is required for PDF processing. "
            "Install it with: pip install pdfplumber"
        )

    text_parts: list[str] = []
    page_count = 0
    total_words = 0

    with pdfplumber.open(io.BytesIO(content)) as pdf:
        page_count = len(pdf.pages)
        for page_num, page in enumerate(pdf.pages, 1):
            page_text = page.extract_text() or ""
            page_cleaned = page_text.strip()
            page_chunk = []
            if page_cleaned:
                page_chunk.append(f"[Page {page_num}]\n{page_cleaned}")
                total_words += len(page_cleaned.split())

            # Also extract tables as structured text
            tables = page.extract_tables() or []
            for table_idx, table in enumerate(tables):
                if table:
                    table_text = _format_table(table)
                    if table_text.strip():
                        page_chunk.append(
                            f"[Page {page_num}, Table {table_idx + 1}]\n{table_text}"
                        )
                        total_words += len(table_text.split())

            if page_chunk:
                text_parts.append("\n\n".join(page_chunk))

    # Scanned PDF detection: has pages but no extractable text
    requires_ocr = page_count > 0 and total_words == 0
    full_text = "\n\n".join(text_parts) if text_parts else ""

    return full_text, page_count, requires_ocr


def _format_table(table: list[list]) -> str:
    """Format an extracted table into readable text."""
    rows = []
    for row in table:
        cells = [str(cell).strip() if cell is not None else "" for cell in row]
        rows.append(" | ".join(cells))
    return "\n".join(rows)


def extract_text_from_txt(content: bytes) -> str:
    """Extract text from plain text or markdown bytes."""
    try:
        return content.decode("utf-8")
    except UnicodeDecodeError:
        return content.decode("latin-1", errors="replace")


def extract_text_from_csv(content: bytes) -> str:
    """Extract text from CSV bytes, preserving structure."""
    try:
        text = content.decode("utf-8")
    except UnicodeDecodeError:
        text = content.decode("latin-1", errors="replace")

    lines: list[str] = []
    reader = csv.reader(io.StringIO(text))
    headers = None

    for row_idx, row in enumerate(reader):
        if row_idx == 0:
            headers = row
            lines.append("Headers: " + " | ".join(row))
        else:
            if headers:
                pairs = []
                for i, cell in enumerate(row):
                    header = headers[i] if i < len(headers) else f"Col{i}"
                    pairs.append(f"{header}: {cell}")
                lines.append(f"Row {row_idx}: " + " | ".join(pairs))
            else:
                lines.append(" | ".join(row))

    return "\n".join(lines)


def chunk_text(
    text: str,
    chunk_size: int = DEFAULT_CHUNK_SIZE,
    chunk_overlap: int = DEFAULT_CHUNK_OVERLAP,
) -> list[dict]:
    """Split text into overlapping chunks, tracking page numbers where present.

    Args:
        text: Full document text
        chunk_size: Target words per chunk
        chunk_overlap: Words of overlap between chunks

    Returns:
        List of dicts with 'index', 'content', 'word_count', 'page_number' keys
    """
    if not text or not text.strip():
        return []

    # Detect if document has page markers like [Page X]
    has_page_markers = bool(re.search(r"\[Page\s+(\d+)\]", text))

    if has_page_markers:
        # Split by page blocks
        page_blocks = re.split(r"(?=\[Page\s+\d+\])", text)
        chunks: list[dict] = []
        chunk_idx = 0

        for block in page_blocks:
            block = block.strip()
            if not block:
                continue

            page_match = re.match(r"\[Page\s+(\d+)\]", block)
            page_num = int(page_match.group(1)) if page_match else None

            words = block.split()
            if not words:
                continue

            if len(words) <= chunk_size:
                chunks.append({
                    "index": chunk_idx,
                    "content": block,
                    "word_count": len(words),
                    "page_number": page_num,
                })
                chunk_idx += 1
            else:
                # Split large page into multiple overlapping chunks
                start = 0
                while start < len(words):
                    end = min(start + chunk_size, len(words))
                    chunk_words = words[start:end]
                    content_str = " ".join(chunk_words)

                    # Re-prepend page tag if not present
                    if page_num and not content_str.startswith(f"[Page {page_num}]"):
                        content_str = f"[Page {page_num}] {content_str}"

                    chunks.append({
                        "index": chunk_idx,
                        "content": content_str,
                        "word_count": len(chunk_words),
                        "page_number": page_num,
                    })
                    chunk_idx += 1
                    step = max(chunk_size - chunk_overlap, 1)
                    start += step

        return chunks

    # Fallback standard chunking for TXT, MD, CSV without page markers
    paragraphs = re.split(r"\n\s*\n", text)
    all_words: list[str] = []
    for para in paragraphs:
        w = para.split()
        if w:
            all_words.extend(w)
            all_words.append("\n\n")

    if not all_words:
        return []

    chunks = []
    start = 0
    chunk_index = 0

    while start < len(all_words):
        end = min(start + chunk_size, len(all_words))
        chunk_words = all_words[start:end]
        while chunk_words and chunk_words[-1] == "\n\n":
            chunk_words.pop()

        if len(chunk_words) >= MIN_CHUNK_SIZE or chunk_index == 0:
            content = " ".join(chunk_words).replace(" \n\n ", "\n\n").replace(" \n\n", "\n\n").replace("\n\n ", "\n\n")
            chunks.append({
                "index": chunk_index,
                "content": content.strip(),
                "word_count": len(chunk_words),
                "page_number": None,
            })
            chunk_index += 1

        step = max(chunk_size - chunk_overlap, 1)
        start += step

    return chunks


def process_document(filename: str, content: bytes) -> dict:
    """Full document processing pipeline: extract text and chunk it.

    Args:
        filename: Original filename
        content: Raw file bytes

    Returns:
        Dict with 'full_text', 'chunks', 'word_count', 'page_count',
        'requires_ocr', 'sha256', 'file_type', 'file_size_bytes'
    """
    file_type = get_file_type(filename)
    if file_type is None:
        raise ValueError(
            f"Unsupported file type for '{filename}'. "
            f"Supported types: {', '.join(SUPPORTED_TYPES.keys())}"
        )

    sha256 = compute_sha256(content)
    page_count = 1
    requires_ocr = False

    if file_type == ".pdf":
        full_text, page_count, requires_ocr = extract_text_from_pdf(content)
    elif file_type in (".txt", ".md"):
        full_text = extract_text_from_txt(content)
    elif file_type == ".csv":
        full_text = extract_text_from_csv(content)
    else:
        raise ValueError(f"No extractor for file type: {file_type}")

    chunks = chunk_text(full_text)

    return {
        "full_text": full_text,
        "chunks": chunks,
        "word_count": len(full_text.split()),
        "page_count": page_count,
        "requires_ocr": requires_ocr,
        "sha256": sha256,
        "file_type": file_type,
        "file_size_bytes": len(content),
    }
