import { useState } from "react";
import type { Chunk } from "../api";

/** Expandable "show sources" affordance for AI-generated items — renders the
 *  exact chunks (with page numbers) the item was derived from. */
export default function SourcesView({ fetch }: { fetch: () => Promise<Chunk[]> }) {
  const [chunks, setChunks] = useState<Chunk[] | null>(null);
  const [open, setOpen] = useState(false);

  async function toggle() {
    if (!open && chunks === null) setChunks(await fetch());
    setOpen(!open);
  }

  return (
    <div>
      <button
        onClick={toggle}
        className="text-xs font-medium text-marker hover:underline"
      >
        {open ? "Hide sources" : "Show sources"}
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          {chunks === null && <p className="text-xs text-dust">Loading…</p>}
          {chunks !== null && chunks.length === 0 && (
            <p className="text-xs text-dust">No source records.</p>
          )}
          {(chunks ?? []).map((c) => (
            <blockquote
              key={c.id}
              className="rounded-lg border-l-2 border-marker/40 bg-transparent px-3 py-2"
            >
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-dust/80">
                Source · page {c.page_number}
              </p>
              <p className="whitespace-pre-wrap text-xs leading-relaxed text-dust">
                {c.content}
              </p>
            </blockquote>
          ))}
        </div>
      )}
    </div>
  );
}
