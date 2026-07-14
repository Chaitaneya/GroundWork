# PDF → Chunks → Embeddings pipeline

How an uploaded PDF becomes searchable, citable chunks. This runs at upload time (Phase 2 builds steps 1–3; Phase 4 adds step 4).

```
PDF file ──► extract text per page ──► clean ──► chunk (with overlap) ──► embed ──► rows in document_chunks
```

## 1. Extraction (pypdf)

A PDF is not a text file — it's a layout format: positioned glyphs on pages. `pypdf` reconstructs reading-order text per page:

```python
from pypdf import PdfReader

reader = PdfReader(file)
pages = [(i + 1, page.extract_text() or "") for i, page in enumerate(reader.pages)]
```

Keep the page number with the text — it flows all the way through to the citations users see.

Known failure modes (document, don't solve, in v1):
- **Scanned PDFs** are images; `extract_text()` returns "". Detect this (near-empty text with nonzero pages) and mark the document `failed` with a clear error. OCR is out of scope.
- Multi-column layouts, equations, and tables can extract in mangled order. Acceptable for v1; PyMuPDF is the upgrade path if quality is consistently bad.

## 2. Cleaning

Cheap normalization only:
- collapse runs of whitespace, normalize newlines
- drop repeated headers/footers (lines that appear on nearly every page)
- strip standalone page-number lines

Don't over-engineer this step; garbage-tolerant chunking beats a perfect cleaner.

## 3. Chunking

**Why chunk at all:** one embedding vector represents one "meaning". Embedding a whole chapter smears many ideas into one vector — retrieval becomes mush. Embedding single sentences loses context. The sweet spot for study material is a few paragraphs.

**Parameters:** target ~500–800 tokens per chunk, ~100 tokens of overlap. Approximate tokens as `len(text) / 4` — exact token counts don't matter here.

**Why overlap:** a fact that straddles a chunk boundary would otherwise be split across two chunks, each with half the story. Overlap makes each boundary region appear whole in at least one chunk.

**Strategy — paragraph-aware accumulation** (not blind fixed-size slicing):

```python
def chunk_pages(pages, target_tokens=650, overlap_tokens=100):
    """pages: list of (page_number, text). Yields (chunk_index, page_number, content)."""
    def tokens(s): return len(s) / 4

    chunks, buf, buf_page, idx = [], [], None, 0
    for page_no, text in pages:
        for para in text.split("\n\n"):
            para = para.strip()
            if not para:
                continue
            if buf_page is None:
                buf_page = page_no          # page where this chunk starts
            buf.append(para)
            if tokens(" ".join(buf)) >= target_tokens:
                content = " ".join(buf)
                chunks.append((idx, buf_page, content)); idx += 1
                # seed next chunk with the tail of this one (the overlap)
                tail = content[-int(overlap_tokens * 4):]
                buf, buf_page = [tail], page_no
    if buf and tokens(" ".join(buf)) > 50:   # flush remainder, skip crumbs
        chunks.append((idx, buf_page, " ".join(buf)))
    return chunks
```

(Illustrative — the real implementation gets unit tests, and paragraphs longer than the target get force-split.)

Each chunk is stored as a `document_chunks` row: `document_id, chunk_index, page_number, content, embedding`.

## 4. Embedding

Each chunk's text → Gemini embedding model → a 768-dim float vector stored in the pgvector column. Texts with similar meaning land near each other in that vector space, so later:

```sql
SELECT id, content, page_number
FROM document_chunks
WHERE document_id = ANY(:topic_doc_ids)
ORDER BY embedding <=> :query_embedding    -- pgvector cosine distance
LIMIT 8;
```

…returns the 8 chunks most semantically related to the query (e.g. the topic name + description), even with zero keyword overlap. That result set is exactly what gets pasted into the generation prompt — and exactly what generated items cite.

## Design rules

- Chunking params (`target_tokens`, `overlap`) live in config, not scattered constants — you *will* tune them.
- Chunk at upload time, once. Retrieval must never re-parse a PDF.
- `chunk_index` preserves original order so a document can be re-read linearly (chunk browser UI, and "show surrounding context" later).
- Store the embedding model name alongside (or in config + a migration note): vectors from different models are not comparable, so a model change means re-embedding everything.
