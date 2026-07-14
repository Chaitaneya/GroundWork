from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func, select

from ..deps import CurrentUser, DbSession
from ..models import Subject, Topic
from ..schemas import SubjectCreate, SubjectOut, SubjectUpdate

router = APIRouter(prefix="/api/subjects", tags=["subjects"])


def get_owned_subject(db: DbSession, user_id: int, subject_id: int) -> Subject:
    """Fetch a subject only if it belongs to this user.

    404 (not 403) when it exists but isn't theirs — a 403 would leak that
    the id exists.
    """
    subject = db.scalar(
        select(Subject).where(Subject.id == subject_id, Subject.user_id == user_id)
    )
    if subject is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Subject not found")
    return subject


@router.get("", response_model=list[SubjectOut])
def list_subjects(user: CurrentUser, db: DbSession):
    # One query for subjects AND their topic counts: LEFT JOIN so subjects
    # with zero topics still appear, GROUP BY to count per subject.
    rows = db.execute(
        select(Subject, func.count(Topic.id))
        .outerjoin(Topic)
        .where(Subject.user_id == user.id)
        .group_by(Subject.id)
        .order_by(Subject.created_at)
    ).all()
    return [
        SubjectOut(
            id=s.id,
            name=s.name,
            description=s.description,
            created_at=s.created_at,
            topic_count=count,
        )
        for s, count in rows
    ]


@router.post("", response_model=SubjectOut, status_code=status.HTTP_201_CREATED)
def create_subject(body: SubjectCreate, user: CurrentUser, db: DbSession):
    duplicate = db.scalar(
        select(Subject).where(Subject.user_id == user.id, Subject.name == body.name)
    )
    if duplicate:
        raise HTTPException(status.HTTP_409_CONFLICT, "You already have a subject with this name")
    subject = Subject(user_id=user.id, name=body.name, description=body.description)
    db.add(subject)
    db.commit()
    return subject


@router.get("/{subject_id}", response_model=SubjectOut)
def get_subject(subject_id: int, user: CurrentUser, db: DbSession):
    return get_owned_subject(db, user.id, subject_id)


@router.patch("/{subject_id}", response_model=SubjectOut)
def update_subject(subject_id: int, body: SubjectUpdate, user: CurrentUser, db: DbSession):
    subject = get_owned_subject(db, user.id, subject_id)
    # exclude_unset: only fields the client actually sent — that's PATCH.
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(subject, field, value)
    db.commit()
    return subject


@router.delete("/{subject_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_subject(subject_id: int, user: CurrentUser, db: DbSession):
    subject = get_owned_subject(db, user.id, subject_id)
    db.delete(subject)  # topics go with it via the cascade
    db.commit()
