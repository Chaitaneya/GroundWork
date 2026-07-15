from datetime import datetime

from sqlalchemy import (
    DateTime,
    Float,
    ForeignKey,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    display_name: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    subjects: Mapped[list["Subject"]] = relationship(
        back_populates="owner", cascade="all, delete-orphan"
    )


class Subject(Base):
    __tablename__ = "subjects"
    # A user can't have two subjects with the same name; different users can.
    __table_args__ = (UniqueConstraint("user_id", "name"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    owner: Mapped[User] = relationship(back_populates="subjects")
    topics: Mapped[list["Topic"]] = relationship(
        back_populates="subject",
        cascade="all, delete-orphan",
        order_by="Topic.position",
    )


class Topic(Base):
    __tablename__ = "topics"
    __table_args__ = (UniqueConstraint("subject_id", "name"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    subject_id: Mapped[int] = mapped_column(ForeignKey("subjects.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")
    position: Mapped[int] = mapped_column(default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    subject: Mapped[Subject] = relationship(back_populates="topics")
    documents: Mapped[list["Document"]] = relationship(
        back_populates="topic", cascade="all, delete-orphan"
    )


class Document(Base):
    """An uploaded reading-material file. The original file is discarded
    after processing — only the extracted text (as chunks) is kept."""

    __tablename__ = "documents"

    id: Mapped[int] = mapped_column(primary_key=True)
    topic_id: Mapped[int] = mapped_column(ForeignKey("topics.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(255))
    original_filename: Mapped[str] = mapped_column(String(255))
    # Plain string, not a PG enum: 'processing' | 'ready' | 'failed'.
    # (Native enums make every new status a migration; not worth it here.)
    status: Mapped[str] = mapped_column(String(20), default="processing")
    page_count: Mapped[int] = mapped_column(default=0)
    error: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    topic: Mapped[Topic] = relationship(back_populates="documents")
    chunks: Mapped[list["DocumentChunk"]] = relationship(
        back_populates="document",
        cascade="all, delete-orphan",
        order_by="DocumentChunk.chunk_index",
    )


class Note(Base):
    __tablename__ = "notes"

    id: Mapped[int] = mapped_column(primary_key=True)
    topic_id: Mapped[int] = mapped_column(ForeignKey("topics.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(255))
    content_md: Mapped[str] = mapped_column(Text, default="")
    origin: Mapped[str] = mapped_column(String(10), default="manual")  # manual | ai
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class Flashcard(Base):
    """A card plus its SM-2 scheduling state. State lives on the card
    (not a separate table) because cards belong to exactly one user."""

    __tablename__ = "flashcards"

    id: Mapped[int] = mapped_column(primary_key=True)
    topic_id: Mapped[int] = mapped_column(ForeignKey("topics.id", ondelete="CASCADE"))
    front: Mapped[str] = mapped_column(Text)
    back: Mapped[str] = mapped_column(Text)
    origin: Mapped[str] = mapped_column(String(10), default="manual")

    # SM-2 state — see app/sm2.py
    ease_factor: Mapped[float] = mapped_column(Float, default=2.5)
    interval_days: Mapped[float] = mapped_column(Float, default=0.0)
    repetitions: Mapped[int] = mapped_column(default=0)
    lapses: Mapped[int] = mapped_column(default=0)
    due_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()  # new cards: due now
    )
    suspended: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    reviews: Mapped[list["Review"]] = relationship(
        back_populates="flashcard", cascade="all, delete-orphan"
    )


class Review(Base):
    """Append-only log of every review. Powers analytics (Phase 5) and a
    future FSRS upgrade — never updated, only inserted."""

    __tablename__ = "reviews"

    id: Mapped[int] = mapped_column(primary_key=True)
    flashcard_id: Mapped[int] = mapped_column(
        ForeignKey("flashcards.id", ondelete="CASCADE"), index=True
    )
    rating: Mapped[int] = mapped_column(SmallInteger)  # 1=Again 2=Hard 3=Good 4=Easy
    reviewed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    interval_before: Mapped[float] = mapped_column(Float)
    interval_after: Mapped[float] = mapped_column(Float)
    ease_after: Mapped[float] = mapped_column(Float)

    flashcard: Mapped[Flashcard] = relationship(back_populates="reviews")


class Quiz(Base):
    __tablename__ = "quizzes"

    id: Mapped[int] = mapped_column(primary_key=True)
    topic_id: Mapped[int] = mapped_column(ForeignKey("topics.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(255))
    origin: Mapped[str] = mapped_column(String(10), default="manual")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    questions: Mapped[list["Question"]] = relationship(
        back_populates="quiz", cascade="all, delete-orphan", order_by="Question.position"
    )
    attempts: Mapped[list["QuizAttempt"]] = relationship(
        back_populates="quiz", cascade="all, delete-orphan"
    )


class Question(Base):
    __tablename__ = "questions"

    id: Mapped[int] = mapped_column(primary_key=True)
    quiz_id: Mapped[int] = mapped_column(ForeignKey("quizzes.id", ondelete="CASCADE"))
    qtype: Mapped[str] = mapped_column(String(20))  # mcq | true_false | short_answer
    prompt: Mapped[str] = mapped_column(Text)
    answer_text: Mapped[str | None] = mapped_column(Text)  # short_answer only
    explanation: Mapped[str] = mapped_column(Text, default="")
    origin: Mapped[str] = mapped_column(String(10), default="manual")
    position: Mapped[int] = mapped_column(default=0)

    quiz: Mapped[Quiz] = relationship(back_populates="questions")
    options: Mapped[list["QuestionOption"]] = relationship(
        back_populates="question", cascade="all, delete-orphan", order_by="QuestionOption.id"
    )


class QuestionOption(Base):
    __tablename__ = "question_options"

    id: Mapped[int] = mapped_column(primary_key=True)
    question_id: Mapped[int] = mapped_column(ForeignKey("questions.id", ondelete="CASCADE"))
    option_text: Mapped[str] = mapped_column(Text)
    is_correct: Mapped[bool] = mapped_column(default=False)

    question: Mapped[Question] = relationship(back_populates="options")


class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"

    id: Mapped[int] = mapped_column(primary_key=True)
    quiz_id: Mapped[int] = mapped_column(ForeignKey("quizzes.id", ondelete="CASCADE"))
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    score_pct: Mapped[float | None] = mapped_column(Float)

    quiz: Mapped[Quiz] = relationship(back_populates="attempts")
    answers: Mapped[list["AttemptAnswer"]] = relationship(
        back_populates="attempt", cascade="all, delete-orphan"
    )


class AttemptAnswer(Base):
    __tablename__ = "attempt_answers"

    id: Mapped[int] = mapped_column(primary_key=True)
    attempt_id: Mapped[int] = mapped_column(
        ForeignKey("quiz_attempts.id", ondelete="CASCADE")
    )
    question_id: Mapped[int] = mapped_column(ForeignKey("questions.id", ondelete="CASCADE"))
    given_answer: Mapped[str] = mapped_column(String(1000))
    is_correct: Mapped[bool] = mapped_column(default=False)

    attempt: Mapped[QuizAttempt] = relationship(back_populates="answers")


class DocumentChunk(Base):
    """One retrievable passage of a document, in reading order.
    The embedding vector column arrives in Phase 4 (pgvector)."""

    __tablename__ = "document_chunks"

    id: Mapped[int] = mapped_column(primary_key=True)
    document_id: Mapped[int] = mapped_column(
        ForeignKey("documents.id", ondelete="CASCADE"), index=True
    )
    chunk_index: Mapped[int] = mapped_column()
    page_number: Mapped[int] = mapped_column()
    content: Mapped[str] = mapped_column(Text)

    document: Mapped[Document] = relationship(back_populates="chunks")
