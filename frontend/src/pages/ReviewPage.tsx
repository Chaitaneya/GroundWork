import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchReviewQueue, reviewFlashcard, type QueueCard } from "../api";

const RATINGS: { value: 1 | 2 | 3 | 4; label: string; classes: string }[] = [
  { value: 1, label: "Again", classes: "bg-rose-600 hover:bg-rose-500" },
  { value: 2, label: "Hard", classes: "bg-amber-500 hover:bg-amber-600" },
  { value: 3, label: "Good", classes: "bg-emerald-600 hover:bg-emerald-500" },
  { value: 4, label: "Easy", classes: "bg-sky-600 hover:bg-sky-700" },
];

export default function ReviewPage() {
  const [queue, setQueue] = useState<QueueCard[] | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [done, setDone] = useState(0);

  useEffect(() => {
    fetchReviewQueue().then(setQueue);
  }, []);

  const card = queue?.[0] ?? null;

  async function rate(rating: 1 | 2 | 3 | 4) {
    if (!card) return;
    await reviewFlashcard(card.id, rating);
    // "Again" makes the card due in ~10 min, so it naturally reappears if
    // you refetch later — within this session we just move to the next one.
    setQueue((prev) => (prev ?? []).slice(1));
    setRevealed(false);
    setDone((n) => n + 1);
  }

  if (queue === null) {
    return <p className="text-slate-400">Loading your review queue…</p>;
  }

  if (!card) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h2 className="mt-3 text-xl font-semibold text-slate-100">
          {done > 0 ? `Nice — ${done} card${done === 1 ? "" : "s"} reviewed.` : "Nothing due right now."}
        </h2>
        <p className="mt-2 text-slate-400">
          Cards come back when SM-2 schedules them. Add more from any topic's Flashcards tab.
        </p>
        <Link to="/dashboard" className="mt-4 inline-block font-medium text-teal-300 hover:underline">
          ← Back to subjects
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl">
      <p className="mb-3 text-sm text-slate-400">
        {queue.length} card{queue.length === 1 ? "" : "s"} left · {card.subject_name} / {card.topic_name}
      </p>

      <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Front</p>
        <p className="mt-2 whitespace-pre-wrap text-lg text-slate-100">{card.front}</p>

        {revealed && (
          <>
            <hr className="my-6 border-white/10" />
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Back</p>
            <p className="mt-2 whitespace-pre-wrap text-lg text-slate-100">{card.back}</p>
          </>
        )}
      </div>

      <div className="mt-6">
        {!revealed ? (
          <button
            onClick={() => setRevealed(true)}
            className="w-full rounded-xl bg-gradient-to-r from-teal-400 to-cyan-400 py-3 font-medium text-white hover:brightness-110"
          >
            Show answer
          </button>
        ) : (
          <div className="grid grid-cols-4 gap-3">
            {RATINGS.map((r) => (
              <button
                key={r.value}
                onClick={() => rate(r.value)}
                className={`rounded-xl py-3 font-medium text-white ${r.classes}`}
              >
                {r.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <p className="mt-3 text-center text-xs text-slate-500">
        Again = forgot · Hard = barely · Good = remembered · Easy = instant
      </p>
    </div>
  );
}
