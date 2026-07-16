import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { acceptQuiz, ApiError, createQuiz, deleteQuiz, listQuizzes, type Quiz } from "../api";
import GenerateBar from "./GenerateBar";
import PendingBanner from "./PendingBanner";
import { XIcon } from "./icons";

export default function QuizzesSection({ topicId }: { topicId: number }) {
  const [quizzes, setQuizzes] = useState<Quiz[] | null>(null);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    () => listQuizzes(topicId).then(setQuizzes).catch((e: Error) => setError(e.message)),
    [topicId],
  );
  useEffect(() => {
    load();
  }, [load]);

  async function onAccept(id: number) {
    await acceptQuiz(id);
    setQuizzes((prev) => (prev ?? []).map((q) => (q.id === id ? { ...q, pending: false } : q)));
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const quiz = await createQuiz(topicId, title.trim());
      setQuizzes((prev) => [...(prev ?? []), quiz]);
      setTitle("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reach the server");
    }
  }

  async function onDelete(id: number) {
    if (!confirm("Delete this quiz, its questions, and all attempts?")) return;
    await deleteQuiz(id);
    setQuizzes((prev) => (prev ?? []).filter((q) => q.id !== id));
  }

  return (
    <div className="space-y-6">
      <GenerateBar topicId={topicId} kind="quiz" onDone={load} />
      <PendingBanner
        topicId={topicId}
        kind="quiz"
        label="quizzes"
        count={(quizzes ?? []).filter((q) => q.pending).length}
        onChanged={load}
      />
      {quizzes === null && <p className="text-slate-400">Loading…</p>}
      {quizzes !== null && quizzes.length === 0 && (
        <p className="rounded-lg border border-dashed border-white/15 p-6 text-center text-slate-400">
          No quizzes yet — create one below, then add questions to it.
        </p>
      )}
      <ul className="space-y-2">
        {(quizzes ?? []).map((q) => (
          <li
            key={q.id}
            className={`flex items-center justify-between rounded-lg border bg-white/[0.06] px-4 py-3 shadow-sm ${
              q.pending ? "border-amber-500/40 bg-amber-500/5" : "border-white/10"
            }`}
          >
            <Link to={`/quizzes/${q.id}`} className="min-w-0 flex-1">
              <p className="font-medium text-slate-100 hover:text-teal-200">
                {q.title}
                {q.pending && (
                  <span className="ml-2 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-300">
                    AI — review
                  </span>
                )}
              </p>
              <p className="text-xs text-slate-500">
                {q.question_count} {q.question_count === 1 ? "question" : "questions"}
              </p>
            </Link>
            <div className="ml-3 flex items-center gap-2">
              {q.pending && (
                <button
                  onClick={() => onAccept(q.id)}
                  className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-500"
                >
                  Accept
                </button>
              )}
              <button onClick={() => onDelete(q.id)} className="text-sm text-slate-500 hover:text-rose-400" title="Delete quiz"><XIcon /></button>
            </div>
          </li>
        ))}
      </ul>

      <form onSubmit={onCreate} className="flex max-w-xl gap-3 rounded-xl border border-white/10 bg-white/[0.06] p-5 shadow-sm">
        <input
          required
          maxLength={255}
          placeholder="Quiz title, e.g. Normalization basics"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="flex-1 rounded-lg border border-white/15 px-3 py-2 focus:border-teal-300 focus:outline-none"
        />
        <button type="submit" className="rounded-lg bg-gradient-to-r from-teal-400 to-cyan-400 px-4 py-2 font-medium text-white hover:brightness-110">
          Create
        </button>
        {error && <p className="text-sm text-rose-400">{error}</p>}
      </form>
    </div>
  );
}
