"""PDF/text → cleaned pages → chunks. See docs/pdf-pipeline.md for the why.

Pure functions over data — no database, no HTTP — so this whole module is
unit-testable without any infrastructure.
"""

import io
import re
from dataclasses import dataclass

from pypdf import PdfReader

# All in "tokens", estimated as chars/4. These are starting values — tune
# them later by looking at real chunks.
TARGET_TOKENS = 650
OVERLAP_TOKENS = 100
MIN_CHUNK_TOKENS = 20

# A line must appear on at least this fraction of pages to count as a
# repeating header/footer.
REPEAT_LINE_THRESHOLD = 0.6


@dataclass
class PreparedChunk:
    index: int
    page_number: int  # page where the chunk starts
    content: str


class ExtractionError(Exception):
    """Raised when a file yields no usable text; message is user-facing."""


def _est_tokens(text: str) -> float:
    return len(text) / 4


def extract_pdf_pages(data: bytes) -> list[tuple[int, str]]:
    """Return [(page_number, raw_text), ...] for a PDF file."""
    try:
        reader = PdfReader(io.BytesIO(data))
    except Exception as exc:
        raise ExtractionError(f"Could not open PDF: {exc}") from exc

    pages = [(i + 1, page.extract_text() or "") for i, page in enumerate(reader.pages)]
    if not pages:
        raise ExtractionError("PDF has no pages")

    # Scanned PDFs are page images — no text layer to extract.
    total_chars = sum(len(text) for _, text in pages)
    if total_chars < 20 * len(pages):
        raise ExtractionError(
            "Almost no text could be extracted — this looks like a scanned PDF. "
            "Only digital PDFs (with selectable text) are supported."
        )
    return pages


def clean_pages(pages: list[tuple[int, str]]) -> list[tuple[int, str]]:
    """Normalize whitespace and strip repeating headers/footers.

    A line whose stripped form appears on most pages (e.g. a running book
    title) is furniture, not content. Pure page-number lines go too.
    """
    stripped_pages = [
        (no, [line.strip() for line in text.splitlines()]) for no, text in pages
    ]

    repeated: set[str] = set()
    if len(stripped_pages) >= 4:
        counts: dict[str, int] = {}
        for _, lines in stripped_pages:
            for line in set(l for l in lines if l):
                counts[line] = counts.get(line, 0) + 1
        repeated = {
            line
            for line, n in counts.items()
            if n / len(stripped_pages) >= REPEAT_LINE_THRESHOLD
        }

    page_number_re = re.compile(r"^(page\s+)?\d{1,4}(\s+of\s+\d{1,4})?$", re.IGNORECASE)

    cleaned = []
    for no, lines in stripped_pages:
        kept = [
            line
            for line in lines
            if line and line not in repeated and not page_number_re.match(line)
        ]
        cleaned.append((no, "\n".join(kept)))
    return cleaned


def _split_blocks(page_no: int, text: str) -> list[tuple[int, str]]:
    """Split page text into paragraph-ish blocks, force-splitting any block
    too large to ever fit in a chunk."""
    hard_limit = int(TARGET_TOKENS * 1.5 * 4)  # in characters
    blocks: list[tuple[int, str]] = []
    for raw in re.split(r"\n\s*\n", text):
        block = raw.strip()
        while len(block) > hard_limit:
            # cut at the last sentence end (or space) before the limit
            cut = max(block.rfind(". ", 0, hard_limit), block.rfind(" ", 0, hard_limit))
            if cut <= 0:
                cut = hard_limit
            blocks.append((page_no, block[: cut + 1].strip()))
            block = block[cut + 1 :].strip()
        if block:
            blocks.append((page_no, block))
    return blocks


def chunk_pages(pages: list[tuple[int, str]]) -> list[PreparedChunk]:
    """Accumulate blocks into ~TARGET_TOKENS chunks with overlap between
    consecutive chunks, tracking the page each chunk starts on."""
    blocks: list[tuple[int, str]] = []
    for page_no, text in pages:
        blocks.extend(_split_blocks(page_no, text))

    chunks: list[PreparedChunk] = []
    buf: list[str] = []
    buf_page: int | None = None
    buf_has_new_content = False  # False while buf holds only the overlap tail

    def flush(page_of_next: int) -> None:
        nonlocal buf, buf_page, buf_has_new_content
        content = "\n\n".join(buf).strip()
        chunks.append(PreparedChunk(len(chunks), buf_page or 1, content))
        tail = content[-OVERLAP_TOKENS * 4 :]
        buf, buf_page, buf_has_new_content = [tail], page_of_next, False

    for page_no, block in blocks:
        # If adding this block would blow well past the target, close the
        # current chunk first (only if it holds real content, not just the
        # overlap tail). Without this, page-sized blocks overshoot badly.
        projected = _est_tokens("\n\n".join([*buf, block]))
        if buf_has_new_content and projected > TARGET_TOKENS * 1.2:
            flush(page_of_next=page_no)
        if buf_page is None:
            buf_page = page_no
        buf.append(block)
        buf_has_new_content = True
        if _est_tokens("\n\n".join(buf)) >= TARGET_TOKENS:
            flush(page_of_next=page_no)

    # Flush the remainder — but only if it contains something beyond the
    # overlap tail, and isn't a meaningless crumb.
    remainder = "\n\n".join(buf).strip()
    if buf_has_new_content and _est_tokens(remainder) >= MIN_CHUNK_TOKENS:
        chunks.append(PreparedChunk(len(chunks), buf_page or 1, remainder))

    return chunks


def ingest_file(filename: str, data: bytes) -> tuple[int, list[PreparedChunk]]:
    """Full pipeline for one uploaded file → (page_count, chunks).

    Raises ExtractionError with a user-facing message on any failure.
    """
    lower = filename.lower()
    if lower.endswith(".pdf"):
        pages = extract_pdf_pages(data)
    elif lower.endswith((".txt", ".md")):
        text = data.decode("utf-8", errors="replace")
        pages = [(1, text)]  # plain text has no pages; call it all page 1
    else:
        raise ExtractionError("Unsupported file type — upload a .pdf, .txt, or .md file")

    pages = clean_pages(pages)
    chunks = chunk_pages(pages)
    if not chunks:
        raise ExtractionError("No usable text found in this file")
    return len(pages), chunks
