import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  ApiError,
  createSubject,
  deleteSubject,
  listSubjects,
  updateSubject,
  type Subject,
} from "../api";

interface Draft {
  id: number;
  name: string;
  description: string;
}

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<Subject[] | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null); // which card is being edited
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listSubjects().then(setSubjects).catch((e: Error) => setError(e.message));
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const subject = await createSubject(name.trim(), description.trim());
      setSubjects((prev) => [...(prev ?? []), subject]);
      setName("");
      setDescription("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reach the server");
    }
  }

  async function onDelete(id: number) {
    if (!confirm("Delete this subject and all its topics?")) return;
    await deleteSubject(id);
    setSubjects((prev) => (prev ?? []).filter((s) => s.id !== id));
  }

  async function onSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setError(null);
    try {
      const updated = await updateSubject(draft.id, {
        name: draft.name.trim(),
        description: draft.description.trim(),
      });
      setSubjects((prev) =>
        (prev ?? []).map((s) =>
          // PATCH response doesn't recount topics; keep the count we had
          s.id === updated.id ? { ...updated, topic_count: s.topic_count } : s,
        ),
      );
      setDraft(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reach the server");
    }
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-4 text-xl font-semibold text-zinc-100">Your subjects</h2>
        {subjects === null && !error && <p className="text-zinc-400">Loading…</p>}
        {error && <p className="mb-3 text-sm text-rose-400">{error}</p>}
        {subjects !== null && subjects.length === 0 && (
          <p className="rounded-lg border border-dashed border-zinc-700 p-6 text-center text-zinc-400">
            No subjects yet — create your first one below.
          </p>
        )}
        <ul className="grid gap-4 sm:grid-cols-2">
          {(subjects ?? []).map((s) => (
            <li
              key={s.id}
              className="group rounded-xl border border-zinc-800 bg-zinc-900 p-5 shadow-sm transition hover:border-violet-500/50"
            >
              {draft?.id === s.id ? (
                <form onSubmit={onSaveEdit} className="space-y-2">
                  <input
                    required
                    maxLength={200}
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    className="w-full rounded-lg border border-zinc-700 px-3 py-1.5 focus:border-violet-500 focus:outline-none"
                  />
                  <input
                    maxLength={2000}
                    placeholder="Description (optional)"
                    value={draft.description}
                    onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                    className="w-full rounded-lg border border-zinc-700 px-3 py-1.5 focus:border-violet-500 focus:outline-none"
                  />
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="rounded-lg bg-violet-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-400"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setDraft(null)}
                      className="rounded-lg px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-100"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex items-start justify-between gap-2">
                  <Link to={`/subjects/${s.id}`} className="min-w-0 flex-1">
                    <h3 className="truncate font-semibold text-zinc-100 group-hover:text-violet-300">
                      {s.name}
                    </h3>
                    {s.description && (
                      <p className="mt-1 line-clamp-2 text-sm text-zinc-400">{s.description}</p>
                    )}
                    <p className="mt-2 text-xs font-medium text-zinc-500">
                      {s.topic_count} {s.topic_count === 1 ? "topic" : "topics"}
                    </p>
                  </Link>
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        setDraft({ id: s.id, name: s.name, description: s.description })
                      }
                      className="text-sm text-zinc-500 hover:text-violet-300"
                      title="Edit subject"
                    >
                      ✎
                    </button>
                    <button
                      onClick={() => onDelete(s.id)}
                      className="text-sm text-zinc-500 hover:text-rose-400"
                      title="Delete subject"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="max-w-md">
        <h2 className="mb-4 text-xl font-semibold text-zinc-100">Add a subject</h2>
        <form onSubmit={onCreate} className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900 p-5 shadow-sm">
          <input
            required
            maxLength={200}
            placeholder="Subject name, e.g. Operating Systems"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-zinc-700 px-3 py-2 focus:border-violet-500 focus:outline-none"
          />
          <input
            maxLength={2000}
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-lg border border-zinc-700 px-3 py-2 focus:border-violet-500 focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-lg bg-violet-500 px-4 py-2 font-medium text-white hover:bg-violet-400"
          >
            Add subject
          </button>
        </form>
      </section>
    </div>
  );
}
