from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func, select

from .. import sm2
from ..deps import CurrentUser, DbSession
from ..models import Flashcard, Review, Subject, Topic
from ..schemas import (
    FlashcardCreate,
    FlashcardOut,
    FlashcardUpdate,
    QueueCard,
    ReviewRequest,
)
from .topics import get_owned_topic

router = APIRouter(prefix="/api", tags=["flashcards"])

QUEUE_LIMIT = 50


def get_owned_flashcard(db: DbSession, user_id: int, flashcard_id: int) -> Flashcard:
    card = db.scalar(
        select(Flashcard)
        .join(Topic)
        .join(Subject)
        .where(Flashcard.id == flashcard_id, Subject.user_id == user_id)
    )
    if card is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Flashcard not found")
    return card


@router.get("/topics/{topic_id}/flashcards", response_model=list[FlashcardOut])
def list_flashcards(topic_id: int, user: CurrentUser, db: DbSession):
    get_owned_topic(db, user.id, topic_id)
    return db.scalars(
        select(Flashcard).where(Flashcard.topic_id == topic_id).order_by(Flashcard.created_at)
    ).all()


@router.post(
    "/topics/{topic_id}/flashcards",
    response_model=FlashcardOut,
    status_code=status.HTTP_201_CREATED,
)
def create_flashcard(topic_id: int, body: FlashcardCreate, user: CurrentUser, db: DbSession):
    get_owned_topic(db, user.id, topic_id)
    card = Flashcard(topic_id=topic_id, front=body.front, back=body.back)
    db.add(card)
    db.commit()
    return card


@router.patch("/flashcards/{flashcard_id}", response_model=FlashcardOut)
def update_flashcard(
    flashcard_id: int, body: FlashcardUpdate, user: CurrentUser, db: DbSession
):
    card = get_owned_flashcard(db, user.id, flashcard_id)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(card, field, value)
    db.commit()
    return card


@router.delete("/flashcards/{flashcard_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_flashcard(flashcard_id: int, user: CurrentUser, db: DbSession):
    card = get_owned_flashcard(db, user.id, flashcard_id)
    db.delete(card)
    db.commit()


@router.post("/flashcards/{flashcard_id}/review", response_model=FlashcardOut)
def review_flashcard(
    flashcard_id: int, body: ReviewRequest, user: CurrentUser, db: DbSession
):
    """Apply one review: run SM-2, log it, reschedule the card."""
    card = get_owned_flashcard(db, user.id, flashcard_id)

    state = sm2.Sm2State(
        ease_factor=card.ease_factor,
        interval_days=card.interval_days,
        repetitions=card.repetitions,
        lapses=card.lapses,
    )
    result = sm2.review(state, body.rating)

    # Append-only log BEFORE mutating the card, capturing before/after.
    db.add(
        Review(
            flashcard_id=card.id,
            rating=body.rating,
            interval_before=card.interval_days,
            interval_after=result.state.interval_days,
            ease_after=result.state.ease_factor,
        )
    )

    card.ease_factor = result.state.ease_factor
    card.interval_days = result.state.interval_days
    card.repetitions = result.state.repetitions
    card.lapses = result.state.lapses
    card.due_at = datetime.now(timezone.utc) + result.due_in
    db.commit()
    return card


@router.get("/review/queue", response_model=list[QueueCard])
def review_queue(user: CurrentUser, db: DbSession):
    """All due cards across every subject, oldest due first."""
    rows = db.execute(
        select(Flashcard, Topic.name, Subject.name)
        .join(Topic, Flashcard.topic_id == Topic.id)
        .join(Subject, Topic.subject_id == Subject.id)
        .where(
            Subject.user_id == user.id,
            Flashcard.due_at <= func.now(),
            Flashcard.suspended.is_(False),
        )
        .order_by(Flashcard.due_at)
        .limit(QUEUE_LIMIT)
    ).all()
    return [
        QueueCard(
            **FlashcardOut.model_validate(card).model_dump(),
            topic_name=topic_name,
            subject_name=subject_name,
        )
        for card, topic_name, subject_name in rows
    ]
