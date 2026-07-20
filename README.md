<div align="center">

![Groundwork Hero](https://raw.githubusercontent.com/Chaitaneya/GroundWork/main/frontend/public/hero_banner.png)

<br/>

[![Live](https://img.shields.io/badge/Live-groundwork--three.vercel.app-4A7C59?style=flat-square)](https://groundwork-three.vercel.app)
[![Backend](https://img.shields.io/badge/API-Render-46E3B7?style=flat-square)](https://groundwork-three.vercel.app)
[![Stack](https://img.shields.io/badge/Stack-FastAPI%20%2B%20React-blue?style=flat-square)](#stack)
[![License](https://img.shields.io/badge/License-MIT-grey?style=flat-square)](LICENSE)

</div>

---

## The problem

Most AI study tools generate content from a model's training data. You do not know which edition, which syllabus, or which version of the truth they trained on. For coursework, that is a gamble.

Groundwork inverts the model: upload your own reading material, and every flashcard, note, and quiz question is generated exclusively from what you uploaded. The model is shown only the passages retrieved from your documents. Every generated item must cite the exact chunk IDs it drew from, and the backend mechanically discards anything that cites passages it never saw. Nothing invented. Everything traceable.

---

## What it does

Upload PDFs, text files, or Markdown notes into a topic. From there:

- **Document chat** — ask questions about a single document and get answers pinned to the page they came from.
- **AI-generated notes** — structured Markdown revision notes written from your material, not from the internet.
- **AI-generated flashcards** — question-answer pairs ready for spaced repetition, each one traceable to its source passage.
- **AI-generated quizzes** — multiple-choice, true/false, and short-answer questions at three difficulty tiers (introductory, standard, exam-level). Subsequent quizzes bias toward the ideas you recently answered incorrectly.
- **SM-2 spaced repetition** — the same algorithm Anki uses, with Again / Hard / Good / Easy ratings. Easy cards drift out for weeks; forgotten cards come back within the session.
- **Weakness analytics** — a per-topic score computed at read time from quiz accuracy, flashcard fail rate, and average ease factor. No denormalization. No staleness.
- **Full manual mode** — every AI feature is optional. The app is a complete study tool without a Gemini key.

---

## How AI generation stays honest

Grounding works in layers, not as a single check.

```
Upload PDF
    │
    ▼
PDF → Pages → Chunks (ingestion.py — pure functions, fully testable)
    │
    ▼
Chunks → 768-dim Gemini embeddings → stored in pgvector
    │
    ▼
On generate: top-12 chunks retrieved by cosine similarity
    │
    ▼
Chunks passed to Gemini with a required JSON schema:
  every item MUST list source_chunk_ids
    │
    ▼
Backend validates: cited ID not in retrieval context → item rejected
    │
    ▼
Accepted items created as "pending" → you review before they enter your study flow
```

Every generation call is logged in `generation_jobs`: model, prompt version, items created, items rejected. The feature is debuggable, not magical.

---

## Stack

![Architecture](https://raw.githubusercontent.com/Chaitaneya/GroundWork/main/frontend/public/arch_diagram.png)

<br/>

**Backend**

| | Choice | Why |
|---|---|---|
| Framework | FastAPI 0.115 | Async, typed, auto-generates API docs |
| ORM | SQLAlchemy 2.0 + Alembic | Mapped columns, type-safe queries, schema migrations |
| Database | PostgreSQL via Neon + pgvector | pgvector cosine similarity for RAG retrieval |
| Auth | JWT + Argon2 (pwdlib) | Standard, no external auth dependency |
| PDF parsing | pypdf | Text extraction with page-level tracking |
| AI | Google Gemini (`gemini-flash-latest` + `gemini-embedding-001`) | Structured JSON output, 768-dim embeddings |
| Config | pydantic-settings | Type-safe env vars, same interface locally and in production |

**Frontend**

| | Choice |
|---|---|
| Framework | React 19 + TypeScript |
| Build | Vite 8 |
| Routing | React Router 7 |
| Styling | Tailwind CSS 4 |
| Animation | Framer Motion |
| Linting | oxlint |

**Infrastructure**

| Piece | Platform |
|---|---|
| Frontend | Vercel — static CDN, auto-deploys on push to `main` |
| Backend | Render — free web service, auto-deploys on push |
| Database | Neon — serverless PostgreSQL |

---

## Repository structure

```
groundwork/
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI app, router registration, CORS
│   │   ├── config.py        # All settings via pydantic-settings
│   │   ├── models.py        # SQLAlchemy models (13 tables)
│   │   ├── ingestion.py     # PDF/text → pages → chunks (pure, testable)
│   │   ├── ai.py            # Embeddings, RAG retrieval, generation, citation validation
│   │   ├── sm2.py           # SM-2 spaced repetition (pure logic, no I/O)
│   │   ├── analytics.py     # Weakness scoring computed in SQL at read time
│   │   ├── generation.py    # Pipeline: ingest → embed → generate → validate
│   │   └── routers/         # auth, subjects, topics, documents, notes,
│   │                        # flashcards, quizzes, generate, analytics
│   ├── alembic/             # Database migrations
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── pages/           # LandingPage, Dashboard, Subject, Topic,
    │   │                    # Document, Quiz, Review, Login, Register
    │   ├── components/      # Shared UI components
    │   └── api.ts           # Typed wrapper over every backend endpoint
    └── public/              # Static assets served from /
```

---

## Running locally

**One-time setup**

```bash
# Backend
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env
# Edit .env: paste your Neon DATABASE_URL and Gemini API key
.venv/bin/alembic upgrade head

# Frontend
cd ../frontend
npm install
```

**Every dev session (two terminals)**

```bash
# Terminal 1 — API on :8000
cd backend && .venv/bin/uvicorn app.main:app --reload --port 8000

# Terminal 2 — UI on :5173
cd frontend && npm run dev
```

Open `http://localhost:5173`. The status page reports API and database health before you log in. Interactive API docs are at `http://localhost:8000/docs`.

---

## Environment variables

**Backend** — `backend/.env` locally, Render environment tab in production

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | Neon PostgreSQL connection string with `?sslmode=require` |
| `SECRET_KEY` | Yes | Signs JWTs — rotate before deploying |
| `GEMINI_API_KEY` | No | Required for AI features; AI gracefully disables itself if absent |
| `GEMINI_API_KEY_FALLBACK` | No | Used automatically on rate limit (429/503) |
| `CORS_ORIGINS` | Yes | JSON list of allowed frontend origins |

**Frontend** — Vercel environment tab (baked in at build time)

| Variable | Required | Description |
|---|---|---|
| `VITE_API_URL` | Yes | Full backend URL, no trailing slash |

---

## Known limitations

- Scanned PDFs (image-only, no selectable text) are not supported.
- File types are limited to `.pdf`, `.txt`, and `.md`.
- The Render free tier cold-starts after 15 minutes idle. First request takes 30–60 seconds.
- Gemini rate limits apply on the free API tier. The fallback key handles transient quota errors but sustained generation will hit limits.
- No OCR, no table extraction, no formula or embedded image support.

---

## What is next

The append-only review log in `reviews` and the `generation_jobs` audit table were designed from the start for the next layer: using weakness scores to trigger adaptive quiz regeneration automatically, and upgrading the scheduling algorithm from SM-2 to FSRS (Free Spaced Repetition Scheduler) without needing a data migration.

---

<div align="center">
  <sub>Built by Chaitanya Pareek &nbsp;·&nbsp; study from your own pages</sub>
</div>
