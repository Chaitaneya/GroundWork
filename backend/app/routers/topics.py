from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func, select

from ..deps import CurrentUser, DbSession
from ..models import Subject, Topic
from ..schemas import TopicCreate, TopicOut, TopicUpdate
from .subjects import get_owned_subject

router = APIRouter(prefix="/api", tags=["topics"])


def get_owned_topic(db: DbSession, user_id: int, topic_id: int) -> Topic:
    # Ownership lives two tables up: topic → subject → user. The join
    # enforces it in one query.
    topic = db.scalar(
        select(Topic)
        .join(Subject)
        .where(Topic.id == topic_id, Subject.user_id == user_id)
    )
    if topic is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Topic not found")
    return topic


@router.get("/subjects/{subject_id}/topics", response_model=list[TopicOut])
def list_topics(subject_id: int, user: CurrentUser, db: DbSession):
    get_owned_subject(db, user.id, subject_id)
    return db.scalars(
        select(Topic).where(Topic.subject_id == subject_id).order_by(Topic.position)
    ).all()


@router.post(
    "/subjects/{subject_id}/topics",
    response_model=TopicOut,
    status_code=status.HTTP_201_CREATED,
)
def create_topic(subject_id: int, body: TopicCreate, user: CurrentUser, db: DbSession):
    get_owned_subject(db, user.id, subject_id)
    duplicate = db.scalar(
        select(Topic).where(Topic.subject_id == subject_id, Topic.name == body.name)
    )
    if duplicate:
        raise HTTPException(status.HTTP_409_CONFLICT, "This subject already has that topic")
    next_position = db.scalar(
        select(func.count()).select_from(Topic).where(Topic.subject_id == subject_id)
    )
    topic = Topic(
        subject_id=subject_id,
        name=body.name,
        description=body.description,
        position=next_position or 0,
    )
    db.add(topic)
    db.commit()
    return topic


@router.get("/topics/{topic_id}", response_model=TopicOut)
def get_topic(topic_id: int, user: CurrentUser, db: DbSession):
    return get_owned_topic(db, user.id, topic_id)


@router.patch("/topics/{topic_id}", response_model=TopicOut)
def update_topic(topic_id: int, body: TopicUpdate, user: CurrentUser, db: DbSession):
    topic = get_owned_topic(db, user.id, topic_id)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(topic, field, value)
    db.commit()
    return topic


@router.delete("/topics/{topic_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_topic(topic_id: int, user: CurrentUser, db: DbSession):
    topic = get_owned_topic(db, user.id, topic_id)
    db.delete(topic)
    db.commit()
