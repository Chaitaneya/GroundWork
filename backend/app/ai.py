"""Gemini integration: embeddings, retrieval, and grounded generation.

Grounding layers (see docs/plan.md §3):
1. retrieval — the model only ever sees chunks from the user's own uploads
2. mandatory citations — the response schema requires source_chunk_ids
3. mechanical validation — items citing unknown chunks are rejected here
(4 and 5 — UI traceability and CI evals — live elsewhere.)
"""

from typing import Literal

from google import genai
from google.genai import types
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import settings
from .models import DocumentChunk, Document, Topic

PROMPT_VERSION = "v1"
RETRIEVAL_K = 12
EMBED_BATCH = 50


class AIConfigError(Exception):
    """AI features are not configured; message is user-facing."""


_client: genai.Client | None = None


def get_client() -> genai.Client:
    global _client
    if not settings.gemini_api_key:
        raise AIConfigError(
            "GEMINI_API_KEY is not set — add it to backend/.env to enable AI generation."
        )
    if _client is None:
        _client = genai.Client(api_key=settings.gemini_api_key)
    return _client


# ---------- embeddings ----------


def _embed(texts: list[str], task_type: str) -> list[list[float]]:
    client = get_client()
    vectors: list[list[float]] = []
    for i in range(0, len(texts), EMBED_BATCH):
        response = client.models.embed_content(
            model=settings.embedding_model,
            contents=texts[i : i + EMBED_BATCH],
            config=types.EmbedContentConfig(
                output_dimensionality=settings.embedding_dim,
                task_type=task_type,
            ),
        )
        vectors.extend([e.values for e in response.embeddings])
    return vectors


def embed_documents(texts: list[str]) -> list[list[float]]:
    return _embed(texts, "RETRIEVAL_DOCUMENT")


def embed_query(text: str) -> list[float]:
    return _embed([text], "RETRIEVAL_QUERY")[0]


def ensure_chunk_embeddings(db: Session, topic_id: int) -> int:
    """Embed any chunks of this topic that don't have vectors yet.
    Returns how many were embedded."""
    chunks = db.scalars(
        select(DocumentChunk)
        .join(Document)
        .where(Document.topic_id == topic_id, DocumentChunk.embedding.is_(None))
    ).all()
    if not chunks:
        return 0
    vectors = embed_documents([c.content for c in chunks])
    for chunk, vector in zip(chunks, vectors):
        chunk.embedding = vector
    db.commit()
    return len(chunks)


def retrieve_chunks(db: Session, topic: Topic, k: int = RETRIEVAL_K) -> list[DocumentChunk]:
    """The 'R' in RAG: the k chunks most similar to the topic, via pgvector."""
    query_vector = embed_query(f"{topic.name}. {topic.description}".strip())
    return list(
        db.scalars(
            select(DocumentChunk)
            .join(Document)
            .where(Document.topic_id == topic.id, DocumentChunk.embedding.is_not(None))
            .order_by(DocumentChunk.embedding.cosine_distance(query_vector))
            .limit(k)
        ).all()
    )


# ---------- generation schemas (what the model must return) ----------


class GenFlashcard(BaseModel):
    front: str
    back: str
    source_chunk_ids: list[int]


class GenNote(BaseModel):
    title: str
    content_md: str
    source_chunk_ids: list[int]


class GenOption(BaseModel):
    option_text: str
    is_correct: bool


class GenQuestion(BaseModel):
    qtype: Literal["mcq", "true_false", "short_answer"]
    prompt: str
    options: list[GenOption] = Field(default_factory=list)
    answer_text: str | None = None
    explanation: str = ""
    source_chunk_ids: list[int]


class GenQuiz(BaseModel):
    title: str
    questions: list[GenQuestion]


# ---------- prompts ----------


def build_context(chunks: list[DocumentChunk]) -> str:
    return "\n\n".join(
        f"[chunk {c.id}] (page {c.page_number})\n{c.content}" for c in chunks
    )


GROUNDING_RULES = """STRICT RULES:
- Use ONLY the study material below. Do not add facts from outside knowledge.
- Every item MUST list the ids of the chunks it is based on in source_chunk_ids,
  using the integer N from the [chunk N] labels.
- If the material does not support an item, do not invent one — produce fewer items instead.
"""


def flashcards_prompt(topic: Topic, context: str, count: int) -> str:
    return f"""You are creating study flashcards for the topic "{topic.name}".
{GROUNDING_RULES}
Create up to {count} flashcards covering the most important, testable ideas in the material.
Each card: a clear, specific question on the front; a concise, complete answer on the back.

STUDY MATERIAL:
{context}"""


def notes_prompt(topic: Topic, context: str, count: int) -> str:
    return f"""You are writing structured revision notes for the topic "{topic.name}".
{GROUNDING_RULES}
Write 1 well-organized note in Markdown (headings, bullet points, key definitions
bolded). Cover the material thoroughly but concisely — a student should be able to
revise the topic from this note alone.

STUDY MATERIAL:
{context}"""


def quiz_prompt(topic: Topic, context: str, count: int) -> str:
    return f"""You are writing a quiz for the topic "{topic.name}".
{GROUNDING_RULES}
Create 1 quiz with up to {count} questions: a mix of multiple-choice (4 options,
exactly one correct), true/false (options "True" and "False", exactly one correct),
and short-answer (a short factual answer in answer_text). Every question gets a
1-2 sentence explanation of the correct answer, grounded in the material.

STUDY MATERIAL:
{context}"""


# ---------- generation + mechanical citation validation ----------


def generate_structured(prompt: str, schema: type) -> object:
    """Call Gemini with a required JSON schema and return parsed objects."""
    client = get_client()
    response = client.models.generate_content(
        model=settings.gemini_model,
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=schema,
            temperature=0.4,
        ),
    )
    if response.parsed is None:
        raise ValueError("Model returned unparseable output")
    return response.parsed


def valid_citations(source_chunk_ids: list[int], allowed_ids: set[int]) -> bool:
    """An item passes only if it cites at least one chunk and every cited
    chunk was actually in the retrieved context. This is the mechanical
    line of defense against hallucinated content."""
    return bool(source_chunk_ids) and set(source_chunk_ids) <= allowed_ids
