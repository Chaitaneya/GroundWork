"""Pydantic models: the shapes of API requests and responses.

Separate from the SQLAlchemy models on purpose — the API contract and the
database schema evolve independently (e.g. User has password_hash in the DB
but must never expose it in a response).
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    display_name: str = Field(min_length=1, max_length=100)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)  # build from ORM objects

    id: int
    email: EmailStr
    display_name: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class SubjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=2000)


class SubjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)


class SubjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str
    created_at: datetime
    topic_count: int = 0


class TopicCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=2000)


class TopicUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)


class TopicOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    subject_id: int
    name: str
    description: str
    position: int
    created_at: datetime


class DocumentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    topic_id: int
    title: str
    original_filename: str
    status: str  # processing | ready | failed
    page_count: int
    error: str | None = None
    created_at: datetime
    chunk_count: int = 0


class ChunkOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    chunk_index: int
    page_number: int
    content: str


# ---------- notes ----------


class NoteCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    content_md: str = Field(default="", max_length=50_000)


class NoteUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    content_md: str | None = Field(default=None, max_length=50_000)


class NoteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    topic_id: int
    title: str
    content_md: str
    origin: str
    created_at: datetime
    updated_at: datetime


# ---------- flashcards & reviews ----------


class FlashcardCreate(BaseModel):
    front: str = Field(min_length=1, max_length=5000)
    back: str = Field(min_length=1, max_length=5000)


class FlashcardUpdate(BaseModel):
    front: str | None = Field(default=None, min_length=1, max_length=5000)
    back: str | None = Field(default=None, min_length=1, max_length=5000)
    suspended: bool | None = None


class FlashcardOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    topic_id: int
    front: str
    back: str
    origin: str
    ease_factor: float
    interval_days: float
    repetitions: int
    lapses: int
    due_at: datetime
    suspended: bool
    created_at: datetime


class ReviewRequest(BaseModel):
    rating: int = Field(ge=1, le=4)  # 1=Again 2=Hard 3=Good 4=Easy


class QueueCard(FlashcardOut):
    topic_name: str
    subject_name: str


# ---------- quizzes ----------


class OptionCreate(BaseModel):
    option_text: str = Field(min_length=1, max_length=1000)
    is_correct: bool = False


class OptionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    option_text: str
    is_correct: bool


class QuestionCreate(BaseModel):
    qtype: Literal["mcq", "true_false", "short_answer"]
    prompt: str = Field(min_length=1, max_length=5000)
    options: list[OptionCreate] = []
    answer_text: str | None = Field(default=None, max_length=1000)
    explanation: str = Field(default="", max_length=5000)


class QuestionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    qtype: str
    prompt: str
    answer_text: str | None
    explanation: str
    origin: str
    position: int
    options: list[OptionOut] = []


class QuizCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)


class QuizOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    topic_id: int
    title: str
    origin: str
    created_at: datetime
    question_count: int = 0


class QuizDetail(QuizOut):
    questions: list[QuestionOut] = []


class AnswerSubmit(BaseModel):
    question_id: int
    # option id (as string) for mcq/true_false, free text for short_answer
    given_answer: str = Field(max_length=1000)


class AttemptSubmit(BaseModel):
    answers: list[AnswerSubmit]


class QuestionResult(BaseModel):
    question_id: int
    is_correct: bool
    correct_answer: str
    explanation: str


class AttemptResult(BaseModel):
    id: int
    score_pct: float
    results: list[QuestionResult]


class AttemptOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    started_at: datetime
    score_pct: float | None
