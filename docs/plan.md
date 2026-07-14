# Groundwork — Project Plan

A grounded-AI study app: syllabus + uploaded reading material → notes, flashcards, and quizzes traceable to source text, with real spaced repetition and weak-topic analytics.

Target: portfolio project for a full-stack + GenAI internship. Built solo, phased, free-tier only, real SQL. Everything runs **locally first**; deployment happens in the final phase alongside CI/CD.

---

## 1. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | React + Vite + TypeScript, Tailwind CSS | Learn real React without framework magic; Vite is the standard modern setup. TS from day one — every serious codebase uses it. |
| Backend | Python 3.12, FastAPI, SQLAlchemy 2.0, Alembic, Pydantic v2 | Python strength + the standard for Python APIs; FastAPI docs double as a course. SQLAlchemy + Alembic = real ORM + real migrations. |
| Database | PostgreSQL on Neon (free tier) with pgvector | Real SQL requirement. Neon is plain managed Postgres — using it from day one means no local Postgres install, and dev/prod use the same DB engine. pgvector gives vector search *inside* Postgres. |
| Auth | Hand-rolled JWT: register/login, argon2 hashing (passlib), PyJWT | Rolling your own auth (correctly) is a huge learning win and interview talking point. |
| LLM | Google Gemini free tier (`google-genai` SDK) — Flash model for generation, Gemini embedding model for retrieval | Only major provider with a genuinely free API tier; supports structured JSON output natively. |
| PDF parsing | `pypdf` (fall back to PyMuPDF if extraction quality is poor) | MIT-licensed, pure Python, good for digital PDFs. Scanned/image PDFs (OCR) are out of scope. See [pdf-pipeline.md](pdf-pipeline.md). |
| Hosting (Phase 6) | Vercel (frontend) + Render free tier (backend) | Deferred to the final phase — develop locally until the product is real. |
| CI/CD (Phase 6) | GitHub Actions | Free for public repos. |
| Monitoring (Phase 6) | UptimeRobot + Sentry free tiers | |

File storage note: extract text from uploaded PDFs at upload time and store the text + chunks in Postgres; **discard the original file**. This avoids needing any blob-storage service. (Easy extension later.)

---

## 2. Database schema

Everything hangs off `users` through `subjects`; ownership checks are joins, which is exactly the relational practice you want.

```
users            (id PK, email UNIQUE, password_hash, display_name, created_at)

subjects         (id PK, user_id FK→users, name, description, created_at,
                  UNIQUE(user_id, name))

topics           (id PK, subject_id FK→subjects, name, description, position, created_at,
                  UNIQUE(subject_id, name))

documents        (id PK, topic_id FK→topics, title, original_filename,
                  status ENUM('processing','ready','failed'), page_count, error, created_at)

document_chunks  (id PK, document_id FK→documents, chunk_index, content TEXT,
                  page_number, embedding VECTOR(768))     -- pgvector column

notes            (id PK, topic_id FK, title, content_md TEXT,
                  origin ENUM('manual','ai'), created_at, updated_at)

note_sources     (note_id FK, chunk_id FK, PK(note_id, chunk_id))

flashcards       (id PK, topic_id FK, front TEXT, back TEXT, origin,
                  -- SM-2 scheduling state lives here (cards aren't shared between users):
                  ease_factor FLOAT DEFAULT 2.5, interval_days FLOAT DEFAULT 0,
                  repetitions INT DEFAULT 0, lapses INT DEFAULT 0,
                  due_at TIMESTAMPTZ DEFAULT now(), suspended BOOL DEFAULT false, created_at)

flashcard_sources(flashcard_id FK, chunk_id FK, PK(flashcard_id, chunk_id))

reviews          (id PK, flashcard_id FK, rating SMALLINT,   -- 1=Again 2=Hard 3=Good 4=Easy
                  reviewed_at, interval_before, interval_after, ease_after)

quizzes          (id PK, topic_id FK, title, origin, created_at)

questions        (id PK, quiz_id FK, qtype ENUM('mcq','true_false','short_answer'),
                  prompt TEXT, answer_text TEXT NULL, explanation TEXT, origin)

question_options (id PK, question_id FK, option_text, is_correct BOOL)  -- for mcq/true_false

question_sources (question_id FK, chunk_id FK, PK(question_id, chunk_id))

quiz_attempts    (id PK, quiz_id FK, started_at, completed_at, score_pct)

attempt_answers  (id PK, attempt_id FK, question_id FK, given_answer, is_correct)

generation_jobs  (id PK, topic_id FK, kind ENUM('notes','flashcards','quiz'),
                  status ENUM('queued','running','done','failed'),
                  model, prompt_version, error, created_at, finished_at)
```

Design points worth being able to explain in an interview:

- **`*_sources` join tables are the traceability mechanism.** Every AI-generated item links to the exact chunks it was derived from; the UI renders those chunks (with page numbers) on demand. Manual items simply have no source rows.
- **`origin` column** on notes/flashcards/questions makes the manual fallback a first-class citizen, not a hack.
- **`reviews` is an append-only log**, separate from the current scheduling state on `flashcards`. The log powers analytics and lets you upgrade the algorithm later (FSRS needs full history) without a schema change.
- **`generation_jobs`** records every AI call: status, model, prompt version, errors. This makes the AI feature debuggable and is a genuinely professional touch.
- Weak-topic analytics are **computed with SQL** (see §4), not stored — no denormalized stats to keep in sync.

---

## 3. AI integration (RAG + grounding)

### Ingestion (at upload time)
1. Extract text per page with `pypdf`.
2. Chunk into ~500–800 token pieces with ~100 token overlap, preserving page numbers. (Full walkthrough: [pdf-pipeline.md](pdf-pipeline.md).)
3. Embed each chunk with Gemini's embedding model; store in `document_chunks.embedding`.

### Generation (per topic, on demand)
1. Build a query from the topic name + description, embed it, and retrieve top-k chunks for that topic's documents via pgvector cosine similarity (a plain SQL `ORDER BY embedding <=> :query_vec LIMIT k`).
2. Prompt Gemini with the retrieved chunks, each labeled `[chunk 17]`, and a strict instruction: *use only the provided material; every generated item must list the chunk ids it came from; if the material doesn't cover something, don't invent it.*
3. Use Gemini's **structured output** (`response_schema`) so the response is guaranteed-parseable JSON, e.g. for flashcards: `[{front, back, source_chunk_ids: [..]}, ...]`.
4. Validate server-side before saving: every cited chunk id must exist and belong to this topic's documents. Items with invalid citations are rejected. This mechanical check is the first line of defense against hallucination.
5. Save items + their `*_sources` rows; record everything in `generation_jobs`.

### Grounding, layered (the interview story)
1. **Retrieval** constrains what the model sees — it only gets your uploaded text.
2. **Mandatory citations** in the structured output.
3. **Mechanical validation** of citations server-side.
4. **UI traceability** — every AI item has a "source" affordance showing the actual quoted chunk and page number.
5. **(Phase 6) automated groundedness evals** — an LLM-as-judge check over a fixed test set that flags generated items not supported by their cited chunks, run in CI.

Gemini free-tier rate limits are real: generate in small batches, queue jobs, retry with exponential backoff. `generation_jobs.status` gives the UI something honest to show while a job runs.

---

## 4. Spaced repetition + weak-topic analytics

### SM-2 (Anki-style ratings)
Implement it yourself — it's ~40 lines and you should be able to whiteboard it:

- **Again (1):** card lapses → `repetitions=0`, relearn (due in ~10 min), `lapses+1`, `ease -= 0.20` (floor 1.3)
- **Hard (2):** `interval *= 1.2`, `ease -= 0.15`
- **Good (3):** 1st success → 1 day; 2nd → 6 days; after that `interval *= ease`
- **Easy (4):** `interval *= ease * 1.3`, `ease += 0.15`

Every review writes a `reviews` row and updates the card's state. Review queue = cards where `due_at <= now()` and not suspended. Later stretch goal: swap in FSRS (the modern algorithm Anki adopted) using the review log you've been keeping.

### Weak-topic score (SQL, computed on read)
Per topic, combine:
- recent quiz accuracy (last N attempts, from `attempt_answers`)
- flashcard lapse rate (`lapses / reviews`)
- average ease factor (low ease = consistently hard cards)

Example: `weakness = 0.5·(1 − quiz_accuracy) + 0.3·lapse_rate + 0.2·(1 − normalized_ease)`. Tune the weights by feel — the point is it's explainable.

Used two ways: the dashboard ranks topics by weakness, and quiz generation is biased toward weak topics (more questions requested for high-weakness topics).

---

## 5. Phased roadmap (~6 months part-time)

Each phase ends with something fully working **locally**. Deployment happens once, in Phase 6, when the product is worth deploying.

### Phase 0 — Local skeleton (~1 week)
Repo with `/backend` and `/frontend`. FastAPI hello-world connected to Neon (cloud Postgres, but used as the dev database — no local install needed). Vite React app calling the local API (CORS configured). Alembic initialized with a first migration. `.env` handling for secrets from day one (never commit keys).
**Read:** FastAPI tutorial (first ~10 sections), Vite guide, Neon quickstart.
**Done when:** `npm run dev` + `uvicorn` running side by side, and the React page shows a row fetched from Postgres through FastAPI.

### Phase 1 — Auth + subjects/topics (~2–3 weeks)
Register/login (argon2 + JWT), `get_current_user` dependency, CRUD for subjects and topics, React routing (react-router), login/session handling in the frontend, ownership enforced on every query.
**Read:** FastAPI security docs, SQLAlchemy 2.0 ORM quickstart, React docs (managing state, effects).
**Done when:** two accounts can't see each other's data.

### Phase 2 — Document upload & processing (~2 weeks)
PDF/text upload per topic, text extraction, chunking with page numbers, chunk browser UI, `documents.status` lifecycle with FastAPI `BackgroundTasks`. (No AI yet — but this *is* the RAG ingestion pipeline.)
**Read:** pypdf docs, FastAPI file uploads & background tasks, [pdf-pipeline.md](pdf-pipeline.md).
**Done when:** upload a real textbook chapter and browse its chunks with correct page numbers.

### Phase 3 — Manual study tools + SM-2 (~3–4 weeks)
Manual notes (markdown), manual flashcards, manual quizzes with MCQ/TF/short-answer, quiz-taking flow with attempts + scoring, and the full SM-2 review experience (queue, flip card, rate Again/Hard/Good/Easy). Unit-test SM-2 thoroughly — it's pure logic.
**Done when:** the app is a complete Anki-like study tool with zero AI. This is the "works without AI" requirement, done honestly.

### Phase 4 — AI generation with grounding (~4 weeks, the centerpiece)
Gemini setup, embeddings on ingestion (backfill Phase-2 chunks), pgvector retrieval, structured generation for notes/flashcards/quizzes, citation validation, `generation_jobs`, review-before-accept UI (user approves/edits/discards generated items), source-viewing UI everywhere.
**Read:** Gemini structured output + embeddings docs, pgvector README.
**Done when:** generated flashcards from your own course PDF, each showing the exact source passage; invalid-citation items are rejected; rate limits handled gracefully.

### Phase 5 — Analytics dashboard & prioritization (~2 weeks)
Weakness score in SQL, dashboard (charts of weak topics, review load, quiz history), review queue ordering influenced by weakness, quiz generation biased toward weak topics.
**Done when:** the dashboard visibly reorders as you deliberately fail cards/quizzes in one topic.

### Phase 6 — Deployment + DevOps + evals (~3–4 weeks)
First deployment: backend on Render free tier, frontend on Vercel, production env vars and CORS. GitHub Actions CI: ruff + mypy + pytest (backend), eslint + tsc + vitest (frontend), a couple of Playwright smoke tests; migrations checked in CI; **groundedness eval suite** (fixed PDF + topics → generate → mechanical citation checks + LLM-as-judge → fail CI below threshold); Sentry + UptimeRobot; README with architecture diagram + demo GIF + honest limitations section.
**Done when:** the app is live at a public URL, and a PR that breaks tests or degrades groundedness gets a red X automatically.

---

## 6. Known free-tier tradeoffs (put these in the README at deploy time)

- Render free tier sleeps → first request after idle takes ~30–60 s.
- Gemini free tier rate limits → generation is queued/batched, not instant.
- Original PDFs are discarded after text extraction (no blob storage) — text and chunks are kept.
- Scanned/image PDFs (needing OCR) are out of scope.

Stating limitations you understood and chose is itself a strong signal to interviewers.
