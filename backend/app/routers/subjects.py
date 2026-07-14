from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from ..deps import CurrentUser, DbSession
from ..models import Subject
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
    return db.scalars(
        select(Subject).where(Subject.user_id == user.id).order_by(Subject.created_at)
    ).all()


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
