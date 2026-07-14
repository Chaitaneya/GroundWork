import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  ApiError,
  createSubject,
  deleteSubject,
  listSubjects,
  type Subject,
} from "../api";

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<Subject[] | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
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

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-4 text-xl font-semibold text-slate-900">Your subjects</h2>
        {subjects === null && !error && <p className="text-slate-500">Loading…</p>}
        {subjects !== null && subjects.length === 0 && (
          <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-slate-500">
            No subjects yet — create your first one below.
          </p>
        )}
        <ul className="grid gap-4 sm:grid-cols-2">
          {(subjects ?? []).map((s) => (
            <li
              key={s.id}
              className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-indigo-300"
            >
              <div className="flex items-start justify-between gap-2">
                <Link to={`/subjects/${s.id}`} className="min-w-0">
                  <h3 className="truncate font-semibold text-slate-900 group-hover:text-indigo-700">
                    {s.name}
                  </h3>
                  {s.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-slate-500">{s.description}</p>
                  )}
                </Link>
                <button
                  onClick={() => onDelete(s.id)}
                  className="text-sm text-slate-400 hover:text-rose-600"
                  title="Delete subject"
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="max-w-md">
        <h2 className="mb-4 text-xl font-semibold text-slate-900">Add a subject</h2>
        <form onSubmit={onCreate} className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <input
            required
            maxLength={200}
            placeholder="Subject name, e.g. Operating Systems"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none"
          />
          <input
            maxLength={2000}
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none"
          />
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <button
            type="submit"
            className="rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700"
          >
            Add subject
          </button>
        </form>
      </section>
    </div>
  );
}
