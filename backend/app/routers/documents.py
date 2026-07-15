from fastapi import APIRouter, BackgroundTasks, HTTPException, UploadFile, status
from sqlalchemy import func, select

from ..db import SessionLocal, get_engine
from ..deps import CurrentUser, DbSession
from ..ingestion import ExtractionError, ingest_file
from ..models import Document, DocumentChunk, Subject, Topic
from ..schemas import ChunkOut, DocumentOut
from .topics import get_owned_topic

router = APIRouter(prefix="/api", tags=["documents"])

MAX_UPLOAD_BYTES = 25 * 1024 * 1024  # 25 MB
ALLOWED_EXTENSIONS = (".pdf", ".txt", ".md")


def get_owned_document(db: DbSession, user_id: int, document_id: int) -> Document:
    # Ownership is three tables up: document → topic → subject → user.
    document = db.scalar(
        select(Document)
        .join(Topic)
        .join(Subject)
        .where(Document.id == document_id, Subject.user_id == user_id)
    )
    if document is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Document not found")
    return document


def process_document(document_id: int, filename: str, data: bytes) -> None:
    """Runs in the background AFTER the upload response is sent.

    Background tasks outlive the request, so they can't reuse the request's
    DB session — this opens its own. Whatever happens, the document ends up
    'ready' or 'failed', never stuck in 'processing'.
    """
    with SessionLocal(bind=get_engine()) as db:
        document = db.get(Document, document_id)
        if document is None:  # deleted while we were queued
            return
        try:
            page_count, chunks = ingest_file(filename, data)
            document.page_count = page_count
            for chunk in chunks:
                db.add(
                    DocumentChunk(
                        document_id=document_id,
                        chunk_index=chunk.index,
                        page_number=chunk.page_number,
                        content=chunk.content,
                    )
                )
            document.status = "ready"
            document.error = None
        except ExtractionError as exc:
            document.status = "failed"
            document.error = str(exc)[:500]
        except Exception as exc:  # unexpected bug — still don't strand the doc
            document.status = "failed"
            document.error = f"Unexpected processing error: {exc}"[:500]
        db.commit()


@router.post(
    "/topics/{topic_id}/documents",
    response_model=DocumentOut,
    status_code=status.HTTP_201_CREATED,
)
def upload_document(
    topic_id: int,
    file: UploadFile,
    background_tasks: BackgroundTasks,
    user: CurrentUser,
    db: DbSession,
):
    get_owned_topic(db, user.id, topic_id)
    filename = file.filename or "upload"
    if not filename.lower().endswith(ALLOWED_EXTENSIONS):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "Only .pdf, .txt, and .md files are supported"
        )

    data = file.file.read(MAX_UPLOAD_BYTES + 1)
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "File is larger than 25 MB"
        )
    if not data:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "File is empty")

    document = Document(
        topic_id=topic_id,
        title=filename.rsplit(".", 1)[0][:255],
        original_filename=filename[:255],
        status="processing",
    )
    db.add(document)
    db.commit()

    # Respond now; parse/chunk after the response goes out. The client
    # watches document.status to know when it's done.
    background_tasks.add_task(process_document, document.id, filename, data)
    return document


@router.get("/topics/{topic_id}/documents", response_model=list[DocumentOut])
def list_documents(topic_id: int, user: CurrentUser, db: DbSession):
    get_owned_topic(db, user.id, topic_id)
    rows = db.execute(
        select(Document, func.count(DocumentChunk.id))
        .outerjoin(DocumentChunk)
        .where(Document.topic_id == topic_id)
        .group_by(Document.id)
        .order_by(Document.created_at)
    ).all()
    return [
        DocumentOut.model_validate(doc).model_copy(update={"chunk_count": count})
        for doc, count in rows
    ]


@router.get("/documents/{document_id}", response_model=DocumentOut)
def get_document(document_id: int, user: CurrentUser, db: DbSession):
    document = get_owned_document(db, user.id, document_id)
    count = db.scalar(
        select(func.count())
        .select_from(DocumentChunk)
        .where(DocumentChunk.document_id == document_id)
    )
    return DocumentOut.model_validate(document).model_copy(update={"chunk_count": count or 0})


@router.get("/documents/{document_id}/chunks", response_model=list[ChunkOut])
def list_chunks(document_id: int, user: CurrentUser, db: DbSession):
    get_owned_document(db, user.id, document_id)
    return db.scalars(
        select(DocumentChunk)
        .where(DocumentChunk.document_id == document_id)
        .order_by(DocumentChunk.chunk_index)
    ).all()


@router.delete("/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(document_id: int, user: CurrentUser, db: DbSession):
    document = get_owned_document(db, user.id, document_id)
    db.delete(document)  # chunks cascade
    db.commit()
