import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Wordmark from "../components/Wordmark";

const DEMO_CARDS = [
  { q: "What is the convoy effect in FCFS scheduling?", a: "Short processes stuck behind one long CPU-bound process.", page: 3 },
  { q: "Which normal form removes partial dependencies?", a: "2NF — full dependency on the whole candidate key.", page: 12 },
  { q: "What are the four Coffman conditions?", a: "Mutual exclusion, hold & wait, no preemption, circular wait.", page: 7 },
];

/** 3D card stack: tilts toward the cursor, top card flips through real Q/As. */
function FloatingCards() {
  const ref = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    const t = setInterval(() => {
      setFlipped((f) => {
        if (f) setI((n) => (n + 1) % DEMO_CARDS.length);
        return !f;
      });
    }, 2600);
    return () => clearInterval(t);
  }, []);

  function onMove(e: React.MouseEvent) {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    setTilt({
      y: ((e.clientX - r.left) / r.width - 0.5) * 14,
      x: -((e.clientY - r.top) / r.height - 0.5) * 14,
    });
  }

  const card = DEMO_CARDS[i];
  const face =
    "absolute inset-0 flex flex-col justify-between rounded-2xl border border-zinc-700/80 bg-zinc-900/90 p-6 backdrop-blur [backface-visibility:hidden]";

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={() => setTilt({ x: 0, y: 0 })}
      className="relative mx-auto h-72 w-full max-w-md [perspective:1200px]"
    >
      <motion.div
        animate={{ rotateX: tilt.x, rotateY: tilt.y }}
        transition={{ type: "spring", stiffness: 120, damping: 16 }}
        className="relative h-full w-full [transform-style:preserve-3d]"
      >
        {/* back cards of the stack */}
        <div className="absolute inset-0 translate-x-6 translate-y-5 rotate-6 rounded-2xl border border-zinc-800 bg-zinc-900/50" />
        <div className="absolute inset-0 -translate-x-5 translate-y-3 -rotate-6 rounded-2xl border border-zinc-800 bg-zinc-900/70" />
        {/* flipping top card */}
        <motion.div
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={{ duration: 0.7, ease: [0.3, 0, 0.2, 1] }}
          className="relative h-full w-full [transform-style:preserve-3d]"
        >
          <div className={face}>
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Question</p>
            <p className="text-xl font-medium text-zinc-100">{card.q}</p>
            <p className="text-xs text-zinc-500">tap to flip · Groundwork</p>
          </div>
          <div className={`${face} [transform:rotateY(180deg)]`}>
            <p className="text-xs font-semibold uppercase tracking-widest text-violet-400">Answer</p>
            <p className="text-lg text-zinc-100">{card.a}</p>
            <p className="rounded-lg bg-violet-500/10 px-2 py-1 text-xs text-violet-300">
              📄 grounded in your PDF — page {card.page}
            </p>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}

const rise = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.55, ease: "easeOut" as const },
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-200">
      {/* sticky header with the merging wordmark */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-zinc-800/60 bg-zinc-950/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
          <Wordmark merge />
          <div className="flex items-center gap-3 text-sm">
            <Link to="/login" className="px-3 py-1.5 text-zinc-300 hover:text-zinc-100">
              Sign in
            </Link>
            <Link
              to="/register"
              className="rounded-lg bg-violet-500 px-4 py-1.5 font-medium text-white transition hover:bg-violet-400"
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      {/* hero */}
      <section className="relative overflow-hidden px-5 pt-36 pb-24">
        {/* glow + dot grid */}
        <div className="pointer-events-none absolute inset-0 [background-image:radial-gradient(circle_at_50%_-20%,rgba(139,92,246,0.25),transparent_60%),radial-gradient(rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:100%_100%,26px_26px]" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-2">
          <div>
            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
              className="font-display text-5xl leading-tight font-bold tracking-tight text-zinc-100 sm:text-6xl"
            >
              Study what you
              <br />
              <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                actually need to.
              </span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.12 }}
              className="mt-5 max-w-md text-lg text-zinc-400"
            >
              Upload your syllabus and readings. Groundwork turns them into notes,
              flashcards, and quizzes — every single one traceable to the exact
              passage it came from. Then it learns what you forget, and schedules it.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.24 }}
              className="mt-8 flex gap-3"
            >
              <Link
                to="/register"
                className="rounded-xl bg-violet-500 px-6 py-3 font-medium text-white transition hover:-translate-y-0.5 hover:bg-violet-400"
              >
                Start free
              </Link>
              <a
                href="#how"
                className="rounded-xl border border-zinc-700 px-6 py-3 font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-zinc-100"
              >
                How it works
              </a>
            </motion.div>
          </div>
          <FloatingCards />
        </div>
      </section>

      {/* how it works */}
      <section id="how" className="mx-auto max-w-6xl px-5 py-20">
        <motion.h2 {...rise} className="font-display text-3xl font-bold text-zinc-100">
          Three steps. No busywork.
        </motion.h2>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {[
            ["01", "Drop in your material", "PDFs, notes, anything. Groundwork extracts, cleans, and indexes every passage."],
            ["02", "Generate — with receipts", "AI writes notes, flashcards, and quizzes from your material only. Items that can't cite a source get rejected automatically."],
            ["03", "Review what's slipping", "A real SM-2 spaced-repetition engine schedules every card, and weak topics jump the queue."],
          ].map(([n, t, d]) => (
            <motion.div
              key={n}
              {...rise}
              className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 transition hover:border-violet-500/40 hover:bg-zinc-900"
            >
              <p className="font-display text-sm font-bold text-violet-400">{n}</p>
              <h3 className="mt-2 text-lg font-semibold text-zinc-100">{t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">{d}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* receipts section — the differentiator */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <motion.div {...rise}>
            <p className="text-sm font-semibold tracking-widest text-violet-400 uppercase">No hallucinations</p>
            <h2 className="mt-3 font-display text-3xl font-bold text-zinc-100">
              Every card shows its receipts.
            </h2>
            <p className="mt-4 max-w-md text-zinc-400">
              Other AI study tools generate from thin air. Groundwork retrieves the
              relevant passages from <em>your</em> uploads, forces the AI to cite them,
              rejects anything it can't verify — and lets you read the exact source,
              page number included.
            </p>
          </motion.div>
          <motion.div {...rise} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
            <p className="font-medium text-zinc-100">Q: Which algorithm suffers from the convoy effect?</p>
            <p className="mt-1 text-sm text-zinc-400">A: FCFS — short processes queue behind a long one.</p>
            <div className="mt-4 rounded-lg border-l-2 border-violet-500 bg-zinc-950 p-3">
              <p className="text-[11px] font-semibold tracking-wide text-zinc-500 uppercase">Source · page 3</p>
              <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                "…the convoy effect, in which all other processes wait for one big
                process to release the CPU…"
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* SM-2 section */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <motion.div {...rise} className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-8">
          <h2 className="font-display text-3xl font-bold text-zinc-100">Forget forgetting.</h2>
          <p className="mt-3 max-w-lg text-zinc-400">
            Rate a card once and SM-2 schedules its future: easy cards drift away,
            hard ones come back fast. Intervals grow like this —
          </p>
          <div className="mt-6 flex items-end gap-3">
            {[["1d", 10], ["6d", 34], ["15d", 58], ["38d", 96]].map(([label, h]) => (
              <motion.div
                key={label}
                initial={{ height: 0 }}
                whileInView={{ height: Number(h) }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="flex w-16 flex-col justify-end rounded-t-lg bg-gradient-to-t from-violet-600/40 to-violet-400"
              >
                <span className="pb-1 text-center text-xs font-semibold text-white">{label}</span>
              </motion.div>
            ))}
            <p className="pb-1 text-xs text-zinc-500">…next review dates for one card rated "Good"</p>
          </div>
        </motion.div>
      </section>

      {/* CTA */}
      <section className="px-5 py-24 text-center">
        <motion.h2 {...rise} className="font-display text-4xl font-bold text-zinc-100">
          Lay the <span className="text-violet-400">groundwork</span> tonight.
        </motion.h2>
        <motion.div {...rise} className="mt-8">
          <Link
            to="/register"
            className="rounded-xl bg-violet-500 px-8 py-4 text-lg font-medium text-white transition hover:-translate-y-0.5 hover:bg-violet-400"
          >
            Create your free account
          </Link>
        </motion.div>
        <p className="mt-16 text-xs text-zinc-600">
          Groundwork — a grounded-AI study tool. Built by Chaitanya Pareek.
        </p>
      </section>
    </div>
  );
}
