import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Wordmark from "../components/Wordmark";

const DEMO_CARDS = [
  { q: "What is the convoy effect in FCFS scheduling?", a: "Short processes stuck waiting behind one long CPU-bound process.", page: 3 },
  { q: "Which normal form removes partial dependencies?", a: "2NF — full dependency on the whole candidate key.", page: 12 },
  { q: "What are the four Coffman conditions?", a: "Mutual exclusion, hold & wait, no preemption, circular wait.", page: 7 },
];

/** The hero object: a real index card on the desk. Tilts toward the cursor,
 *  flips through actual Q/As, cites its page like a footnote. */
function IndexCardStack() {
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
    }, 2800);
    return () => clearInterval(t);
  }, []);

  function onMove(e: React.MouseEvent) {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    setTilt({
      y: ((e.clientX - r.left) / r.width - 0.5) * 10,
      x: -((e.clientY - r.top) / r.height - 0.5) * 10,
    });
  }

  const card = DEMO_CARDS[i];
  const face =
    "ruled absolute inset-0 flex flex-col rounded-lg bg-card p-6 pt-3 text-ink shadow-[0_18px_50px_rgba(0,0,0,0.55)] [backface-visibility:hidden]";

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={() => setTilt({ x: 0, y: 0 })}
      className="relative mx-auto aspect-[5/3] w-full max-w-md [perspective:1200px]"
    >
      <motion.div
        animate={{ rotateX: tilt.x, rotateY: tilt.y }}
        transition={{ type: "spring", stiffness: 120, damping: 16 }}
        className="relative h-full w-full [transform-style:preserve-3d]"
      >
        {/* the rest of the deck */}
        <div className="absolute inset-0 translate-x-4 translate-y-4 rotate-3 rounded-lg bg-[#e9e2d2]" />
        <div className="absolute inset-0 -translate-x-3 translate-y-2 -rotate-2 rounded-lg bg-[#efe9da]" />
        <motion.div
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={{ duration: 0.65, ease: [0.3, 0, 0.2, 1] }}
          className="relative h-full w-full [transform-style:preserve-3d]"
        >
          <div className={face}>
            <p className="font-mono text-[11px] tracking-wide text-[#a89f8c] uppercase">Q</p>
            <p className="mt-3 font-display text-xl leading-snug font-semibold">{card.q}</p>
          </div>
          <div className={`${face} [transform:rotateY(180deg)]`}>
            <p className="font-mono text-[11px] tracking-wide text-[#a89f8c] uppercase">A</p>
            <p className="mt-3 text-lg leading-snug">{card.a}</p>
            <p className="mt-auto self-start rounded border border-[#d8d0bd] bg-[#efe9da] px-2 py-0.5 font-mono text-[11px] text-[#6b6350]">
              source: your PDF, p.{card.page}
            </p>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}

const rise = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.5, ease: "easeOut" as const },
};

const STEPS = [
  ["Upload the reading", "Drop in lecture PDFs or notes. GroundWork reads them page by page and builds an index of every passage."],
  ["Generate with receipts", "It writes notes, flashcards, and quizzes from your material only. Anything it can't back with a citation gets thrown out before you see it."],
  ["Review what slips", "A real spaced-repetition scheduler decides when each card returns. Topics you keep missing move to the front."],
] as const;

export default function LandingPage() {
  return (
    <div className="min-h-screen text-chalk">
      {/* header with the merging wordmark */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-edge bg-desk/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
          <Wordmark merge />
          <div className="flex items-center gap-3 text-sm">
            <Link to="/login" className="px-3 py-1.5 text-dust transition hover:text-card">
              Sign in
            </Link>
            <Link to="/register" className="btn-marker px-4 py-1.5 text-sm">
              Get started
            </Link>
          </div>
        </div>
      </header>

      {/* hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-14 px-5 pt-32 pb-20 sm:pt-40 lg:grid-cols-2">
        <div>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="font-mono text-xs tracking-[0.2em] text-dust uppercase"
          >
            For students who study from real material
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.08 }}
            className="mt-4 font-display text-[2.6rem] leading-[1.08] font-bold tracking-tight text-card sm:text-6xl"
          >
            Flashcards with <span className="mark rounded-sm">receipts.</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.18 }}
            className="mt-5 max-w-md text-lg leading-relaxed text-dust"
          >
            Upload your reading. GroundWork writes the cards, cites the exact page,
            and schedules every review — nothing invented, everything from your
            own material.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.28 }}
            className="mt-8 flex flex-wrap items-center gap-3"
          >
            <Link to="/register" className="btn-marker px-6 py-3">
              Start studying free
            </Link>
            <a href="#how" className="btn-quiet px-6 py-3">
              How it works
            </a>
          </motion.div>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-6 font-mono text-xs text-dust/80"
          >
            no card without a citation
          </motion.p>
        </div>
        <IndexCardStack />
      </section>

      {/* how it works — a real sequence, so numbers mean something */}
      <section id="how" className="mx-auto max-w-6xl px-5 py-16">
        <motion.h2 {...rise} className="font-display text-3xl font-bold text-card">
          Three steps, then it runs itself
        </motion.h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {STEPS.map(([title, body], idx) => (
            <motion.div key={title} {...rise} className="panel p-6">
              <p className="font-mono text-xs text-dust">step {idx + 1} of 3</p>
              <h3 className="mt-2 font-display text-lg font-semibold text-card">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-dust">{body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* the differentiator */}
      <section className="mx-auto max-w-6xl px-5 py-16">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <motion.div {...rise}>
            <h2 className="font-display text-3xl font-bold text-card">
              Ask it anything.
              <br />
              It answers <span className="mark rounded-sm">from the page.</span>
            </h2>
            <p className="mt-4 max-w-md leading-relaxed text-dust">
              Most AI study tools answer from thin air. GroundWork retrieves the
              relevant passages from your uploads, refuses to go beyond them, and
              pins a page reference on every card, note, and answer — so you can
              always check its work.
            </p>
          </motion.div>
          <motion.div {...rise} className="panel p-6">
            <p className="font-mono text-xs text-dust">from a real study session</p>
            <p className="mt-3 font-medium text-card">
              Which algorithm suffers from the convoy effect?
            </p>
            <p className="mt-2 text-sm leading-relaxed text-dust">
              FCFS — short processes pile up behind one long CPU-bound process,
              inflating average waiting time.
            </p>
            <blockquote className="mt-4 border-l-2 border-rule pl-3">
              <p className="font-mono text-[11px] text-dust/80 uppercase">source · page 3</p>
              <p className="mt-1 text-xs leading-relaxed text-dust">
                "…the convoy effect, in which all other processes wait for one big
                process to release the CPU…"
              </p>
            </blockquote>
          </motion.div>
        </div>
      </section>

      {/* spaced repetition */}
      <section className="mx-auto max-w-6xl px-5 py-16">
        <motion.div {...rise} className="panel p-8">
          <h2 className="font-display text-3xl font-bold text-card">
            Reviewed today. Then in 6 days. Then 15.
          </h2>
          <p className="mt-3 max-w-lg leading-relaxed text-dust">
            Rate a card once and the scheduler plans its future: easy cards drift
            out for weeks, hard ones come back tomorrow. Miss quiz questions on a
            topic and its whole queue moves up.
          </p>
          <div className="mt-6 flex items-end gap-3">
            {[["1d", 12], ["6d", 36], ["15d", 60], ["38d", 96]].map(([label, h]) => (
              <motion.div
                key={label}
                initial={{ height: 0 }}
                whileInView={{ height: Number(h) }}
                viewport={{ once: true }}
                transition={{ duration: 0.55, ease: "easeOut" }}
                className="flex w-14 flex-col justify-end rounded-t bg-marker"
              >
                <span className="pb-1 text-center font-mono text-xs font-medium text-ink">{label}</span>
              </motion.div>
            ))}
            <p className="pb-1 font-mono text-xs text-dust/80">one card, rated "Good" four times</p>
          </div>
        </motion.div>
      </section>

      {/* CTA */}
      <section className="px-5 py-24 text-center">
        <motion.h2 {...rise} className="font-display text-4xl font-bold text-card">
          Lay the <span className="mark rounded-sm">groundwork</span> tonight.
        </motion.h2>
        <motion.div {...rise} className="mt-8">
          <Link to="/register" className="btn-marker px-8 py-4 text-lg">
            Create your free account
          </Link>
        </motion.div>
        <p className="mt-16 font-mono text-xs text-dust/70">
          GroundWork — study from your own pages. Built by Chaitanya Pareek.
        </p>
      </section>
    </div>
  );
}
