import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchReviewQueue, reviewFlashcard, type QueueCard } from "../api";

const RATINGS: { value: 1 | 2 | 3 | 4; label: string; key: string; classes: string }[] = [
  { value: 1, label: "Again", key: "1", classes: "bg-[#b14a3e] text-white hover:bg-[#c25546]" },
  { value: 2, label: "Hard", key: "2", classes: "bg-[#c9973a] text-ink hover:bg-[#d8a94e]" },
  { value: 3, label: "Good", key: "3", classes: "bg-[#4c7a4f] text-white hover:bg-[#5b8f5e]" },
  { value: 4, label: "Easy", key: "4", classes: "bg-[#4a6d8c] text-ink hover:bg-[#557da0]" },
];

export default function ReviewPage() {
  const [queue, setQueue] = useState<QueueCard[] | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [done, setDone] = useState(0);

  useEffect(() => {
    fetchReviewQueue().then(setQueue);
  }, []);

  const card = queue?.[0] ?? null;

  const rate = useCallback(
    async (rating: 1 | 2 | 3 | 4) => {
      if (!card) return;
      await reviewFlashcard(card.id, rating);
      setQueue((prev) => (prev ?? []).slice(1));
      setRevealed(false);
      setDone((n) => n + 1);
    },
    [card],
  );

  // keyboard: space flips, 1-4 rates
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === "Space") {
        e.preventDefault();
        setRevealed(true);
      } else if (revealed && ["1", "2", "3", "4"].includes(e.key)) {
        rate(Number(e.key) as 1 | 2 | 3 | 4);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [revealed, rate]);

  if (queue === null) {
    return <p className="text-dust">Loading your review queue…</p>;
  }

  if (!card) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h2 className="font-display text-2xl font-semibold text-ink">
          {done > 0 ? `${done} card${done === 1 ? "" : "s"} reviewed.` : "Nothing due right now."}
        </h2>
        <p className="mt-2 text-dust">
          Cards come back when the schedule says so. Add more from any topic's
          Flashcards tab.
        </p>
        <Link to="/dashboard" className="mt-4 inline-block font-medium text-blue hover:underline">
          Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-3 flex items-baseline justify-between">
        <p className="font-mono text-xs text-dust">
          {queue.length} left · {card.subject_name} / {card.topic_name}
        </p>
        {done > 0 && <p className="font-mono text-xs text-dust/70">{done} done</p>}
      </div>

      {/* the index card */}
      <div className="ruled min-h-64 rounded-lg bg-card p-7 pt-4 text-ink shadow-[0_14px_36px_rgba(23,39,59,0.14)]">
        <p className="font-mono text-[11px] tracking-wide text-[#9AA6B8] uppercase">Q</p>
        <p className="mt-3 font-display text-xl leading-relaxed font-semibold whitespace-pre-wrap">
          {card.front}
        </p>

        {revealed && (
          <>
            <p className="mt-6 font-mono text-[11px] tracking-wide text-[#9AA6B8] uppercase">A</p>
            <p className="mt-2 text-lg leading-relaxed whitespace-pre-wrap">{card.back}</p>
          </>
        )}
      </div>

      <div className="mt-6">
        {!revealed ? (
          <button onClick={() => setRevealed(true)} className="btn-marker w-full py-3">
            Show answer
          </button>
        ) : (
          <div className="grid grid-cols-4 gap-3">
            {RATINGS.map((r) => (
              <button
                key={r.value}
                onClick={() => rate(r.value)}
                className={`rounded-lg py-3 font-semibold transition ${r.classes}`}
              >
                {r.label}
                <span className="ml-1.5 hidden font-mono text-xs opacity-60 sm:inline">{r.key}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <p className="mt-3 text-center font-mono text-xs text-dust/70">
        space to flip · 1–4 to rate · Again = forgot, Easy = instant
      </p>
    </div>
  );
}
