from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from ..deps import CurrentUser, DbSession
from ..models import AttemptAnswer, Question, QuestionOption, Quiz, QuizAttempt, Subject, Topic
from ..schemas import (
    AttemptOut,
    AttemptResult,
    AttemptSubmit,
    QuestionCreate,
    QuestionOut,
    QuestionResult,
    QuizCreate,
    QuizDetail,
    QuizOut,
)
from .topics import get_owned_topic

router = APIRouter(prefix="/api", tags=["quizzes"])


def get_owned_quiz(db: DbSession, user_id: int, quiz_id: int) -> Quiz:
    quiz = db.scalar(
        select(Quiz)
        .join(Topic)
        .join(Subject)
        .where(Quiz.id == quiz_id, Subject.user_id == user_id)
    )
    if quiz is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Quiz not found")
    return quiz


def validate_question(body: QuestionCreate) -> None:
    """The shape rules Pydantic can't express: per-type requirements."""
    if body.qtype in ("mcq", "true_false"):
        if len(body.options) < 2:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Need at least 2 options")
        if sum(o.is_correct for o in body.options) != 1:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST, "Exactly one option must be marked correct"
            )
        if body.qtype == "true_false" and len(body.options) != 2:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST, "True/false questions need exactly 2 options"
            )
    else:  # short_answer
        if not body.answer_text or not body.answer_text.strip():
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST, "Short-answer questions need an answer_text"
            )


@router.get("/topics/{topic_id}/quizzes", response_model=list[QuizOut])
def list_quizzes(topic_id: int, user: CurrentUser, db: DbSession):
    get_owned_topic(db, user.id, topic_id)
    rows = db.execute(
        select(Quiz, func.count(Question.id))
        .outerjoin(Question)
        .where(Quiz.topic_id == topic_id)
        .group_by(Quiz.id)
        .order_by(Quiz.created_at)
    ).all()
    return [
        QuizOut.model_validate(quiz).model_copy(update={"question_count": count})
        for quiz, count in rows
    ]


@router.post(
    "/topics/{topic_id}/quizzes", response_model=QuizOut, status_code=status.HTTP_201_CREATED
)
def create_quiz(topic_id: int, body: QuizCreate, user: CurrentUser, db: DbSession):
    get_owned_topic(db, user.id, topic_id)
    quiz = Quiz(topic_id=topic_id, title=body.title)
    db.add(quiz)
    db.commit()
    return quiz


@router.get("/quizzes/{quiz_id}", response_model=QuizDetail)
def get_quiz(quiz_id: int, user: CurrentUser, db: DbSession):
    get_owned_quiz(db, user.id, quiz_id)
    # selectinload fetches questions + options in 2 extra queries instead of
    # one query per question (the N+1 problem).
    quiz = db.scalar(
        select(Quiz)
        .options(selectinload(Quiz.questions).selectinload(Question.options))
        .where(Quiz.id == quiz_id)
    )
    detail = QuizDetail.model_validate(quiz)
    detail.question_count = len(detail.questions)
    return detail


@router.delete("/quizzes/{quiz_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_quiz(quiz_id: int, user: CurrentUser, db: DbSession):
    quiz = get_owned_quiz(db, user.id, quiz_id)
    db.delete(quiz)
    db.commit()


@router.post(
    "/quizzes/{quiz_id}/questions",
    response_model=QuestionOut,
    status_code=status.HTTP_201_CREATED,
)
def add_question(quiz_id: int, body: QuestionCreate, user: CurrentUser, db: DbSession):
    get_owned_quiz(db, user.id, quiz_id)
    validate_question(body)
    position = db.scalar(
        select(func.count()).select_from(Question).where(Question.quiz_id == quiz_id)
    )
    question = Question(
        quiz_id=quiz_id,
        qtype=body.qtype,
        prompt=body.prompt,
        answer_text=body.answer_text.strip() if body.answer_text else None,
        explanation=body.explanation,
        position=position or 0,
    )
    db.add(question)
    db.flush()  # get question.id before adding options
    for opt in body.options:
        db.add(
            QuestionOption(
                question_id=question.id,
                option_text=opt.option_text,
                is_correct=opt.is_correct,
            )
        )
    db.commit()
    return db.scalar(
        select(Question)
        .options(selectinload(Question.options))
        .where(Question.id == question.id)
    )


@router.delete("/questions/{question_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_question(question_id: int, user: CurrentUser, db: DbSession):
    question = db.scalar(
        select(Question)
        .join(Quiz)
        .join(Topic)
        .join(Subject)
        .where(Question.id == question_id, Subject.user_id == user.id)
    )
    if question is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Question not found")
    db.delete(question)
    db.commit()


def grade_answer(question: Question, given: str) -> tuple[bool, str]:
    """Return (is_correct, human-readable correct answer)."""
    if question.qtype in ("mcq", "true_false"):
        correct_option = next((o for o in question.options if o.is_correct), None)
        if correct_option is None:
            return False, ""
        return given == str(correct_option.id), correct_option.option_text
    # short_answer: forgiving comparison — case/whitespace insensitive
    expected = (question.answer_text or "").strip().lower()
    return given.strip().lower() == expected, question.answer_text or ""


@router.post("/quizzes/{quiz_id}/attempts", response_model=AttemptResult)
def submit_attempt(quiz_id: int, body: AttemptSubmit, user: CurrentUser, db: DbSession):
    """Grade an attempt server-side and store it. The client never grades —
    it just displays what the server decided."""
    get_owned_quiz(db, user.id, quiz_id)
    questions = db.scalars(
        select(Question)
        .options(selectinload(Question.options))
        .where(Question.quiz_id == quiz_id)
    ).all()
    if not questions:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This quiz has no questions")

    by_id = {q.id: q for q in questions}
    given = {a.question_id: a.given_answer for a in body.answers}

    now = datetime.now(timezone.utc)
    attempt = QuizAttempt(quiz_id=quiz_id, started_at=now, completed_at=now)
    db.add(attempt)
    db.flush()

    results: list[QuestionResult] = []
    correct_count = 0
    for question in questions:
        answer = given.get(question.id, "")
        is_correct, correct_answer = grade_answer(question, answer)
        correct_count += is_correct
        db.add(
            AttemptAnswer(
                attempt_id=attempt.id,
                question_id=question.id,
                given_answer=answer[:1000],
                is_correct=is_correct,
            )
        )
        results.append(
            QuestionResult(
                question_id=question.id,
                is_correct=is_correct,
                correct_answer=correct_answer,
                explanation=question.explanation,
            )
        )

    attempt.score_pct = round(100 * correct_count / len(questions), 1)
    db.commit()
    return AttemptResult(id=attempt.id, score_pct=attempt.score_pct, results=results)


@router.get("/quizzes/{quiz_id}/attempts", response_model=list[AttemptOut])
def list_attempts(quiz_id: int, user: CurrentUser, db: DbSession):
    get_owned_quiz(db, user.id, quiz_id)
    return db.scalars(
        select(QuizAttempt)
        .where(QuizAttempt.quiz_id == quiz_id)
        .order_by(QuizAttempt.started_at.desc())
    ).all()
