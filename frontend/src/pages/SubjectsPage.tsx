import { useEffect, useState, type FormEvent } from "react";
import { PencilIcon, XIcon } from "../components/icons";
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
        <h2 className="mb-4 text-xl font-semibold text-ink">Your subjects</h2>
        {subjects === null && !error && <p className="text-dust">Loading…</p>}
        {error && <p className="mb-3 text-sm text-[#B4231F]">{error}</p>}
        {subjects !== null && subjects.length === 0 && (
          <p className="rounded-lg border border-dashed border-edge p-6 text-center text-dust">
            No subjects yet — create your first one below.
          </p>
        )}
        <ul className="grid gap-4 sm:grid-cols-2">
          {(subjects ?? []).map((s) => (
            <li
              key={s.id}
              className="group rounded-xl border border-edge bg-lamp p-5 shadow-sm transition hover:border-blue/40"
            >
              {draft?.id === s.id ? (
                <form onSubmit={onSaveEdit} className="space-y-2">
                  <input
                    required
                    maxLength={200}
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    className="w-full rounded-lg border border-edge px-3 py-1.5 focus:border-blue/60 focus:outline-none"
                  />
                  <input
                    maxLength={2000}
                    placeholder="Description (optional)"
                    value={draft.description}
                    onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                    className="w-full rounded-lg border border-edge px-3 py-1.5 focus:border-blue/60 focus:outline-none"
                  />
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="rounded-lg bg-blue px-3 py-1.5 text-sm font-medium text-white hover:bg-bluedark"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setDraft(null)}
                      className="rounded-lg px-3 py-1.5 text-sm text-dust hover:text-ink"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex items-start justify-between gap-2">
                  <Link to={`/subjects/${s.id}`} className="min-w-0 flex-1">
                    <h3 className="truncate font-semibold text-ink group-hover:text-bluedark">
                      {s.name}
                    </h3>
                    {s.description && (
                      <p className="mt-1 line-clamp-2 text-sm text-dust">{s.description}</p>
                    )}
                    <p className="mt-2 text-xs font-medium text-dust/80">
                      {s.topic_count} {s.topic_count === 1 ? "topic" : "topics"}
                    </p>
                  </Link>
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        setDraft({ id: s.id, name: s.name, description: s.description })
                      }
                      className="text-sm text-dust/80 hover:text-bluedark"
                      title="Edit subject"
                    ><PencilIcon /></button>
                    <button
                      onClick={() => onDelete(s.id)}
                      className="text-sm text-dust/80 hover:text-[#B4231F]"
                      title="Delete subject"
                    ><XIcon /></button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="max-w-md">
        <h2 className="mb-4 text-xl font-semibold text-ink">Add a subject</h2>
        <form onSubmit={onCreate} className="space-y-3 rounded-xl border border-edge bg-lamp p-5 shadow-sm">
          <input
            required
            maxLength={200}
            placeholder="Subject name, e.g. Operating Systems"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-edge px-3 py-2 focus:border-blue/60 focus:outline-none"
          />
          <input
            maxLength={2000}
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-lg border border-edge px-3 py-2 focus:border-blue/60 focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-lg bg-blue px-4 py-2 font-medium text-white hover:bg-bluedark"
          >
            Add subject
          </button>
        </form>
      </section>
    </div>
  );
}
