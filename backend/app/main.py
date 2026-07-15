from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from .config import settings
from .db import get_engine
from .routers import auth, documents, flashcards, notes, quizzes, subjects, topics

app = FastAPI(title="Groundwork API")

app.include_router(auth.router)
app.include_router(subjects.router)
app.include_router(topics.router)
app.include_router(documents.router)
app.include_router(notes.router)
app.include_router(flashcards.router)
app.include_router(quizzes.router)

# The browser blocks JS on localhost:5173 from calling localhost:8000 unless
# this API explicitly allows that origin — that's CORS.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return {"status": "ok", "app": "groundwork"}


@app.get("/api/db-check")
def db_check():
    if not settings.database_url:
        return {
            "connected": False,
            "detail": "DATABASE_URL is not set. Copy backend/.env.example to backend/.env and paste your Neon connection string.",
        }
    try:
        with get_engine().connect() as conn:
            version, now = conn.execute(text("SELECT version(), now()")).one()
    except Exception as exc:  # surface the real error to the UI during dev
        return {"connected": False, "detail": str(exc)}
    return {"connected": True, "postgres_version": version, "server_time": str(now)}
