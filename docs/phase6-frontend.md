# Phase 6 — Frontend Design Plan

Goal: Groundwork stops looking like a dev tool and becomes a product you'd screenshot.
Inspirations studied: **turbo.ai** (playful energy, bold hero, animated demos),
**revisely.com** (clean edu-SaaS structure, feature storytelling), **remnote.com**
(calm focus, knowledge-tool credibility). We borrow structure from them — not colors.

---

## 1. Visual identity — "the warm library, not the robot lab"

No default-Tailwind indigo/slate. The brand is *grounded*: paper, ink, warm light.

| Token | Value | Use |
|---|---|---|
| `paper` | `#FAF7F0` warm cream | app + landing background |
| `ink` | `#1C1917` near-black warm | headings, primary text |
| `pine` | `#1B4D3E` deep green | primary actions, brand |
| `pine-soft` | `#E8F0EC` | tints, hovers, selected states |
| `marigold` | `#E8A33D` | accent: highlights, streaks, hero details |
| `terracotta` | `#C65D3B` | destructive / "weak topic" warmth (not alarm-red) |
| `mist` | `#8A8577` warm gray | secondary text, borders `#E7E2D8` |

Typography: **Fraunces** (serif, display — headlines get character) + **Inter**
(UI text). Big type scale on landing; compact scale in-app.
Texture: subtle paper grain on landing hero; soft long shadows; 16px radius cards.
Dark mode: deferred to end of phase (nice-to-have).

## 2. Landing page (pre-login, route `/` for logged-out users)

Structure (single scroll, ~5 sections), *everything moves gently*:

1. **Hero** — huge Fraunces headline ("Study what you actually need to."),
   sub-line, CTA pair (Start free / See how it works). Behind it: a **3D floating
   flashcard stack** — CSS 3D (perspective + rotateX/Y) cards that tilt toward the
   cursor and slowly flip one by one showing real Q/A pairs; floating gradient
   blobs (pine→marigold) drifting on long keyframes. No three.js — CSS 3D keeps
   the bundle tiny and still looks premium.
2. **Live demo strip** — an auto-playing fake UI: a PDF page morphs into chunks →
   a flashcard → a quiz question answering itself, on loop (framer-motion timeline).
3. **Trust section (our differentiator)** — "Every card shows its receipts":
   mock flashcard with its source passage expanding, page number glowing. This is
   what turbo.ai *doesn't* have — lead with it.
4. **Method section** — SM-2 intervals visualized as growing arcs (1d → 6d → 15d),
   weakness dashboard screenshot in a tilted browser frame.
5. **CTA footer** — big, warm, one button.

Motion rules: scroll-reveal (fade+rise 12px), marquee of subject chips, all
respecting `prefers-reduced-motion`. Lib: **framer-motion** only.

## 3. Logged-in app

- Logged-in `/` → **Dashboard** becomes home. Landing only for visitors.
- **App shell**: left sidebar (Dashboard, Subjects, Review, + subject tree),
  cream background, pine active states. Mobile: bottom tab bar.
- **Review screen = flagship**: full-focus mode (shell hides), card flip 3D
  animation, keyboard shortcuts (Space = flip, 1–4 = rate), session progress arc,
  end-of-session stats (cards done, streak).
- **Skeleton loaders** replace every "Loading…" text.
- **Empty states** get illustrations + a clear next action.
- **Settings page**: display name, change password, danger zone (delete account).
- Responsive audit: every screen usable one-handed at 375px.

## 4. Build order (each step ships)

1. Design tokens + fonts + restyle existing components (buttons, cards, inputs)
2. App shell (sidebar/bottom-bar) + dashboard-as-home routing
3. Landing page (hero → sections)
4. Review focus mode + keyboard shortcuts + flip animation
5. Skeletons, empty states, settings page, mobile pass
6. (stretch) dark mode

Definition of done: landing page makes someone *want* the product; app is fully
usable on a phone; zero default-indigo left.
