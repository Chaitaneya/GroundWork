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
      {quizzes === null && <p className="text-dust">Loading…</p>}
      {quizzes !== null && quizzes.length === 0 && (
        <p className="rounded-lg border border-dashed border-[#3d362a] p-6 text-center text-dust">
          No quizzes yet — create one below, then add questions to it.
        </p>
      )}
      <ul className="space-y-2">
        {(quizzes ?? []).map((q) => (
          <li
            key={q.id}
            className={`flex items-center justify-between rounded-lg border bg-lamp px-4 py-3 shadow-sm ${
              q.pending ? "border-marker/40 bg-marker/8" : "border-edge"
            }`}
          >
            <Link to={`/quizzes/${q.id}`} className="min-w-0 flex-1">
              <p className="font-medium text-card hover:text-[#ffe070]">
                {q.title}
                {q.pending && (
                  <span className="ml-2 rounded-full bg-marker/15 px-2 py-0.5 text-xs font-medium text-marker">
                    AI — review
                  </span>
                )}
              </p>
              <p className="text-xs text-dust/80">
                {q.question_count} {q.question_count === 1 ? "question" : "questions"}
              </p>
            </Link>
            <div className="ml-3 flex items-center gap-2">
              {q.pending && (
                <button
                  onClick={() => onAccept(q.id)}
                  className="rounded-lg bg-[#4c7a4f] px-3 py-1 text-xs font-semibold text-ink hover:bg-[#5b8f5e]"
                >
                  Accept
                </button>
              )}
              <button onClick={() => onDelete(q.id)} className="text-sm text-dust/80 hover:text-[#e88a7d]" title="Delete quiz"><XIcon /></button>
            </div>
          </li>
        ))}
      </ul>

      <form onSubmit={onCreate} className="flex max-w-xl gap-3 rounded-xl border border-edge bg-lamp p-5 shadow-sm">
        <input
          required
          maxLength={255}
          placeholder="Quiz title, e.g. Normalization basics"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="flex-1 rounded-lg border border-[#3d362a] px-3 py-2 focus:border-marker/70 focus:outline-none"
        />
        <button type="submit" className="rounded-lg bg-marker px-4 py-2 font-medium text-ink hover:bg-[#ffe070]">
          Create
        </button>
        {error && <p className="text-sm text-[#e88a7d]">{error}</p>}
      </form>
    </div>
  );
}
