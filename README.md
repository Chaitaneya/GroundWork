# Groundwork

A study tool that turns your syllabus and reading material into **grounded** study content — notes, flashcards, and quizzes generated only from what you actually uploaded, with every item traceable back to its source passage. Cards are scheduled with a real spaced-repetition algorithm (SM-2), and quiz/review history drives a weak-topic dashboard that prioritizes what you're struggling with.

> Status: planning / early development. See [docs/plan.md](docs/plan.md) for the full plan and phased roadmap.

## Repo structure

```
groundwork/
├── backend/    # FastAPI + SQLAlchemy + Alembic (Python)
├── frontend/   # React + Vite + TypeScript + Tailwind
└── docs/       # Plan, schema, design notes
    ├── plan.md          # Stack, schema, roadmap
    └── pdf-pipeline.md  # How PDF → chunks → embeddings works
```

## Core features

- Organize material by subject → topic
- Upload PDFs/notes per topic; text is extracted, chunked, and embedded
- AI-generated notes, flashcards, and quizzes grounded in the uploaded material, with visible source citations
- Full manual mode — the app is a complete study tool without any AI
- SM-2 spaced repetition for flashcard review
- Weak-topic analytics from quiz performance + flashcard difficulty

## Stack

FastAPI · SQLAlchemy 2.0 · PostgreSQL (Neon) + pgvector · React + Vite + TypeScript · Tailwind · Gemini API

## Running locally

One-time setup:

```bash
# Backend
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env        # then paste your Neon DATABASE_URL into .env
.venv/bin/alembic upgrade head

# Frontend
cd ../frontend
npm install
```

Every dev session (two terminals):

```bash
# Terminal 1 — API on :8000
cd backend && .venv/bin/uvicorn app.main:app --reload --port 8000

# Terminal 2 — UI on :5173
cd frontend && npm run dev
```

Open http://localhost:5173 — the status page shows whether the API and database are reachable. Interactive API docs live at http://localhost:8000/docs.
