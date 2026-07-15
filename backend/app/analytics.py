"""Per-topic weakness analytics, computed in SQL at read time.

Nothing here is stored — no denormalized stats to keep in sync. The raw
signals live in `reviews` (append-only), `flashcards` (current SM-2 state),
and `attempt_answers`; this module turns them into one explainable score:

    weakness = 0.5·(1 − recent quiz accuracy)
             + 0.3·(again rate: how often cards are failed)
             + 0.2·(1 − normalized ease: how hard cards have become)

Missing signals (e.g. a topic with no quiz attempts yet) don't count as
zero — their weight is redistributed over the signals that exist.
"""

from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import and_, case, func, select
from sqlalchemy.orm import Session

from .models import (
    AttemptAnswer,
    Flashcard,
    Quiz,
    QuizAttempt,
    Review,
    Subject,
    Topic,
)

RECENT_ATTEMPTS_PER_TOPIC = 10

WEIGHT_QUIZ = 0.5
WEIGHT_AGAIN = 0.3
WEIGHT_EASE = 0.2
EASE_MIN, EASE_MAX = 1.3, 2.5  # SM-2's floor and starting ease


@dataclass
class TopicStat:
    topic_id: int
    topic_name: str
    subject_name: str
    card_count: int
    due_count: int
    review_count: int
    again_rate: float | None      # share of reviews rated "Again"
    avg_ease: float | None
    quiz_attempt_count: int
    quiz_accuracy: float | None   # over the last N attempts
    weakness: float | None        # 0-100, None = no data yet


def topic_stats(db: Session, user_id: int) -> list[TopicStat]:
    topics = db.execute(
        select(Topic.id, Topic.name, Subject.name)
        .join(Subject)
        .where(Subject.user_id == user_id)
        .order_by(Subject.name, Topic.position)
    ).all()

    # --- flashcard state per topic (accepted cards only) ---
    card_rows = db.execute(
        select(
            Flashcard.topic_id,
            func.count(Flashcard.id),
            func.avg(Flashcard.ease_factor),
            func.count(
                case(
                    (
                        and_(
                            Flashcard.due_at <= func.now(),
                            Flashcard.suspended.is_(False),
                        ),
                        1,
                    )
                )
            ),
        )
        .join(Topic)
        .join(Subject)
        .where(Subject.user_id == user_id, Flashcard.pending.is_(False))
        .group_by(Flashcard.topic_id)
    ).all()
    cards = {r[0]: r for r in card_rows}

    # --- review history per topic (from the append-only log) ---
    review_rows = db.execute(
        select(
            Flashcard.topic_id,
            func.count(Review.id),
            func.sum(case((Review.rating == 1, 1), else_=0)),
        )
        .join(Flashcard, Review.flashcard_id == Flashcard.id)
        .join(Topic)
        .join(Subject)
        .where(Subject.user_id == user_id)
        .group_by(Flashcard.topic_id)
    ).all()
    reviews = {r[0]: r for r in review_rows}

    # --- recent quiz accuracy per topic ---
    # Window function: rank each topic's attempts newest-first, keep the
    # last N, then aggregate the answers belonging to those attempts.
    recent = (
        select(
            QuizAttempt.id.label("attempt_id"),
            Quiz.topic_id.label("topic_id"),
            func.row_number()
            .over(partition_by=Quiz.topic_id, order_by=QuizAttempt.started_at.desc())
            .label("rn"),
        )
        .join(Quiz, QuizAttempt.quiz_id == Quiz.id)
        .join(Topic)
        .join(Subject)
        .where(Subject.user_id == user_id, QuizAttempt.completed_at.is_not(None))
    ).subquery()
    quiz_rows = db.execute(
        select(
            recent.c.topic_id,
            func.count(func.distinct(recent.c.attempt_id)),
            func.count(AttemptAnswer.id),
            func.sum(case((AttemptAnswer.is_correct, 1), else_=0)),
        )
        .join(AttemptAnswer, AttemptAnswer.attempt_id == recent.c.attempt_id)
        .where(recent.c.rn <= RECENT_ATTEMPTS_PER_TOPIC)
        .group_by(recent.c.topic_id)
    ).all()
    quizzes = {r[0]: r for r in quiz_rows}

    stats: list[TopicStat] = []
    for topic_id, topic_name, subject_name in topics:
        _, card_count, avg_ease, due_count = cards.get(topic_id, (topic_id, 0, None, 0))
        _, review_count, again_count = reviews.get(topic_id, (topic_id, 0, 0))
        _, attempt_count, answer_count, correct_count = quizzes.get(
            topic_id, (topic_id, 0, 0, 0)
        )

        again_rate = (again_count or 0) / review_count if review_count else None
        quiz_accuracy = (correct_count or 0) / answer_count if answer_count else None

        # Weighted score over whichever signals exist.
        components: list[tuple[float, float]] = []
        if quiz_accuracy is not None:
            components.append((WEIGHT_QUIZ, 1 - quiz_accuracy))
        if again_rate is not None:
            components.append((WEIGHT_AGAIN, again_rate))
        if avg_ease is not None:
            normalized = (float(avg_ease) - EASE_MIN) / (EASE_MAX - EASE_MIN)
            components.append((WEIGHT_EASE, 1 - max(0.0, min(1.0, normalized))))
        weakness = (
            round(100 * sum(w * v for w, v in components) / sum(w for w, _ in components), 1)
            if components
            else None
        )

        stats.append(
            TopicStat(
                topic_id=topic_id,
                topic_name=topic_name,
                subject_name=subject_name,
                card_count=card_count,
                due_count=due_count,
                review_count=review_count,
                again_rate=round(again_rate, 3) if again_rate is not None else None,
                avg_ease=round(float(avg_ease), 2) if avg_ease is not None else None,
                quiz_attempt_count=attempt_count,
                quiz_accuracy=round(quiz_accuracy, 3) if quiz_accuracy is not None else None,
                weakness=weakness,
            )
        )
    return stats


def weakness_by_topic(db: Session, user_id: int) -> dict[int, float]:
    """topic_id -> weakness, for ordering the review queue."""
    return {s.topic_id: s.weakness for s in topic_stats(db, user_id) if s.weakness is not None}


def reviews_by_day(db: Session, user_id: int, days: int = 7) -> list[tuple[date, int]]:
    """Review counts for the last `days` days, zero-filled."""
    since = datetime.now(timezone.utc) - timedelta(days=days - 1)
    rows = db.execute(
        select(func.date(Review.reviewed_at), func.count(Review.id))
        .join(Flashcard, Review.flashcard_id == Flashcard.id)
        .join(Topic)
        .join(Subject)
        .where(Subject.user_id == user_id, Review.reviewed_at >= since)
        .group_by(func.date(Review.reviewed_at))
    ).all()
    counts = {r[0]: r[1] for r in rows}
    today = datetime.now(timezone.utc).date()
    return [
        (day, counts.get(day, 0))
        for day in (today - timedelta(days=i) for i in range(days - 1, -1, -1))
    ]
