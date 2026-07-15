import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ApiError, createQuiz, deleteQuiz, listQuizzes, type Quiz } from "../api";

export default function QuizzesSection({ topicId }: { topicId: number }) {
  const [quizzes, setQuizzes] = useState<Quiz[] | null>(null);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listQuizzes(topicId).then(setQuizzes).catch((e: Error) => setError(e.message));
  }, [topicId]);

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
      {quizzes === null && <p className="text-slate-500">Loading…</p>}
      {quizzes !== null && quizzes.length === 0 && (
        <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-slate-500">
          No quizzes yet — create one below, then add questions to it.
        </p>
      )}
      <ul className="space-y-2">
        {(quizzes ?? []).map((q) => (
          <li
            key={q.id}
            className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm"
          >
            <Link to={`/quizzes/${q.id}`} className="min-w-0 flex-1">
              <p className="font-medium text-slate-900 hover:text-indigo-700">{q.title}</p>
              <p className="text-xs text-slate-400">
                {q.question_count} {q.question_count === 1 ? "question" : "questions"}
              </p>
            </Link>
            <button onClick={() => onDelete(q.id)} className="ml-3 text-sm text-slate-400 hover:text-rose-600" title="Delete quiz">
              ✕
            </button>
          </li>
        ))}
      </ul>

      <form onSubmit={onCreate} className="flex max-w-xl gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <input
          required
          maxLength={255}
          placeholder="Quiz title, e.g. Normalization basics"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none"
        />
        <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700">
          Create
        </button>
        {error && <p className="text-sm text-rose-600">{error}</p>}
      </form>
    </div>
  );
}
