# Deploying GroundWork — The Complete Guide

Everything to take the app from `localhost` to a public URL, on free tiers.
Read Part 0 first — the mental model makes every later step obvious.

---

## Part 0 — What "deploying" means for this app

Locally you run three things; in production each gets a home:

| Piece | Locally | In production |
|---|---|---|
| Frontend (static JS/CSS after `npm run build`) | Vite dev server :5173 | **Vercel** (free) — serves the built files from a CDN |
| Backend (FastAPI process) | uvicorn :8000 | **Render** (free web service) — runs the Python process |
| Database | — | **Neon** — already in the cloud; nothing to do |
| Gemini | — | already a cloud API; nothing to do |

Only two of the four legs actually move. The work is: put the code on GitHub,
point Render and Vercel at it, set environment variables, and connect the two
with CORS + one URL.

---

## Part 1 — Prerequisites (10 min)

1. **A GitHub account** and the repo pushed to it:
   ```bash
   cd ~/dev/GroundWork
   git remote add origin https://github.com/<you>/groundwork.git
   git push -u origin main
   ```
   Sanity check before pushing: `git status` must NOT show `backend/.env` —
   it's gitignored; your secrets never leave your machine this way.
2. **Accounts** on render.com and vercel.com (sign in with GitHub — that also
   grants them repo access).
3. **Rotate your secrets** (they've been used in development):
   - Neon dashboard → your branch → *Reset password* → new `DATABASE_URL`.
   - Google AI Studio → new `GEMINI_API_KEY` (delete the old one).
   - New JWT key: `python3 -c "import secrets; print(secrets.token_hex(32))"`.
   Update your local `backend/.env` with all three; the same values go into
   Render in Part 2. (A new SECRET_KEY signs new tokens — everyone just logs
   in again.)

---

## Part 2 — Backend on Render (20 min)

1. Render dashboard → **New → Web Service** → connect the `groundwork` repo.
2. Settings:
   - **Root Directory**: `backend`
   - **Runtime**: Python 3
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**:
     ```
     uvicorn app.main:app --host 0.0.0.0 --port $PORT
     ```
     (`--host 0.0.0.0` = accept outside connections; `$PORT` = Render tells
     you which port to use. Forgetting either is the #1 "deploys but never
     responds" cause.)
   - **Instance Type**: Free
3. **Environment variables** (Render → Environment tab) — the production
   replacement for your `.env` file:

   | Key | Value |
   |---|---|
   | `DATABASE_URL` | the new Neon connection string |
   | `SECRET_KEY` | the new 64-char hex string |
   | `GEMINI_API_KEY` | the new Gemini key |
   | `GEMINI_API_KEY_FALLBACK` | second key (optional) |
   | `CORS_ORIGINS` | `["http://localhost:5173"]` for now — updated in Part 4 |
   | `PYTHON_VERSION` | `3.13.0` |

   pydantic-settings reads these exactly like the `.env` file — that's why we
   funneled all config through `config.py` from day one.
4. Click **Create Web Service** and watch the log: `pip install…` →
   `Application startup complete`. Your API is live at
   `https://groundwork-XXXX.onrender.com`.
5. **Migrations.** Your Neon database already has the schema (dev and prod
   share it in our setup, so nothing to run). For a *fresh* database, or to
   make future schema changes deploy automatically, set Render's
   **Pre-Deploy Command** to:
   ```
   alembic upgrade head
   ```
   This runs before each deploy goes live — new code never meets an old schema.
6. Verify: open `https://<your-app>.onrender.com/api/health` → should return
   `{"status":"ok","app":"groundwork"}`. Then `/docs` for the API console.

---

## Part 3 — Frontend on Vercel (10 min)

1. Vercel dashboard → **Add New → Project** → import the `groundwork` repo.
2. Settings:
   - **Root Directory**: `frontend`
   - Framework preset: **Vite** (auto-detected; build `npm run build`, output `dist`)
3. **Environment variable**:

   | Key | Value |
   |---|---|
   | `VITE_API_URL` | `https://<your-app>.onrender.com` (no trailing slash) |

   Vite bakes this in **at build time** (`import.meta.env.VITE_API_URL` in
   `api.ts`) — if you ever change it, you must redeploy, not just save.
4. Deploy. Your site is live at `https://groundwork-<something>.vercel.app`.
5. `frontend/vercel.json` (already in the repo) rewrites every path to
   `index.html` — without it, refreshing `/dashboard` would 404, because the
   server has no file called `dashboard`; React Router owns the paths.

---

## Part 4 — Connect the two (5 min, the step everyone forgets)

Right now the browser will block the frontend's API calls: the backend only
allows `localhost:5173`. Fix the loop:

1. Render → Environment → set:
   ```
   CORS_ORIGINS=["https://groundwork-<something>.vercel.app"]
   ```
   (JSON list syntax; you can include localhost too while developing:
   `["https://…vercel.app","http://localhost:5173"]`.)
2. Save → Render redeploys automatically.

---

## Part 5 — Verify end to end (10 min)

Work through this on the live URL — ideally from your **phone**, which proves
mobile + HTTPS + CORS in one pass:

- [ ] Landing page loads; wordmark merges to GW on scroll
- [ ] Register a fresh account (old dev accounts died with the SECRET_KEY change)
- [ ] Create subject → topic → upload a PDF → status flips to ready
- [ ] Open the document → viewer shows the PDF → ask it a question → answer with page chips
- [ ] Generate flashcards → pending banner → Keep all
- [ ] Review a card (Space / 1-4 work) → dashboard shows the review
- [ ] Take a quiz → score appears
- [ ] Sign out, sign back in

---

## Part 6 — Troubleshooting the classics

| Symptom | Cause → Fix |
|---|---|
| First request takes 30–60 s | Render free tier sleeps after ~15 min idle; the first hit wakes it. Normal. Optional: a free UptimeRobot monitor pinging `/api/health` every 10 min keeps it warm (uses your 750 free hours faster). |
| Browser console: "blocked by CORS policy" | `CORS_ORIGINS` doesn't exactly match the frontend origin (https, no trailing slash, exact subdomain). Fix the env var on Render. |
| Frontend loads, every API call 404s | `VITE_API_URL` wrong or missing at build time → redeploy on Vercel after fixing. |
| Refreshing any page 404s | `vercel.json` missing/not picked up (must be inside `frontend/`, the project root dir). |
| "Mixed content" errors | `VITE_API_URL` uses `http://` — must be `https://`. |
| Backend deploy fails on psycopg | Ensure `PYTHON_VERSION` env var is set (Render defaults can lag). |
| 500s mentioning SSL/connection on DB | Neon string must keep `?sslmode=require`; check `DATABASE_URL` was pasted whole. |
| Gemini calls fail in prod only | The env var name is `GEMINI_API_KEY` (check for typos/whitespace); remember you rotated it. |

---

## Part 7 — After it's live

1. **README**: add the live URL at the top, a screenshot/GIF, and the honest
   limitations list (Render cold starts, Gemini rate limits, no OCR).
2. **Auto-deploys are already on**: every `git push` to `main` redeploys both
   sides. That's your CD; Phase 7's remaining work is the CI in front of it
   (GitHub Actions running pytest + tsc + the groundedness evals before merge).
3. **Monitoring (free)**: UptimeRobot on `/api/health`; Sentry's free tier for
   error reporting if you want it.
4. **Custom domain** (optional): both Vercel and Render support one free;
   remember to update `CORS_ORIGINS` if the frontend domain changes.
5. Put the URL on your resume. A live link outperforms any description.
