"""Runs one generation job end to end, in the background.

Pipeline per job: backfill embeddings → retrieve top-k chunks → prompt Gemini
(structured output) → mechanically validate citations → insert surviving items
as pending (origin='ai') with their source rows → mark the job done/failed.
"""

from datetime import datetime, timezone

from sqlalchemy import select

from . import ai
from .config import settings
from .db import SessionLocal, get_engine
from .models import (
    AttemptAnswer,
    Flashcard,
    FlashcardSource,
    GenerationJob,
    Note,
    NoteSource,
    Question,
    QuestionOption,
    QuestionSource,
    Quiz,
    Topic,
)

DEFAULT_COUNT = 10


def _valid_question_shape(q: ai.GenQuestion) -> bool:
    """Same shape rules manual questions must pass."""
    if q.qtype in ("mcq", "true_false"):
        if len(q.options) < 2 or sum(o.is_correct for o in q.options) != 1:
            return False
        if q.qtype == "true_false" and len(q.options) != 2:
            return False
        return True
    return bool(q.answer_text and q.answer_text.strip())


def run_generation_job(
    job_id: int, count: int = DEFAULT_COUNT, difficulty: str = "standard"
) -> None:
    with SessionLocal(bind=get_engine()) as db:
        job = db.get(GenerationJob, job_id)
        if job is None:
            return
        job.status = "running"
        job.model = settings.gemini_model
        db.commit()

        try:
            topic = db.get(Topic, job.topic_id)
            ai.ensure_chunk_embeddings(db, topic.id)
            chunks = ai.retrieve_chunks(db, topic)
            if not chunks:
                raise ai.AIConfigError(
                    "No processed documents on this topic — upload reading material first."
                )
            allowed_ids = {c.id for c in chunks}
            context = ai.build_context(chunks)

            created = rejected = 0
            if job.kind == "flashcards":
                items = ai.generate_structured(
                    ai.flashcards_prompt(topic, context, count), list[ai.GenFlashcard]
                )
                for item in items:
                    if not ai.valid_citations(item.source_chunk_ids, allowed_ids):
                        rejected += 1
                        continue
                    card = Flashcard(
                        topic_id=topic.id, front=item.front, back=item.back,
                        origin="ai", pending=True,
                    )
                    db.add(card)
                    db.flush()
                    for chunk_id in set(item.source_chunk_ids):
                        db.add(FlashcardSource(flashcard_id=card.id, chunk_id=chunk_id))
                    created += 1

            elif job.kind == "notes":
                items = ai.generate_structured(
                    ai.notes_prompt(topic, context, count), list[ai.GenNote]
                )
                for item in items:
                    if not ai.valid_citations(item.source_chunk_ids, allowed_ids):
                        rejected += 1
                        continue
                    note = Note(
                        topic_id=topic.id, title=item.title, content_md=item.content_md,
                        origin="ai", pending=True,
                    )
                    db.add(note)
                    db.flush()
                    for chunk_id in set(item.source_chunk_ids):
                        db.add(NoteSource(note_id=note.id, chunk_id=chunk_id))
                    created += 1

            elif job.kind == "quiz":
                # Adaptive bias: feed recently-missed question prompts from
                # this topic back into the prompt so the new quiz re-tests
                # what the student actually got wrong.
                missed_prompts = list(
                    db.scalars(
                        select(Question.prompt)
                        .distinct()
                        .join(AttemptAnswer, AttemptAnswer.question_id == Question.id)
                        .join(Quiz, Question.quiz_id == Quiz.id)
                        .where(
                            Quiz.topic_id == topic.id,
                            AttemptAnswer.is_correct.is_(False),
                        )
                        .limit(5)
                    ).all()
                )
                gen_quiz = ai.generate_structured(
                    ai.quiz_prompt(topic, context, count, missed_prompts, difficulty),
                    ai.GenQuiz,
                )
                quiz = Quiz(topic_id=topic.id, title=gen_quiz.title, origin="ai", pending=True)
                db.add(quiz)
                db.flush()
                for position, gq in enumerate(gen_quiz.questions):
                    if not ai.valid_citations(gq.source_chunk_ids, allowed_ids) or not _valid_question_shape(gq):
                        rejected += 1
                        continue
                    question = Question(
                        quiz_id=quiz.id, qtype=gq.qtype, prompt=gq.prompt,
                        answer_text=(gq.answer_text or "").strip() or None,
                        explanation=gq.explanation, origin="ai", position=position,
                    )
                    db.add(question)
                    db.flush()
                    for opt in gq.options:
                        db.add(QuestionOption(
                            question_id=question.id,
                            option_text=opt.option_text,
                            is_correct=opt.is_correct,
                        ))
                    for chunk_id in set(gq.source_chunk_ids):
                        db.add(QuestionSource(question_id=question.id, chunk_id=chunk_id))
                    created += 1
                if created == 0:
                    db.delete(quiz)  # don't leave an empty shell quiz behind
            else:
                raise ValueError(f"Unknown job kind: {job.kind}")

            job.created_count = created
            job.rejected_count = rejected
            job.status = "done"
        except ai.AIConfigError as exc:
            job.status = "failed"
            job.error = str(exc)[:1000]
        except Exception as exc:  # rate limits, network, SDK errors
            job.status = "failed"
            job.error = f"{type(exc).__name__}: {exc}"[:1000]
        job.finished_at = datetime.now(timezone.utc)
        db.commit()
