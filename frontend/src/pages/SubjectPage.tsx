import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ApiError,
  createTopic,
  deleteTopic,
  getSubject,
  listTopics,
  updateTopic,
  type Subject,
  type Topic,
} from "../api";

interface Draft {
  id: number;
  name: string;
  description: string;
}

export default function SubjectPage() {
  const { subjectId } = useParams();
  const id = Number(subjectId);

  const [subject, setSubject] = useState<Subject | null>(null);
  const [topics, setTopics] = useState<Topic[] | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
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

  async function onSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setError(null);
    try {
      const updated = await updateTopic(draft.id, {
        name: draft.name.trim(),
        description: draft.description.trim(),
      });
      setTopics((prev) => (prev ?? []).map((t) => (t.id === updated.id ? updated : t)));
      setDraft(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reach the server");
    }
  }

  if (error && !subject) {
    return (
      <div>
        <p className="text-rose-400">{error}</p>
        <Link to="/subjects" className="text-teal-300 hover:underline">← Back to subjects</Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <Link to="/subjects" className="text-sm text-teal-300 hover:underline">← All subjects</Link>
        <h2 className="mt-2 text-2xl font-bold text-slate-100">{subject?.name ?? "…"}</h2>
        {subject?.description && <p className="mt-1 text-slate-400">{subject.description}</p>}
      </div>

      <section>
        <h3 className="mb-4 text-lg font-semibold text-slate-100">Topics</h3>
        {topics === null && <p className="text-slate-400">Loading…</p>}
        {topics !== null && topics.length === 0 && (
          <p className="rounded-lg border border-dashed border-white/15 p-6 text-center text-slate-400">
            No topics yet — this is where your syllabus entries go.
          </p>
        )}
        <ul className="space-y-2">
          {(topics ?? []).map((t) => (
            <li
              key={t.id}
              className="rounded-lg border border-white/10 bg-white/[0.06] backdrop-blur-xl px-4 py-3 shadow-sm"
            >
              {draft?.id === t.id ? (
                <form onSubmit={onSaveEdit} className="space-y-2">
                  <input
                    required
                    maxLength={200}
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    className="w-full rounded-lg border border-white/15 px-3 py-1.5 focus:border-teal-300 focus:outline-none"
                  />
                  <input
                    maxLength={2000}
                    placeholder="Description (optional)"
                    value={draft.description}
                    onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                    className="w-full rounded-lg border border-white/15 px-3 py-1.5 focus:border-teal-300 focus:outline-none"
                  />
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="rounded-lg bg-gradient-to-r from-teal-400 to-cyan-400 px-3 py-1.5 text-sm font-medium text-white hover:brightness-110"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setDraft(null)}
                      className="rounded-lg px-3 py-1.5 text-sm text-slate-400 hover:text-slate-100"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex items-center justify-between">
                  <Link to={`/topics/${t.id}`} className="min-w-0 flex-1">
                    <p className="font-medium text-slate-100 hover:text-teal-200">{t.name}</p>
                    {t.description && (
                      <p className="truncate text-sm text-slate-400">{t.description}</p>
                    )}
                  </Link>
                  <div className="ml-3 flex gap-2">
                    <button
                      onClick={() =>
                        setDraft({ id: t.id, name: t.name, description: t.description })
                      }
                      className="text-sm text-slate-500 hover:text-teal-200"
                      title="Edit topic"
                    >
                      ✎
                    </button>
                    <button
                      onClick={() => onDelete(t.id)}
                      className="text-sm text-slate-500 hover:text-rose-400"
                      title="Delete topic"
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
        <h3 className="mb-4 text-lg font-semibold text-slate-100">Add a topic</h3>
        <form onSubmit={onCreate} className="space-y-3 rounded-xl border border-white/10 bg-white/[0.06] backdrop-blur-xl p-5 shadow-sm">
          <input
            required
            maxLength={200}
            placeholder="Topic name, e.g. Process Scheduling"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-white/15 px-3 py-2 focus:border-teal-300 focus:outline-none"
          />
          <input
            maxLength={2000}
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-lg border border-white/15 px-3 py-2 focus:border-teal-300 focus:outline-none"
          />
          {error && <p className="text-sm text-rose-400">{error}</p>}
          <button
            type="submit"
            className="rounded-lg bg-gradient-to-r from-teal-400 to-cyan-400 px-4 py-2 font-medium text-white hover:brightness-110"
          >
            Add topic
          </button>
        </form>
      </section>
    </div>
  );
}
