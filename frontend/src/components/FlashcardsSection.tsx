import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  acceptFlashcard,
  ApiError,
  createFlashcard,
  deleteFlashcard,
  fetchFlashcardSources,
  listFlashcards,
  updateFlashcard,
  type Flashcard,
} from "../api";
import GenerateBar from "./GenerateBar";
import SourcesView from "./SourcesView";

function dueLabel(card: Flashcard): string {
  if (card.suspended) return "suspended";
  const due = new Date(card.due_at).getTime();
  const now = Date.now();
  if (due <= now) return "due now";
  const days = (due - now) / 86_400_000;
  if (days < 1) return `due in ${Math.max(1, Math.round(days * 24))}h`;
  return `due in ${Math.round(days)}d`;
}

export default function FlashcardsSection({ topicId }: { topicId: number }) {
  const [cards, setCards] = useState<Flashcard[] | null>(null);
  const [editing, setEditing] = useState<{ id: number; front: string; back: string } | null>(null);
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    () => listFlashcards(topicId).then(setCards).catch((e: Error) => setError(e.message)),
    [topicId],
  );
  useEffect(() => {
    load();
  }, [load]);

  async function onAccept(id: number) {
    await acceptFlashcard(id);
    setCards((prev) => (prev ?? []).map((c) => (c.id === id ? { ...c, pending: false } : c)));
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const card = await createFlashcard(topicId, front.trim(), back.trim());
      setCards((prev) => [...(prev ?? []), card]);
      setFront("");
      setBack("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reach the server");
    }
  }

  async function onSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const updated = await updateFlashcard(editing.id, {
      front: editing.front.trim(),
      back: editing.back.trim(),
    });
    setCards((prev) => (prev ?? []).map((c) => (c.id === updated.id ? updated : c)));
    setEditing(null);
  }

  async function onDelete(id: number) {
    if (!confirm("Delete this flashcard and its review history?")) return;
    await deleteFlashcard(id);
    setCards((prev) => (prev ?? []).filter((c) => c.id !== id));
  }

  return (
    <div className="space-y-6">
      <GenerateBar topicId={topicId} kind="flashcards" onDone={load} />
      {cards === null && <p className="text-slate-500">Loading…</p>}
      {cards !== null && cards.length === 0 && (
        <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-slate-500">
          No flashcards yet — add one below, then review it from the Review page.
        </p>
      )}
      <ul className="space-y-2">
        {(cards ?? []).map((c) => (
          <li
            key={c.id}
            className={`rounded-lg border bg-white px-4 py-3 shadow-sm ${
              c.pending ? "border-amber-300 bg-amber-50/40" : "border-slate-200"
            }`}
          >
            {editing?.id === c.id ? (
              <form onSubmit={onSaveEdit} className="space-y-2">
                <textarea
                  required
                  rows={2}
                  value={editing.front}
                  onChange={(e) => setEditing({ ...editing, front: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
                />
                <textarea
                  required
                  rows={2}
                  value={editing.back}
                  onChange={(e) => setEditing({ ...editing, back: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
                />
                <div className="flex gap-2">
                  <button type="submit" className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700">
                    Save
                  </button>
                  <button type="button" onClick={() => setEditing(null)} className="px-3 py-1.5 text-sm text-slate-500 hover:text-slate-900">
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-1">
                  {c.pending && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                      AI-generated — awaiting your review
                    </span>
                  )}
                  <p className="font-medium text-slate-900">{c.front}</p>
                  <p className="text-sm text-slate-500">{c.back}</p>
                  <p className="text-xs text-slate-400">
                    {dueLabel(c)} · ease {c.ease_factor.toFixed(2)} · {c.repetitions} reps
                    {c.lapses > 0 && ` · ${c.lapses} lapses`}
                  </p>
                  {c.origin === "ai" && (
                    <SourcesView fetch={() => fetchFlashcardSources(c.id)} />
                  )}
                  {c.pending && (
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => onAccept(c.id)}
                        className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => onDelete(c.id)}
                        className="rounded-lg bg-white px-3 py-1 text-xs font-medium text-rose-600 ring-1 ring-rose-200 hover:bg-rose-50"
                      >
                        Discard
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => setEditing({ id: c.id, front: c.front, back: c.back })}
                    className="text-sm text-slate-400 hover:text-indigo-600"
                    title="Edit card"
                  >
                    ✎
                  </button>
                  <button onClick={() => onDelete(c.id)} className="text-sm text-slate-400 hover:text-rose-600" title="Delete card">
                    ✕
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>

      <form onSubmit={onCreate} className="max-w-xl space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h4 className="font-semibold text-slate-900">Add a flashcard</h4>
        <textarea
          required
          rows={2}
          maxLength={5000}
          placeholder="Front — the question or prompt"
          value={front}
          onChange={(e) => setFront(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        />
        <textarea
          required
          rows={2}
          maxLength={5000}
          placeholder="Back — the answer"
          value={back}
          onChange={(e) => setBack(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        />
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700">
          Add card
        </button>
      </form>
    </div>
  );
}
