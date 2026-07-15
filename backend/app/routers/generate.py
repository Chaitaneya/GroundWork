from fastapi import APIRouter, BackgroundTasks, HTTPException, status
from sqlalchemy import delete, select, update

from ..deps import CurrentUser, DbSession
from ..generation import run_generation_job
from ..models import (
    DocumentChunk,
    Flashcard,
    FlashcardSource,
    GenerationJob,
    Note,
    NoteSource,
    QuestionSource,
    Quiz,
)
from ..schemas import ChunkOut, GenerateRequest, GenerationJobOut, PendingBulkRequest
from .flashcards import get_owned_flashcard
from .notes import get_owned_note
from .quizzes import get_owned_quiz
from .topics import get_owned_topic

router = APIRouter(prefix="/api", tags=["ai"])


@router.post(
    "/topics/{topic_id}/generate",
    response_model=GenerationJobOut,
    status_code=status.HTTP_202_ACCEPTED,
)
def start_generation(
    topic_id: int,
    body: GenerateRequest,
    background_tasks: BackgroundTasks,
    user: CurrentUser,
    db: DbSession,
):
    get_owned_topic(db, user.id, topic_id)
    running = db.scalar(
        select(GenerationJob).where(
            GenerationJob.topic_id == topic_id,
            GenerationJob.kind == body.kind,
            GenerationJob.status.in_(("queued", "running")),
        )
    )
    if running:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "A generation job for this is already running"
        )
    job = GenerationJob(topic_id=topic_id, kind=body.kind)
    db.add(job)
    db.commit()
    background_tasks.add_task(run_generation_job, job.id, body.count, body.difficulty)
    return job


@router.get("/topics/{topic_id}/generation-jobs", response_model=list[GenerationJobOut])
def list_generation_jobs(topic_id: int, user: CurrentUser, db: DbSession):
    get_owned_topic(db, user.id, topic_id)
    return db.scalars(
        select(GenerationJob)
        .where(GenerationJob.topic_id == topic_id)
        .order_by(GenerationJob.created_at.desc())
        .limit(10)
    ).all()


# ---------- accept pending AI items ----------
# Accept = pending -> False. Discard = the existing DELETE endpoints.

_PENDING_MODELS = {"flashcards": Flashcard, "notes": Note, "quiz": Quiz}


@router.post("/topics/{topic_id}/pending/accept-all", status_code=status.HTTP_204_NO_CONTENT)
def accept_all_pending(
    topic_id: int, body: PendingBulkRequest, user: CurrentUser, db: DbSession
):
    get_owned_topic(db, user.id, topic_id)
    model = _PENDING_MODELS[body.kind]
    db.execute(
        update(model)
        .where(model.topic_id == topic_id, model.pending.is_(True))
        .values(pending=False)
    )
    db.commit()


@router.post("/topics/{topic_id}/pending/discard-all", status_code=status.HTTP_204_NO_CONTENT)
def discard_all_pending(
    topic_id: int, body: PendingBulkRequest, user: CurrentUser, db: DbSession
):
    get_owned_topic(db, user.id, topic_id)
    model = _PENDING_MODELS[body.kind]
    db.execute(delete(model).where(model.topic_id == topic_id, model.pending.is_(True)))
    db.commit()


@router.post("/flashcards/{flashcard_id}/accept", status_code=status.HTTP_204_NO_CONTENT)
def accept_flashcard(flashcard_id: int, user: CurrentUser, db: DbSession):
    card = get_owned_flashcard(db, user.id, flashcard_id)
    card.pending = False
    db.commit()


@router.post("/notes/{note_id}/accept", status_code=status.HTTP_204_NO_CONTENT)
def accept_note(note_id: int, user: CurrentUser, db: DbSession):
    note = get_owned_note(db, user.id, note_id)
    note.pending = False
    db.commit()


@router.post("/quizzes/{quiz_id}/accept", status_code=status.HTTP_204_NO_CONTENT)
def accept_quiz(quiz_id: int, user: CurrentUser, db: DbSession):
    quiz = get_owned_quiz(db, user.id, quiz_id)
    quiz.pending = False
    db.commit()


# ---------- source traceability ----------


@router.get("/flashcards/{flashcard_id}/sources", response_model=list[ChunkOut])
def flashcard_sources(flashcard_id: int, user: CurrentUser, db: DbSession):
    get_owned_flashcard(db, user.id, flashcard_id)
    return db.scalars(
        select(DocumentChunk)
        .join(FlashcardSource, FlashcardSource.chunk_id == DocumentChunk.id)
        .where(FlashcardSource.flashcard_id == flashcard_id)
        .order_by(DocumentChunk.page_number)
    ).all()


@router.get("/notes/{note_id}/sources", response_model=list[ChunkOut])
def note_sources(note_id: int, user: CurrentUser, db: DbSession):
    get_owned_note(db, user.id, note_id)
    return db.scalars(
        select(DocumentChunk)
        .join(NoteSource, NoteSource.chunk_id == DocumentChunk.id)
        .where(NoteSource.note_id == note_id)
        .order_by(DocumentChunk.page_number)
    ).all()


@router.get("/questions/{question_id}/sources", response_model=list[ChunkOut])
def question_sources(question_id: int, user: CurrentUser, db: DbSession):
    # ownership: question -> quiz -> topic -> subject
    from ..models import Question, Quiz, Subject, Topic

    owned = db.scalar(
        select(Question.id)
        .join(Quiz)
        .join(Topic)
        .join(Subject)
        .where(Question.id == question_id, Subject.user_id == user.id)
    )
    if owned is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Question not found")
    return db.scalars(
        select(DocumentChunk)
        .join(QuestionSource, QuestionSource.chunk_id == DocumentChunk.id)
        .where(QuestionSource.question_id == question_id)
        .order_by(DocumentChunk.page_number)
    ).all()
