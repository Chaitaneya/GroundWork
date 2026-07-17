# GroundWork — The Complete Project Guide

*Written for someone building their first full-stack Python project. Read it top to
bottom once; after that, use the file reference and the interview section as lookups.*

---

## Part 1 — What this project is

GroundWork is a study web app. A student:

1. organizes material into **subjects → topics**,
2. **uploads reading material** (PDF/text) per topic,
3. gets **AI-generated notes, flashcards, and quizzes** — where every generated item
   is *traceable to the exact passage* of the uploaded material it came from,
4. **reviews flashcards** on a real spaced-repetition schedule (SM-2, the algorithm
   family Anki uses),
5. sees a **dashboard of weak topics** computed from quiz scores and review history,
   which also reorders the review queue and biases future quiz generation,
6. can **chat with any uploaded document**, getting answers that cite page numbers.

Everything AI-related is "grounded": the model only ever sees text from the
student's own uploads, must cite which passages it used, and anything it can't
back with a citation is rejected by the server before the student ever sees it.

---

## Part 2 — The big picture: how two programs become one app

This project is **two separate programs** that talk over HTTP:

```
   Browser (your laptop)                        Server processes
┌───────────────────────┐    HTTP + JSON    ┌──────────────────────┐     SQL      ┌──────────────┐
│  React app             │ ────────────────► │  FastAPI app          │ ───────────► │  PostgreSQL   │
│  (frontend/ — runs in  │ ◄──────────────── │  (backend/ — Python,  │ ◄─────────── │  on Neon      │
│  the browser, port 5173)│    JSON back     │  port 8000)           │    rows      │  (cloud)      │
└───────────────────────┘                   └──────────────────────┘              └──────────────┘
                                                      │  HTTPS
                                                      ▼
                                              Google Gemini API
                                              (generation + embeddings)
```

**The frontend** is TypeScript/React. It runs entirely inside the browser. It has no
database access and holds no secrets. Its only power is `fetch()` — sending HTTP
requests to the backend and rendering whatever JSON comes back.

**The backend** is Python/FastAPI. It owns everything that matters: the database
connection, the Gemini API key, password checking, and all the rules ("does this
user own this flashcard?"). It exposes ~45 URLs ("endpoints") like
`POST /api/auth/login` or `GET /api/review/queue`, each returning JSON.

### How exactly do they connect? Four mechanisms:

**1. HTTP requests.** The frontend calls e.g. `fetch("http://localhost:8000/api/subjects")`.
FastAPI receives it, runs the matching Python function, and returns JSON. Every
single frontend↔backend interaction in this project is one of these calls, and
every one of them goes through a single frontend file: `frontend/src/api.ts`.

**2. CORS.** Browsers block JavaScript served from one origin (`localhost:5173`)
from calling another (`localhost:8000`) unless the second one explicitly allows
it. In `backend/app/main.py` we add `CORSMiddleware` allowing our frontend's
origin. Without those five lines, every request would fail in the browser while
working fine in `curl` — a classic first-week mystery.

**3. JWT auth.** Logging in returns a *token* — a signed string encoding "user 7,
valid until <date>". The frontend stores it in `localStorage` and attaches it to
every request as a header: `Authorization: Bearer <token>`. The backend verifies
the signature (using `SECRET_KEY` from `.env`) and knows who's calling — no
session storage on the server, no cookies.

**4. JSON contracts.** Both sides agree on shapes. The backend declares them as
Pydantic models (`backend/app/schemas.py`); the frontend mirrors them as
TypeScript interfaces (`frontend/src/api.ts`). If the backend says a flashcard
has `{id, front, back, due_at, ...}`, the frontend's `Flashcard` interface says
the same, so the compiler catches mismatches.

### One request, end to end

When you click a subject called "Operating Systems":

1. React Router renders `SubjectPage`, which calls `getSubject(2)` from `api.ts`.
2. `api.ts` sends `GET http://localhost:8000/api/subjects/2` with the `Authorization` header.
3. FastAPI routes it to `get_subject()` in `backend/app/routers/subjects.py`.
4. A *dependency* (`get_current_user`) first turns the token into a `User` row — or
   rejects with 401.
5. The route runs a SQLAlchemy query: `SELECT ... FROM subjects WHERE id=2 AND user_id=<you>`.
   If it's someone else's subject, that query finds nothing → 404.
6. The ORM row is converted to JSON via the `SubjectOut` schema and returned.
7. `api.ts` parses it; React stores it in state; the page re-renders with the name.

That loop — component → api.ts → FastAPI route → dependency → SQLAlchemy →
schema → JSON → state → render — is the whole app, repeated ~45 times.

---

## Part 3 — Repository map

```
GroundWork/
├── backend/
│   ├── app/
│   │   ├── main.py            FastAPI app: CORS, routers, health endpoints
│   │   ├── config.py          settings loaded from .env
│   │   ├── db.py              database engine, sessions, Base class
│   │   ├── models.py          the 17 database tables as Python classes
│   │   ├── schemas.py         API request/response shapes (Pydantic)
│   │   ├── security.py        password hashing + JWT create/verify
│   │   ├── deps.py            reusable dependencies (get_current_user)
│   │   ├── sm2.py             spaced-repetition algorithm (pure logic)
│   │   ├── ingestion.py       PDF → cleaned pages → chunks (pure logic)
│   │   ├── ai.py              Gemini: embeddings, retrieval, prompts, chat
│   │   ├── generation.py      background job: retrieve→generate→validate→insert
│   │   ├── analytics.py       weak-topic scoring in SQL
│   │   └── routers/           one file per resource (the ~45 endpoints)
│   │       ├── auth.py        register / login / me
│   │       ├── subjects.py    subject CRUD (+ topic counts)
│   │       ├── topics.py      topic CRUD
│   │       ├── documents.py   upload, file serving, chunks, per-document chat
│   │       ├── notes.py       note CRUD
│   │       ├── flashcards.py  card CRUD + review + weakness-ordered queue
│   │       ├── quizzes.py     quiz/question CRUD + server-side grading
│   │       ├── generate.py    AI jobs, accept/discard, source traceability
│   │       └── analytics.py   dashboard payload
│   ├── alembic/               database migrations (versioned schema changes)
│   ├── tests/                 pytest: SM-2 (11 tests) + citation validation (4)
│   ├── requirements.txt       Python dependencies
│   └── .env                   secrets (gitignored): DB URL, JWT key, Gemini keys
├── frontend/
│   ├── src/
│   │   ├── main.tsx           entry point — mounts React
│   │   ├── App.tsx            routes, app shell (header + mobile tab bar)
│   │   ├── api.ts             ALL backend calls + shared types
│   │   ├── auth.tsx           login state (React Context) + route guard
│   │   ├── index.css          design system: fonts, colors, components
│   │   ├── components/        reusable pieces (icons, GenerateBar, …)
│   │   └── pages/             one file per screen
│   └── package.json           JS dependencies
└── docs/                      plan, pipeline explainer, phase notes, this guide
```

---

## Part 4 — Backend, file by file

### `app/config.py` — settings
One `Settings` class (pydantic-settings). At startup it reads `backend/.env` and
environment variables into typed fields: `database_url`, `secret_key`,
`gemini_api_key`, `gemini_api_key_fallback`, `gemini_model`
(`gemini-flash-latest` — an alias, so Google retiring a model name can't break
us again), `embedding_model`, `embedding_dim` (768), `cors_origins`,
`access_token_expire_minutes`. **Nothing else in the codebase reads env vars
directly** — one source of truth, and secrets never appear in code or git.

### `app/db.py` — database plumbing
- `Base` — the class every table model inherits. SQLAlchemy collects every
  subclass's definition onto `Base.metadata`, which is what Alembic diffs
  against the live database.
- `get_engine()` — lazily creates the *engine* (a connection pool). It rewrites
  Neon's `postgresql://` URL to `postgresql+psycopg://` (to select the psycopg v3
  driver) and sets `pool_pre_ping=True` because Neon's free tier closes idle
  connections when it scales to zero — pre-ping detects dead ones instead of
  crashing mid-request.
- `get_db()` — a FastAPI dependency yielding one DB session per request,
  guaranteed closed afterwards even if the request raises.

### `app/models.py` — the 17 tables
Each class = one table; each `Mapped[...]` attribute = one column. The ownership
chain is `users → subjects → topics → everything else`:

- **User** — email (unique), `password_hash` (never the password), display name.
- **Subject / Topic** — names unique *per parent* (`UniqueConstraint`), foreign
  keys with `ondelete="CASCADE"` so deleting a subject removes its whole subtree
  at the database level.
- **Document** — uploaded file: title, status (`processing/ready/failed`),
  `page_count`, `error`, and `file_data` (the original bytes, kept for the
  in-app viewer).
- **DocumentChunk** — one retrievable passage: `chunk_index` (reading order),
  `page_number`, `content`, and `embedding` — a **pgvector `Vector(768)`**
  column holding the Gemini embedding. This is what makes semantic search a SQL
  query.
- **Note / Flashcard / Quiz / Question / QuestionOption** — study content.
  All content tables carry `origin` (`manual` | `ai`) and AI items also start
  with `pending=True` until the user accepts them.
- **Flashcard** additionally carries its SM-2 state: `ease_factor`,
  `interval_days`, `repetitions`, `lapses`, `due_at`, `suspended`. State lives
  on the card because a card belongs to exactly one user.
- **Review** — *append-only log*: every review writes a row (rating, intervals
  before/after, ease after) and is never updated. It powers analytics and would
  let us switch to the FSRS algorithm later without a schema change.
- **QuizAttempt / AttemptAnswer** — graded attempts with per-question correctness.
- **NoteSource / FlashcardSource / QuestionSource** — join tables linking each
  AI-generated item to the exact chunks it was derived from. *This is the
  traceability mechanism*: manual items simply have no source rows.
- **GenerationJob** — one row per AI call: kind, status, model, prompt version,
  created/rejected counts, error. Makes the AI feature debuggable, not magical.

### `app/schemas.py` — the API contract
Pydantic models for every request and response. Deliberately separate from
`models.py`: the DB has `password_hash`, the API's `UserOut` doesn't — that
separation is what makes leaking it impossible. Request models carry validation
(`EmailStr`, `Field(min_length=8)`, `Literal["mcq","true_false","short_answer"]`);
FastAPI enforces them *before your code runs* (invalid input → automatic 422).
`model_config = ConfigDict(from_attributes=True)` lets response models be built
straight from ORM rows.

### `app/security.py` — passwords and tokens
- `hash_password` / `verify_password` — **argon2id** via pwdlib. Hashing is
  one-way and deliberately slow; a database leak reveals hashes, not passwords.
- `create_access_token(user_id)` — a JWT: payload `{"sub": "<id>", "exp": <+7d>}`
  signed with `SECRET_KEY`. JWTs are *readable* by anyone (base64, not
  encryption) — the **signature** is what makes them unforgeable.
- `decode_access_token` — verifies signature + expiry or raises.

### `app/deps.py` — dependency injection
`get_current_user`: extracts the Bearer token, decodes it, loads the `User` row,
or raises 401. Any route that declares `user: CurrentUser` is automatically
login-only. This is FastAPI's *dependency injection*: shared logic written once,
declared per-route by type annotation.

### `app/sm2.py` — spaced repetition (pure logic, 11 unit tests)
Implements SM-2 with Anki-style ratings (1 Again / 2 Hard / 3 Good / 4 Easy):

- **Again**: repetitions reset, lapse counted, ease −0.20 (floor 1.3), card due
  again in ~10 minutes.
- **Hard**: interval ×1.2, ease −0.15.
- **Good**: 1st success → 1 day, 2nd → 6 days, then interval × ease.
- **Easy**: interval × ease × 1.3 bonus, ease +0.15. Intervals cap at 365 days.

Pure functions over dataclasses — no DB, no HTTP — which is why it was trivial
to unit-test exhaustively.

### `app/ingestion.py` — PDF → chunks (pure logic)
The RAG ingestion pipeline: `extract_pdf_pages` (pypdf, with **scanned-PDF
detection** — near-zero text across pages → clean, user-facing error),
`clean_pages` (strip lines repeating on ≥60% of pages — running headers/footers —
and standalone page numbers), `chunk_pages` (paragraph-aware accumulation into
~650-token chunks with ~100-token overlap so ideas straddling a boundary exist
whole in at least one chunk, tracking the page each chunk starts on), and
`ingest_file` tying it together for `.pdf/.txt/.md`.

### `app/ai.py` — everything Gemini
- `get_client()` / `with_fallback(call)` — the primary API key, plus an automatic
  one-shot retry on `GEMINI_API_KEY_FALLBACK` whenever Google answers with
  429/503/quota errors.
- `embed_documents` / `embed_query` — Gemini embeddings (768-dim), batched;
  documents and queries use their respective task types.
- `ensure_chunk_embeddings(db, topic_id)` — backfills vectors for any chunks
  that don't have them yet (lazy: pay the cost at first generation, not upload).
- `retrieve_chunks(db, topic, k=12)` — **the "R" in RAG**: embed the topic
  text, then `ORDER BY embedding <=> :query_vector LIMIT k` via pgvector's
  cosine-distance operator. Semantic search as a plain SQL query.
- Generation schemas (`GenFlashcard`, `GenQuiz`, …) — every one **requires**
  `source_chunk_ids`. Gemini is called with `response_schema`, so output is
  guaranteed-parseable JSON.
- Prompts — grounding rules ("use ONLY the material below; cite chunk ids; if
  unsupported, produce fewer items"), a quiz **difficulty dial**
  (intro/standard/exam changes the instructions), and an adaptive section
  feeding back recently-missed question prompts.
- `valid_citations(ids, allowed)` — the **mechanical hallucination check**: an
  item passes only if it cites ≥1 chunk and every cited chunk was actually in
  the retrieved context. Unit-tested.
- `answer_about_document` — the document-chat brain: question + short history +
  that document's top-6 chunks → grounded answer + cited chunk ids.

### `app/generation.py` — the background job
`run_generation_job(job_id, count, difficulty)` runs *after* the HTTP response
is sent (FastAPI `BackgroundTasks`), with **its own DB session** (background
work can't borrow the request's session). Pipeline: mark job running → ensure
embeddings → retrieve chunks → prompt Gemini → validate citations (rejected
items are counted, not shown) → insert survivors as `pending=True` with their
source rows → mark job `done` (or `failed` with the real error). The client
polls the job row for status.

### `app/analytics.py` — weak-topic scoring
Computed in SQL at read time (nothing denormalized to keep in sync):

```
weakness = 0.5·(1 − quiz accuracy over the last 10 attempts)
         + 0.3·(share of reviews rated "Again")
         + 0.2·(1 − normalized average ease)
```

Missing signals **redistribute their weight** rather than counting as zero (a
topic with no quiz attempts isn't artificially "strong"). The last-10-attempts
accuracy uses a `row_number() OVER (PARTITION BY topic ...)` **window function**
— the most advanced SQL in the project. Also: `reviews_by_day` (zero-filled
7-day counts) and `weakness_by_topic` (used to reorder the review queue).

### `app/routers/*` — the endpoints
Every router follows the same pattern: an *ownership helper* that fetches a
resource **only if a join up to `users` proves the caller owns it** (returning
**404, not 403** — a 403 would confirm the resource exists), then thin CRUD.
Highlights beyond CRUD:

- `flashcards.py` — `POST /flashcards/{id}/review` runs SM-2, appends to the
  review log, reschedules the card. `GET /review/queue` returns due cards
  ordered **weakest topic first**, then oldest due.
- `quizzes.py` — question shape validation (MCQ needs exactly one correct
  option, etc.) and `POST /quizzes/{id}/attempts`: **grading happens on the
  server** (the client never learns answers by inspecting network traffic);
  short answers match case/whitespace-insensitively; per-question feedback +
  explanations returned.
- `documents.py` — upload (validates extension + 25 MB cap, stores original
  bytes, kicks off background processing), `GET .../file` (serves the original
  inline for the viewer), `POST .../chat` (per-question pgvector retrieval over
  *that document only* → grounded answer with page-numbered sources).
- `generate.py` — start job (409 if one is already running for that
  topic+kind), poll jobs, accept/discard single items, **bulk keep-all /
  discard-all**, and the source endpoints powering "Show sources".

### `alembic/` — migrations
Version control for the database schema. Seven migrations tell the project's
story: baseline → users/subjects/topics → documents/chunks → study tools →
pgvector/sources/pending/jobs → file_data. `alembic revision --autogenerate`
diffs `models.py` against the live DB and writes the change script — **which we
always read before applying** (we've hand-edited two: adding
`CREATE EXTENSION vector` and a `server_default` for a NOT NULL column added to
non-empty tables).

### `tests/`
`test_sm2.py` (11 tests: every rating transition, the ease floor, the interval
cap, lapse counting) and `test_ai_validation.py` (4 tests on the citation
check). Pure-logic modules got tests first because they're the highest
value-per-effort — no mocking required.

---

## Part 5 — Frontend, file by file

### `src/main.tsx`
Five lines: find `<div id="root">` in `index.html`, render `<App />` into it.

### `src/index.css` — the design system ("Night Desk")
Tailwind v4 theme tokens: colors (`desk` near-black ground, `lamp` raised
panels, `card` card-stock, `ink`, `chalk`, `dust`, `marker` highlighter yellow,
`rule` index-card red, `edge` borders) and fonts (Bricolage Grotesque display,
Figtree body, IBM Plex Mono for citations/stats). Component classes:
`.mark` (the highlighter swipe), `.index-card`/`.ruled` (card stock with the
red top rule and faint ruled lines), `.panel`, `.btn-marker`, `.btn-quiet`.
Every screen derives from these tokens — that's what keeps the design coherent.

### `src/api.ts` — the single network funnel
- Token management: module-level `token` mirrored to `localStorage`.
- `request<T>()` — every call goes through it: prefixes the base URL, attaches
  the Bearer header, throws a typed `ApiError` carrying the backend's `detail`
  message. Special case: **a 401 while holding a token means it expired** →
  clear it and redirect to login (a 401 with no token is just a wrong password).
- `postJson` / `patchJson` helpers, TypeScript interfaces mirroring every
  backend schema, and one exported function per endpoint. `login()` is the odd
  one (form-encoded, per the OAuth2 password flow); `uploadDocument()` sends
  `FormData` (and deliberately does **not** set Content-Type — the browser must
  add the multipart boundary itself); `fetchDocumentFileUrl()` fetches the PDF
  with auth and hands back an object URL, because an `<iframe>` can't send
  headers.

### `src/auth.tsx` — login state
`AuthProvider` (React Context) owns the `user` object. On page load, if a token
exists it calls `/me` to turn it back into a user — the `initializing` flag
prevents a flash-redirect to login while that's in flight. `useAuth()` exposes
`{user, signIn, signOut}` to any component. `RequireAuth` wraps the protected
routes: still initializing → nothing; no user → `<Navigate to="/login">`.

### `src/App.tsx` — routes and shell
All pages are `React.lazy` imports (**code splitting** — each page's JS loads
on first visit). `HomeGate` sends visitors to the landing page and signed-in
users to `/dashboard`. `Layout` renders the shell: sticky header with the
wordmark + inline nav on desktop, and a **fixed bottom tab bar on mobile**
(Home/Subjects/Review with SVG icons, safe-area padding). Routes: `/login`,
`/register`, `/status`, then protected `/dashboard`, `/subjects`,
`/subjects/:id`, `/topics/:id`, `/quizzes/:id`, `/review`, `/documents/:id`,
plus a 404 catch-all.

### `src/components/`
- `Wordmark.tsx` — "Ground" in chalk, "Work" on a highlighter stroke; on the
  landing page, scrolling collapses the middle letters so **GroundWork → GW**
  (framer-motion `useScroll` animating the spans' widths).
- `icons.tsx` — small inline SVG set (home, book, zap, pencil, x, send, file);
  no emoji anywhere in the app.
- `GenerateBar.tsx` — the "Generate from documents" trigger: fires the job,
  polls it every 2.5 s, shows an animated progress bar with **staged status
  messages** ("Reading your study material… → Checking every card against its
  sources… → Almost done…"), a difficulty select for quizzes, and the final
  created/rejected summary.
- `PendingBanner.tsx` — "N AI-generated items awaiting review — **Keep all** /
  **Discard all**" (the low-friction bulk companion to per-item review).
- `SourcesView.tsx` — the "Show sources" toggle on AI items: fetches and renders
  the exact quoted passages with page numbers.
- `PasswordInput.tsx` — password field with Show/Hide toggle.
- `NotesSection / FlashcardsSection / QuizzesSection` — the three topic-page
  tabs: list + create + inline edit + delete, plus GenerateBar, PendingBanner,
  per-item Accept/Discard, and SourcesView on AI items. Notes render Markdown
  via react-markdown; flashcards show their live SM-2 state (due in Xd · ease ·
  reps · lapses).

### `src/pages/`
- `LandingPage.tsx` — the marketing page: hero "Flashcards with *receipts*"
  (highlighter swipe), a 3D **index-card stack** that tilts toward the cursor
  and auto-flips through real Q/As citing "your PDF, p.3", how-it-works,
  the receipts section, animated SM-2 interval bars, CTA.
- `LoginPage / RegisterPage` — controlled forms; register has confirm-password
  with live mismatch validation; success signs in immediately.
- `DashboardPage.tsx` — stat tiles, the **weakest-topics list** (single-hue
  magnitude bars + each score's ingredients), 7-day review activity chart
  (pure CSS), recent quiz attempts.
- `SubjectsPage / SubjectPage` — CRUD with inline editing and topic counts.
- `TopicPage.tsx` — the four tabs (Documents / Notes / Flashcards / Quizzes);
  documents upload with a status badge that polls while processing, then an
  **Open** button into the viewer.
- `DocumentPage.tsx` — split view: the original PDF (or text) on the left,
  **"Ask this document"** chat on the right; answers carry hoverable `p. N`
  citation chips.
- `QuizPage.tsx` — four modes with strict rules: **overview** (no answers
  visible), **take** (radio/text inputs), **result** (score + per-question
  feedback + explanations), **edit** (the only mode showing ✓ correct answers;
  add/delete questions of all three types).
- `ReviewPage.tsx` — the flagship: the due card rendered as a **real ruled
  index card**, Show answer, Again/Hard/Good/Easy, keyboard shortcuts
  (Space = flip, 1–4 = rate), queue ordered weakest-topic-first.
- `StatusPage.tsx` — `/status`: is the API up, can it reach Postgres.

---

## Part 6 — The five key data flows

**1. Sign-up → session.** Register (argon2-hash + insert) → auto sign-in →
JWT in localStorage → every later request carries it → `get_current_user`
turns it back into a row. Reopening the app tomorrow: token still there, `/me`
revalidates it; if expired, `api.ts` catches the 401 and returns you to login.

**2. Upload → searchable knowledge.** Upload → instant response with
`status: processing` → background task extracts pages, cleans headers, chunks
with page numbers, stores chunks + original bytes → status `ready` (UI polls).
Embeddings are added lazily on first AI use.

**3. Generate → trust.** Click Generate → job row → background pipeline
(retrieve top-12 chunks by cosine distance → Gemini with a required
citation schema → server rejects any item citing unknown chunks) → items land
`pending` with source rows → user Keeps/Discards (or bulk) → accepted cards
enter the review queue. Five grounding layers: retrieval, forced citations,
mechanical validation, review-before-accept, visible sources.

**4. Review → memory.** `/review` pulls due, weakness-ordered cards → rate →
SM-2 computes the new interval → append-only `reviews` row + card update →
tomorrow's queue is different. The dashboard reads the same tables.

**5. Chat → answers with page numbers.** Each question is embedded, that
document's nearest chunks retrieved, Gemini answers strictly from them, and the
response maps cited chunks back to page-numbered snippets shown as chips.

---

## Part 7 — Interview section: explaining GroundWork

### The 60-second pitch

> "GroundWork is a full-stack study platform I built solo: FastAPI + PostgreSQL
> on the backend, React + TypeScript on the frontend. Students upload their
> course PDFs, and the app generates flashcards, notes, and quizzes using a RAG
> pipeline I built from scratch — pgvector inside Postgres for retrieval, Gemini
> with structured output for generation, and a mechanical citation-validation
> layer so every generated item is traceable to the exact page of the source
> material. Studying runs on a real SM-2 spaced-repetition scheduler I
> implemented and unit-tested, and an analytics layer computes per-topic
> weakness in SQL to reorder the review queue and bias future quiz generation.
> The whole thing runs on free-tier infrastructure."

### The architecture, one level down

Three tiers, strict responsibilities:

- **React SPA** — presentation only. One network module, typed API contracts,
  token in localStorage, route-level code splitting.
- **FastAPI** — all rules. JWT auth via dependency injection, ownership enforced
  in SQL joins on every query, server-side grading and validation, long work in
  background tasks with status rows the client polls.
- **PostgreSQL (Neon)** — 17 tables, one interesting extension: **pgvector**,
  so the vector search that usually means "add a vector database" is a plain
  SQL `ORDER BY embedding <=> query LIMIT k` in the same ACID store as
  everything else.

### Design decisions you should be able to defend (with the *why*)

| Decision | Why |
|---|---|
| pgvector instead of a vector DB | One less service, transactional consistency with the rest of the data, free tier; at student scale (<100k chunks) it's more than fast enough. |
| Grounding = retrieval + forced citations + **server-side validation** | You can't prompt your way to trust. The schema *requires* `source_chunk_ids`; the server rejects anything citing chunks that weren't in the context. Rejection counts are surfaced to the user. |
| AI output lands as `pending`, human accepts | "Review before action" — nothing enters the study queue un-seen. Bulk keep-all keeps the friction to one click. |
| Append-only `reviews` log, separate from card state | Analytics needs history; a future FSRS upgrade needs history; logs that are never updated can't be corrupted by bugs in the update path. |
| Weakness computed in SQL at read time | No denormalized counters to drift. The window function keeps "last 10 attempts" cheap. Missing signals redistribute weight instead of defaulting to zero. |
| 404 instead of 403 for others' resources | A 403 confirms the resource exists — an information leak. The ownership join simply finds nothing. |
| Same login error for wrong email vs wrong password | Prevents email enumeration. |
| Grading on the server | The client never receives correct answers during a quiz; you can't cheat via DevTools. |
| Background tasks + job rows instead of long requests | Uploads and generation take seconds-to-minutes; the client gets an immediate 202-style response and polls a `generation_jobs` row that also serves as an audit log. |
| `gemini-flash-latest` alias + fallback API key | A pinned model name got retired mid-project (real 404 in production-like use); the alias prevents recurrence, and quota errors auto-retry on a second key. |
| Migrations from day one | Seven Alembic revisions; every schema change is reviewable and reversible. Two were hand-edited — knowing *when* autogenerate isn't enough is the actual skill. |

### Questions interviewers actually ask, with answers

**"Walk me through what happens when a user asks the document chat a question."**
Frontend posts `{question, history}` with the JWT → ownership join loads the
document → the question is embedded (one Gemini call) → pgvector returns that
document's 6 nearest chunks → Gemini gets *only* those chunks plus the last few
conversation turns, with a schema requiring cited chunk ids → the server maps
cited ids back to page-numbered snippets → the UI renders the answer with
hoverable page chips. If Gemini is rate-limited, the call transparently retries
on a fallback key.

**"How do you prevent hallucinations?"**
You can't fully prevent them; you can make them detectable and filter them.
Constrain the input (retrieval), constrain the output (structured schema with
mandatory citations), verify mechanically (reject items citing chunks that
weren't provided — this is exact set arithmetic, not another LLM call), keep a
human in the loop (pending → accept), and expose the evidence (Show sources).

**"Why SM-2 and how does it work?"**
It's the classic, well-understood spaced-repetition algorithm (Anki's ancestor).
Each card has an ease factor and interval; success grows the interval
multiplicatively (1d → 6d → interval×ease), failure resets it and shrinks ease
toward a 1.3 floor. I implemented it as a pure function over immutable
dataclasses with 11 unit tests. The append-only review log means I can migrate
to FSRS (which learns from history) without touching the schema.

**"How does auth work without sessions?"**
Argon2id-hashed passwords; login returns a JWT signed with a server secret. The
server stores nothing per-session — each request's token is verified by
signature. Trade-offs I can discuss: tokens can't be revoked before expiry
(mitigations: short expiry, a denylist, or refresh tokens), and localStorage vs
httpOnly-cookie storage is an XSS-vs-CSRF trade-off.

**"What would you change for 10,000 users?"**
Move background work from in-process `BackgroundTasks` to a real queue
(Celery/RQ) so jobs survive restarts and scale independently; add pgvector
indexes (HNSW) once chunk counts grow; add rate limiting per user; move file
bytes from Postgres to object storage (S3/R2); add refresh tokens; cache the
dashboard aggregates. The point is knowing *why* each current choice was right
at this scale — every one of those is deliberate simplicity, not ignorance.

**"What was the hardest bug?"**
Two good stories: (1) The login endpoint hung mysteriously — the server log
showed FastAPI refusing to start because `OAuth2PasswordRequestForm` needs
`python-multipart`; lesson: when requests hang, read the server log before
theorizing. Bonus: the "failed" request still created the user after the client
timed out — client timeouts don't roll back server work. (2) Google retired the
Gemini model I'd pinned, mid-project, for new users only. Debugged by listing
the models my key could access, fixed with the `-latest` alias — a real
"production dependency changed under me" story.

### The one-line closers

- "Every AI item in this app can show you the page it came from."
- "The review queue isn't FIFO — it's sorted by a weakness score computed in SQL
  from the user's own mistakes."
- "The client never sees a correct answer it hasn't earned — grading is
  server-side."
- "17 tables, 7 migrations, and every schema change in the project is a
  reviewable diff."
