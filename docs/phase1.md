# Phase 0 + Phase 1 — What Was Built, File by File

Everything that exists in the codebase right now, what each file does, and how the pieces talk to each other. Read this top to bottom once, then keep it as a reference.

---

## The big picture

```
                        HTTP (JSON)                    SQL over TLS
┌──────────────┐   fetch("…/api/…")    ┌──────────────┐            ┌──────────────┐
│   React app  │ ───────────────────►  │  FastAPI app │ ─────────► │ Neon Postgres│
│ localhost:5173│ ◄───────────────────  │localhost:8000│ ◄───────── │   (cloud)    │
└──────────────┘      JSON responses   └──────────────┘  rows      └──────────────┘
     frontend/                              backend/
```

- The **frontend** never touches the database. It only speaks HTTP to the backend.
- The **backend** owns all rules: who is logged in, who owns what, what's valid.
- The **database** stores everything. The backend is the only thing with its password.

Golden rule this architecture enforces: *never trust the browser*. Anyone can bypass your React code with `curl`, so every check that matters (auth, ownership, validation) lives in the backend — the frontend versions of those checks are just politeness for the user.

---

## Backend (`backend/`)

### `requirements.txt`
The backend's dependency list. Install with `pip install -r requirements.txt`.

| Package | Why it's there |
|---|---|
| `fastapi` | The web framework — routes, validation, docs |
| `uvicorn` | The actual HTTP server that runs the FastAPI app |
| `sqlalchemy` | ORM — Python classes ↔ database tables |
| `alembic` | Database migrations (versioned schema changes) |
| `psycopg[binary]` | The driver that speaks the Postgres wire protocol |
| `pydantic-settings` | Loads config from `.env` into typed Python |
| `pwdlib[argon2]` | Password hashing (argon2id) |
| `pyjwt` | Creating and verifying JWT login tokens |
| `email-validator` | Powers Pydantic's `EmailStr` validation |
| `python-multipart` | Parses form data — the login endpoint needs it |

### `.env` (gitignored) and `.env.example`
Secrets live in `.env`: `DATABASE_URL` (Neon connection string) and `SECRET_KEY` (signs JWTs).
`.env.example` is the committed template showing *which* variables are needed without their values. New machine → copy it to `.env`, fill it in.

### `app/config.py` — configuration
One `Settings` class (pydantic-settings). At import time it reads `.env` and environment variables and gives the rest of the app a single typed object: `settings.database_url`, `settings.secret_key`, `settings.cors_origins`, `settings.access_token_expire_minutes`. Nothing else in the codebase reads env vars directly — one source of truth.

### `app/db.py` — database plumbing
Three things:

1. **`Base`** — the class every model inherits from. SQLAlchemy collects every subclass's table definition onto `Base.metadata`; that's what Alembic diffs against the real database.
2. **`get_engine()`** — creates the SQLAlchemy *engine* (connection pool) lazily, once. Two details:
   - rewrites `postgresql://` → `postgresql+psycopg://` so SQLAlchemy uses the psycopg v3 driver;
   - `pool_pre_ping=True` tests pooled connections before use, because Neon kills idle connections when it scales to zero.
3. **`get_db()`** — a FastAPI *dependency* that yields one database session per request and guarantees it's closed afterwards, even if the request throws.

### `app/models.py` — the database tables (SQLAlchemy ORM)
Three classes = three tables. `Mapped[...]`/`mapped_column(...)` is modern SQLAlchemy 2.0 typing style.

- **`User`** — `id`, `email` (unique + indexed), `password_hash` (never the password itself), `display_name`, `created_at`.
- **`Subject`** — belongs to a user via `user_id` FK. `UniqueConstraint("user_id", "name")`: one user can't have two "DBMS" subjects, but two different users can. `ondelete="CASCADE"`: delete a user → their subjects go too.
- **`Topic`** — belongs to a subject via `subject_id` FK, same cascade + per-subject name uniqueness, plus `position` for ordering.

The `relationship(...)` attributes (`user.subjects`, `subject.topics`) are Python-side conveniences for navigating between objects; the FKs are what the database itself enforces.

### `app/schemas.py` — API request/response shapes (Pydantic)
Deliberately separate from `models.py`. The DB schema and the API contract are different things:
- `User` has `password_hash`; `UserOut` (what the API returns) has only `id`, `email`, `display_name`. The separation is what makes leaking the hash impossible.
- Request models carry validation: `EmailStr`, `Field(min_length=8)` for passwords, max lengths on names. FastAPI runs these checks before your code executes — invalid input never reaches the route function (client gets a 422).
- `model_config = ConfigDict(from_attributes=True)` lets a response model be built straight from an ORM object.
- `SubjectUpdate` / `TopicUpdate` have all-optional fields — that's what makes PATCH partial.

### `app/security.py` — passwords and tokens
- **`hash_password` / `verify_password`** — argon2id via pwdlib. Hashing is one-way and deliberately slow; the DB stores `$argon2id$...` strings. Login re-hashes the attempt and compares.
- **`create_access_token(user_id)`** — builds a JWT: payload `{"sub": "<user id>", "exp": <now + 7 days>}` signed with `SECRET_KEY`. A JWT is three base64 chunks: `header.payload.signature`. The payload is *readable* by anyone (it's just encoded, not encrypted) — the *signature* is what makes it unforgeable.
- **`decode_access_token(token)`** — verifies signature + expiry, returns the user id, raises on anything wrong.

### `app/deps.py` — reusable dependencies (FastAPI's dependency injection)
- **`oauth2_scheme`** — extracts the token from the `Authorization: Bearer <token>` header. Its `tokenUrl` is also what makes the "Authorize" button on `/docs` work.
- **`get_current_user`** — the auth gate: token → `decode_access_token` → load `User` from DB → return it, or 401. Any route that declares `user: CurrentUser` is automatically login-only. This is dependency injection: shared logic declared once, injected everywhere.
- **`DbSession` / `CurrentUser`** — `Annotated` type aliases so route signatures stay short.

### `app/routers/auth.py` — `/api/auth/*`
- **`POST /register`** — 409 if email exists, otherwise hash the password and insert. Returns `UserOut` (201).
- **`POST /login`** — takes an OAuth2 *form* (`username` + `password` fields, urlencoded — that's the standard; the email travels in `username`). Wrong email and wrong password return the *identical* 401 message so nobody can probe which emails are registered. Success returns `{"access_token": "...", "token_type": "bearer"}`.
- **`GET /me`** — returns the logged-in user. The frontend uses it on page load to turn a stored token back into a user.

### `app/routers/subjects.py` — `/api/subjects`
CRUD, always scoped to the logged-in user:
- **`get_owned_subject`** — the ownership helper: `WHERE id = :id AND user_id = :me`. Missing → **404, not 403** (403 would confirm the row exists — an information leak).
- **`GET ""`** — list with topic counts in one query: `LEFT JOIN topics … GROUP BY subjects.id` (LEFT JOIN so zero-topic subjects still appear).
- **`POST ""`** — create, with a friendly 409 on duplicate names.
- **`PATCH /{id}`** — partial update via `model_dump(exclude_unset=True)`: only fields the client actually sent are applied.
- **`DELETE /{id}`** — 204; topics vanish via the FK cascade.

### `app/routers/topics.py` — nested topic routes
- List/create live *under* a subject: `/api/subjects/{subject_id}/topics` — both verify subject ownership first.
- Update/delete address the topic directly: `/api/topics/{topic_id}` — ownership is checked with a JOIN up to subjects (`topic → subject → user`) in a single query, in `get_owned_topic`.
- Create assigns `position` = current topic count, so topics keep insertion order.

### `app/main.py` — the app object
Creates `FastAPI(...)`, adds **CORS middleware** (browsers block JS on `:5173` from calling `:8000` unless the API explicitly allows that origin — this is that allowance), includes the three routers, and keeps the two Phase-0 endpoints: `/api/health` (is the process up) and `/api/db-check` (can it reach Postgres — runs a real `SELECT version(), now()`).

### `alembic/` — migrations
Migrations = version control for your database schema. Every schema change is a dated script; any empty database can be replayed to the current schema with one command.

- **`alembic.ini`** — config; the DB URL line is deliberately commented out.
- **`env.py`** — customized twice: it pulls the URL from *our* `settings` (same `.env` as the app, one source of truth), and imports `app.models` so `Base.metadata` is populated — that's what `--autogenerate` diffs against the live DB.
- **`versions/4889…_baseline.py`** — empty first revision (a "the story starts here" marker).
- **`versions/dc94…_users_subjects_topics.py`** — autogenerated `CREATE TABLE`s for all three tables, with FKs, cascades, unique constraints, and a `downgrade()` that undoes it.

Commands: `alembic revision --autogenerate -m "…"` (write a new migration after changing models — then **read it before applying**), `alembic upgrade head` (apply pending migrations).

---

## Frontend (`frontend/`)

### Tooling files
- **`vite.config.ts`** — Vite dev server + build config; registers the React and Tailwind v4 plugins.
- **`tsconfig*.json`** — TypeScript compiler settings (strict mode on).
- **`index.html`** — the single page; React mounts into `<div id="root">`.
- **`src/main.tsx`** — entry point: `createRoot(...).render(<App />)`.
- **`src/index.css`** — one line, `@import "tailwindcss"`.

### `src/api.ts` — the only file that talks to the backend
Everything network-related funnels through here:

- **Token storage** — module-level `token` mirrored to `localStorage` (`setToken`/`hasToken`), so login survives page refreshes.
- **`request<T>(path, init)`** — the core helper: prefixes the base URL, attaches `Authorization: Bearer <token>` when present, throws a typed `ApiError` with the backend's `detail` message on failure. One special case: **401 while holding a token** means the token expired → clear it and hard-redirect to `/login` (401 with *no* token is just a wrong password on the login form, handled normally).
- **`postJson` / `patchJson`** — thin JSON wrappers over `request`.
- **Typed interfaces** (`User`, `Subject`, `Topic`, …) mirroring the backend's response schemas — TypeScript's compile-time contract with the API.
- **One exported function per endpooint** — `login()` is the only odd one: it sends `URLSearchParams` (form-encoded) because the OAuth2 password flow requires it, then stores the returned token.

Because every page imports from here, changing the API address at deploy time is a single environment variable (`VITE_API_URL`).

### `src/auth.tsx` — login state for the whole app (React Context)
- **`AuthProvider`** — owns `user` state. On mount, if a token exists in localStorage it calls `/me` to turn it back into a user; while that's in flight, `initializing` is true (prevents a flash-redirect to login on refresh). Exposes `signIn` (login + fetch `/me`) and `signOut` (drop token + user).
- **`useAuth()`** — hook any component uses to read the context; throws if used outside the provider (fail fast).
- **`RequireAuth`** — wrapper: still initializing → "Loading…", no user → `<Navigate to="/login" />`, else render children. Wrapping the layout route makes every page inside it login-only.

### `src/App.tsx` — routing
`react-router` route table:

| Path | Page | Protected? |
|---|---|---|
| `/login`, `/register` | auth forms | no |
| `/status` | Phase-0 health page | no |
| `/` | SubjectsPage (dashboard) | yes |
| `/subjects/:subjectId` | SubjectPage (topics) | yes |
| anything else | 404 page | no |

The protected routes nest inside `<RequireAuth><Layout /></RequireAuth>` — `Layout` renders the header (brand link, user name, sign out) and an `<Outlet />` where the child route appears.

### `src/components/PasswordInput.tsx`
Reusable password field with the Show/Hide toggle (a button that flips the input between `type="password"` and `type="text"`). Used by login and register — one implementation, consistent behavior.

### `src/pages/LoginPage.tsx` and `RegisterPage.tsx`
Controlled forms (every keystroke goes through React state), `busy` flag disables the button during the request, errors from `ApiError` render inline. Register also has the **confirm password** field: a live mismatch message and a disabled submit while the two fields differ, checked again on submit. On success, register calls `signIn` immediately — no "now go log in" dance.

### `src/pages/SubjectsPage.tsx` — the dashboard
- Loads subjects on mount (`useEffect` → `listSubjects`).
- Renders loading / error / **empty state** ("No subjects yet…") / a card grid.
- Each card: name, description, **topic count** (from the backend aggregate), ✎ edit, ✕ delete (with `confirm()` since it destroys topics too).
- **Inline editing**: one `draft` state object (`{id, name, description} | null`) decides which card renders as a mini-form with Save/Cancel. Save calls PATCH, swaps the updated subject into local state (keeping the topic count the PATCH response doesn't recompute).
- Create form appends the new subject to state — no page reload; the UI state *is* the source of truth between fetches.

### `src/pages/SubjectPage.tsx` — inside one subject
Reads `subjectId` from the URL (`useParams`), loads the subject and its topics **in parallel** with `Promise.all`, and offers the same patterns: list with empty state, add form, per-topic inline edit and delete.

### `src/pages/StatusPage.tsx`
The Phase-0 health dashboard, moved to `/status`: two cards showing API reachability and database connectivity, each with loading/ok/error states driven by a small `useLoad` hook (a `Loadable<T>` discriminated union — a very TypeScript way to make impossible UI states unrepresentable).

---

## Walkthrough: what actually happens when…

**…you register**
1. React validates passwords match locally → `POST /api/auth/register` with JSON.
2. FastAPI validates the shapes via `RegisterRequest` (bad email/short password → 422 before our code runs).
3. Route checks email uniqueness (409 if taken), argon2-hashes the password, INSERTs the user.
4. Frontend immediately calls `signIn` → next flow.

**…you log in**
1. `login()` sends form-encoded `username`/`password`.
2. Backend loads the user by email, `verify_password` re-hashes and compares.
3. Success → `create_access_token(user.id)` → signed JWT back to the client.
4. `setToken` stores it in localStorage; `/me` fetches the user; React state updates; router shows the dashboard.

**…you open the app tomorrow**
1. Token is still in localStorage. `AuthProvider` calls `/me` with it.
2. Valid → user state fills in, you're still logged in. Expired → 401 → `api.ts` clears the token and redirects to `/login`.

**…you click into a subject**
1. Router matches `/subjects/7`, renders `SubjectPage`, `useParams` gives `"7"`.
2. Two parallel requests: `GET /api/subjects/7` and `GET /api/subjects/7/topics`, both with the Bearer header.
3. Backend: `get_current_user` turns the token into you, then every query includes `user_id = you` — someone else's subject id returns 404 as if it didn't exist.

---

## Security decisions worth remembering (interview gold)

1. **Passwords are argon2id-hashed** — a DB leak doesn't reveal passwords.
2. **JWTs are signed, not encrypted** — never put secrets in the payload; the signature (via `SECRET_KEY`) is the security.
3. **Login errors don't distinguish** wrong-email from wrong-password — no email enumeration.
4. **Ownership uses 404, not 403** — don't confirm other people's resource ids exist.
5. **All real validation is server-side** — the browser is untrusted; frontend checks are UX only.
6. **Secrets live in `.env`**, which is gitignored; `.env.example` documents the shape.
