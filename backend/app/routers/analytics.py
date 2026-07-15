from fastapi import APIRouter
from sqlalchemy import func, select

from ..analytics import reviews_by_day, topic_stats
from ..deps import CurrentUser, DbSession
from ..models import Flashcard, Quiz, QuizAttempt, Subject, Topic
from ..schemas import DashboardOut, DayCount, RecentAttempt, TopicStatOut

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/overview", response_model=DashboardOut)
def overview(user: CurrentUser, db: DbSession):
    stats = topic_stats(db, user.id)

    due_now = db.scalar(
        select(func.count(Flashcard.id))
        .join(Topic)
        .join(Subject)
        .where(
            Subject.user_id == user.id,
            Flashcard.due_at <= func.now(),
            Flashcard.suspended.is_(False),
            Flashcard.pending.is_(False),
        )
    )

    recent_attempts = db.execute(
        select(
            QuizAttempt.id,
            Quiz.title,
            Topic.name,
            QuizAttempt.score_pct,
            QuizAttempt.started_at,
        )
        .join(Quiz, QuizAttempt.quiz_id == Quiz.id)
        .join(Topic)
        .join(Subject)
        .where(Subject.user_id == user.id, QuizAttempt.completed_at.is_not(None))
        .order_by(QuizAttempt.started_at.desc())
        .limit(10)
    ).all()

    return DashboardOut(
        topics=[TopicStatOut(**s.__dict__) for s in stats],
        due_now=due_now or 0,
        reviews_by_day=[
            DayCount(day=d.isoformat(), count=c) for d, c in reviews_by_day(db, user.id)
        ],
        recent_attempts=[
            RecentAttempt(
                id=aid,
                quiz_title=title,
                topic_name=topic,
                score_pct=score,
                started_at=started,
            )
            for aid, title, topic, score, started in recent_attempts
        ],
    )
