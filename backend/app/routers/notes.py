from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from ..deps import CurrentUser, DbSession
from ..models import Note, Subject, Topic
from ..schemas import NoteCreate, NoteOut, NoteUpdate
from .topics import get_owned_topic

router = APIRouter(prefix="/api", tags=["notes"])


def get_owned_note(db: DbSession, user_id: int, note_id: int) -> Note:
    note = db.scalar(
        select(Note)
        .join(Topic)
        .join(Subject)
        .where(Note.id == note_id, Subject.user_id == user_id)
    )
    if note is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Note not found")
    return note


@router.get("/topics/{topic_id}/notes", response_model=list[NoteOut])
def list_notes(topic_id: int, user: CurrentUser, db: DbSession):
    get_owned_topic(db, user.id, topic_id)
    return db.scalars(
        select(Note).where(Note.topic_id == topic_id).order_by(Note.created_at)
    ).all()


@router.post(
    "/topics/{topic_id}/notes", response_model=NoteOut, status_code=status.HTTP_201_CREATED
)
def create_note(topic_id: int, body: NoteCreate, user: CurrentUser, db: DbSession):
    get_owned_topic(db, user.id, topic_id)
    note = Note(topic_id=topic_id, title=body.title, content_md=body.content_md)
    db.add(note)
    db.commit()
    return note


@router.patch("/notes/{note_id}", response_model=NoteOut)
def update_note(note_id: int, body: NoteUpdate, user: CurrentUser, db: DbSession):
    note = get_owned_note(db, user.id, note_id)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(note, field, value)
    db.commit()
    return note


@router.delete("/notes/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_note(note_id: int, user: CurrentUser, db: DbSession):
    note = get_owned_note(db, user.id, note_id)
    db.delete(note)
    db.commit()
