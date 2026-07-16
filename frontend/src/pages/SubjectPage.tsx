import { useEffect, useState, type FormEvent } from "react";
import { PencilIcon, XIcon } from "../components/icons";
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
        <p className="text-[#e88a7d]">{error}</p>
        <Link to="/subjects" className="text-marker hover:underline">← Back to subjects</Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <Link to="/subjects" className="text-sm text-marker hover:underline">← All subjects</Link>
        <h2 className="mt-2 text-2xl font-bold text-card">{subject?.name ?? "…"}</h2>
        {subject?.description && <p className="mt-1 text-dust">{subject.description}</p>}
      </div>

      <section>
        <h3 className="mb-4 text-lg font-semibold text-card">Topics</h3>
        {topics === null && <p className="text-dust">Loading…</p>}
        {topics !== null && topics.length === 0 && (
          <p className="rounded-lg border border-dashed border-[#3d362a] p-6 text-center text-dust">
            No topics yet — this is where your syllabus entries go.
          </p>
        )}
        <ul className="space-y-2">
          {(topics ?? []).map((t) => (
            <li
              key={t.id}
              className="rounded-lg border border-edge bg-lamp px-4 py-3 shadow-sm"
            >
              {draft?.id === t.id ? (
                <form onSubmit={onSaveEdit} className="space-y-2">
                  <input
                    required
                    maxLength={200}
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    className="w-full rounded-lg border border-[#3d362a] px-3 py-1.5 focus:border-marker/70 focus:outline-none"
                  />
                  <input
                    maxLength={2000}
                    placeholder="Description (optional)"
                    value={draft.description}
                    onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                    className="w-full rounded-lg border border-[#3d362a] px-3 py-1.5 focus:border-marker/70 focus:outline-none"
                  />
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="rounded-lg bg-marker px-3 py-1.5 text-sm font-medium text-ink hover:bg-[#ffe070]"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setDraft(null)}
                      className="rounded-lg px-3 py-1.5 text-sm text-dust hover:text-card"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex items-center justify-between">
                  <Link to={`/topics/${t.id}`} className="min-w-0 flex-1">
                    <p className="font-medium text-card hover:text-[#ffe070]">{t.name}</p>
                    {t.description && (
                      <p className="truncate text-sm text-dust">{t.description}</p>
                    )}
                  </Link>
                  <div className="ml-3 flex gap-2">
                    <button
                      onClick={() =>
                        setDraft({ id: t.id, name: t.name, description: t.description })
                      }
                      className="text-sm text-dust/80 hover:text-[#ffe070]"
                      title="Edit topic"
                    ><PencilIcon /></button>
                    <button
                      onClick={() => onDelete(t.id)}
                      className="text-sm text-dust/80 hover:text-[#e88a7d]"
                      title="Delete topic"
                    ><XIcon /></button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="max-w-md">
        <h3 className="mb-4 text-lg font-semibold text-card">Add a topic</h3>
        <form onSubmit={onCreate} className="space-y-3 rounded-xl border border-edge bg-lamp p-5 shadow-sm">
          <input
            required
            maxLength={200}
            placeholder="Topic name, e.g. Process Scheduling"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-[#3d362a] px-3 py-2 focus:border-marker/70 focus:outline-none"
          />
          <input
            maxLength={2000}
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-lg border border-[#3d362a] px-3 py-2 focus:border-marker/70 focus:outline-none"
          />
          {error && <p className="text-sm text-[#e88a7d]">{error}</p>}
          <button
            type="submit"
            className="rounded-lg bg-marker px-4 py-2 font-medium text-ink hover:bg-[#ffe070]"
          >
            Add topic
          </button>
        </form>
      </section>
    </div>
  );
}
