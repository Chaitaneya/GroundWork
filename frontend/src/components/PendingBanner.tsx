import { acceptAllPending, discardAllPending, type GenerationKind } from "../api";

/** One-click bulk review for AI-generated items (the standard low-friction
 *  companion to per-item accept/discard). */
export default function PendingBanner({
  topicId,
  kind,
  count,
  label,
  onChanged,
}: {
  topicId: number;
  kind: GenerationKind;
  count: number;
  label: string; // e.g. "flashcards"
  onChanged: () => void;
}) {
  if (count === 0) return null;

  async function keepAll() {
    await acceptAllPending(topicId, kind);
    onChanged();
  }

  async function discardAll() {
    if (!confirm(`Discard all ${count} AI-generated ${label}?`)) return;
    await discardAllPending(topicId, kind);
    onChanged();
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
      <p className="text-sm text-amber-900">
        <span className="font-semibold">{count}</span> AI-generated {label} awaiting review —
        check them below, or handle them all at once.
      </p>
      <div className="flex gap-2">
        <button
          onClick={keepAll}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
        >
          Keep all
        </button>
        <button
          onClick={discardAll}
          className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-rose-600 ring-1 ring-rose-200 hover:bg-rose-50"
        >
          Discard all
        </button>
      </div>
    </div>
  );
}
