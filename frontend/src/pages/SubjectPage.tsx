import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ApiError,
  createTopic,
  deleteTopic,
  getSubject,
  listTopics,
  type Subject,
  type Topic,
} from "../api";

export default function SubjectPage() {
  const { subjectId } = useParams();
  const id = Number(subjectId);

  const [subject, setSubject] = useState<Subject | null>(null);
  const [topics, setTopics] = useState<Topic[] | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getSubject(id), listTopics(id)])
      .then(([s, t]) => {
        setSubject(s);
        setTopics(t);
      })
      .catch((e: Error) => setError(e.message));
  }, [id]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const topic = await createTopic(id, name.trim(), description.trim());
      setTopics((prev) => [...(prev ?? []), topic]);
      setName("");
      setDescription("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reach the server");
    }
  }

  async function onDelete(topicId: number) {
    if (!confirm("Delete this topic?")) return;
    await deleteTopic(topicId);
    setTopics((prev) => (prev ?? []).filter((t) => t.id !== topicId));
  }

  if (error && !subject) {
    return (
      <div>
        <p className="text-rose-600">{error}</p>
        <Link to="/" className="text-indigo-600 hover:underline">← Back to subjects</Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <Link to="/" className="text-sm text-indigo-600 hover:underline">← All subjects</Link>
        <h2 className="mt-2 text-2xl font-bold text-slate-900">{subject?.name ?? "…"}</h2>
        {subject?.description && <p className="mt-1 text-slate-500">{subject.description}</p>}
      </div>

      <section>
        <h3 className="mb-4 text-lg font-semibold text-slate-900">Topics</h3>
        {topics === null && <p className="text-slate-500">Loading…</p>}
        {topics !== null && topics.length === 0 && (
          <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-slate-500">
            No topics yet — this is where your syllabus entries go.
          </p>
        )}
        <ul className="space-y-2">
          {(topics ?? []).map((t) => (
            <li
              key={t.id}
              className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm"
            >
              <div className="min-w-0">
                <p className="font-medium text-slate-900">{t.name}</p>
                {t.description && (
                  <p className="truncate text-sm text-slate-500">{t.description}</p>
                )}
              </div>
              <button
                onClick={() => onDelete(t.id)}
                className="ml-3 text-sm text-slate-400 hover:text-rose-600"
                title="Delete topic"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="max-w-md">
        <h3 className="mb-4 text-lg font-semibold text-slate-900">Add a topic</h3>
        <form onSubmit={onCreate} className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <input
            required
            maxLength={200}
            placeholder="Topic name, e.g. Process Scheduling"
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
            Add topic
          </button>
        </form>
      </section>
    </div>
  );
}
