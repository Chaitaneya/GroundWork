import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import {
  addQuestion,
  ApiError,
  deleteQuestion,
  getQuiz,
  listAttempts,
  submitAttempt,
  type Attempt,
  type AttemptResult,
  type NewQuestion,
  type Question,
  type QuizDetail,
} from "../api";

type Mode = "manage" | "take" | "result";

const EMPTY_OPTIONS = ["", "", "", ""];

function QuestionForm({ quizId, onAdded }: { quizId: number; onAdded: (q: Question) => void }) {
  const [qtype, setQtype] = useState<Question["qtype"]>("mcq");
  const [prompt, setPrompt] = useState("");
  const [options, setOptions] = useState<string[]>(EMPTY_OPTIONS);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [tfAnswer, setTfAnswer] = useState<"True" | "False">("True");
  const [answerText, setAnswerText] = useState("");
  const [explanation, setExplanation] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    let payload: NewQuestion;
    if (qtype === "mcq") {
      const filled = options.map((o) => o.trim()).filter(Boolean);
      if (filled.length < 2) {
        setError("Fill in at least 2 options");
        return;
      }
      if (!options[correctIndex]?.trim()) {
        setError("The correct option can't be empty");
        return;
      }
      payload = {
        qtype,
        prompt: prompt.trim(),
        options: options
          .map((text, i) => ({ option_text: text.trim(), is_correct: i === correctIndex }))
          .filter((o) => o.option_text),
        answer_text: null,
        explanation,
      };
    } else if (qtype === "true_false") {
      payload = {
        qtype,
        prompt: prompt.trim(),
        options: [
          { option_text: "True", is_correct: tfAnswer === "True" },
          { option_text: "False", is_correct: tfAnswer === "False" },
        ],
        answer_text: null,
        explanation,
      };
    } else {
      payload = { qtype, prompt: prompt.trim(), options: [], answer_text: answerText, explanation };
    }
    try {
      const question = await addQuestion(quizId, payload);
      onAdded(question);
      setPrompt("");
      setOptions(EMPTY_OPTIONS);
      setCorrectIndex(0);
      setAnswerText("");
      setExplanation("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reach the server");
    }
  }

  const inputCls =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none";

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h4 className="font-semibold text-slate-900">Add a question</h4>
      <div className="flex gap-2">
        {(["mcq", "true_false", "short_answer"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setQtype(t)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              qtype === t ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {t === "mcq" ? "Multiple choice" : t === "true_false" ? "True / False" : "Short answer"}
          </button>
        ))}
      </div>
      <textarea required rows={2} placeholder="Question prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} className={inputCls} />

      {qtype === "mcq" && (
        <div className="space-y-2">
          {options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="radio"
                name="correct"
                checked={correctIndex === i}
                onChange={() => setCorrectIndex(i)}
                title="Mark as correct"
              />
              <input
                placeholder={`Option ${i + 1}${i < 2 ? "" : " (optional)"}`}
                value={opt}
                onChange={(e) => setOptions(options.map((o, j) => (j === i ? e.target.value : o)))}
                className={inputCls}
              />
            </div>
          ))}
          <p className="text-xs text-slate-400">Select the radio next to the correct option.</p>
        </div>
      )}

      {qtype === "true_false" && (
        <div className="flex items-center gap-4 text-sm text-slate-700">
          Correct answer:
          {(["True", "False"] as const).map((v) => (
            <label key={v} className="flex items-center gap-1">
              <input type="radio" name="tf" checked={tfAnswer === v} onChange={() => setTfAnswer(v)} /> {v}
            </label>
          ))}
        </div>
      )}

      {qtype === "short_answer" && (
        <input required placeholder="Expected answer (matching ignores case/spaces)" value={answerText} onChange={(e) => setAnswerText(e.target.value)} className={inputCls} />
      )}

      <input placeholder="Explanation shown after answering (optional)" value={explanation} onChange={(e) => setExplanation(e.target.value)} className={inputCls} />
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
        Add question
      </button>
    </form>
  );
}

export default function QuizPage() {
  const { quizId } = useParams();
  const id = Number(quizId);

  const [quiz, setQuiz] = useState<QuizDetail | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [mode, setMode] = useState<Mode>("manage");
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    getQuiz(id).then(setQuiz).catch((e: Error) => setError(e.message));
    listAttempts(id).then(setAttempts).catch(() => {});
  }, [id]);

  useEffect(reload, [reload]);

  async function onSubmitAttempt() {
    if (!quiz) return;
    const submission = quiz.questions.map((q) => ({
      question_id: q.id,
      given_answer: answers[q.id] ?? "",
    }));
    const res = await submitAttempt(id, submission);
    setResult(res);
    setMode("result");
    listAttempts(id).then(setAttempts).catch(() => {});
  }

  if (error && !quiz) {
    return (
      <div>
        <p className="text-rose-600">{error}</p>
        <Link to="/" className="text-indigo-600 hover:underline">← Back</Link>
      </div>
    );
  }
  if (!quiz) return <p className="text-slate-500">Loading…</p>;

  const resultFor = (qid: number) => result?.results.find((r) => r.question_id === qid);

  return (
    <div className="space-y-8">
      <div>
        <Link to={`/topics/${quiz.topic_id}`} className="text-sm text-indigo-600 hover:underline">
          ← Back to topic
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-bold text-slate-900">{quiz.title}</h2>
          {mode === "manage" && quiz.questions.length > 0 && (
            <button
              onClick={() => {
                setAnswers({});
                setResult(null);
                setMode("take");
              }}
              className="rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700"
            >
              Take quiz
            </button>
          )}
          {mode !== "manage" && (
            <button onClick={() => setMode("manage")} className="text-sm text-slate-500 hover:text-slate-900">
              Exit to editing
            </button>
          )}
        </div>
        {mode === "result" && result && (
          <p className="mt-2 text-lg font-semibold text-slate-900">
            Score: <span className={result.score_pct >= 60 ? "text-emerald-600" : "text-rose-600"}>{result.score_pct}%</span>
          </p>
        )}
      </div>

      <ol className="space-y-4">
        {quiz.questions.map((q, qi) => {
          const r = resultFor(q.id);
          return (
            <li key={q.id} className={`rounded-xl border bg-white p-5 shadow-sm ${
              r ? (r.is_correct ? "border-emerald-300" : "border-rose-300") : "border-slate-200"
            }`}>
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium text-slate-900">
                  {qi + 1}. {q.prompt}
                </p>
                {mode === "manage" && (
                  <button
                    onClick={async () => {
                      if (!confirm("Delete this question?")) return;
                      await deleteQuestion(q.id);
                      reload();
                    }}
                    className="text-sm text-slate-400 hover:text-rose-600"
                    title="Delete question"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* options / answer input */}
              {q.qtype !== "short_answer" ? (
                <div className="mt-3 space-y-1.5">
                  {q.options.map((o) => (
                    <label
                      key={o.id}
                      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                        mode === "take" ? "cursor-pointer hover:bg-slate-50" : ""
                      } ${mode === "manage" && o.is_correct ? "bg-emerald-50 font-medium text-emerald-800" : "text-slate-700"} ${
                        r && answers[q.id] === String(o.id) ? (r.is_correct ? "bg-emerald-50" : "bg-rose-50") : ""
                      }`}
                    >
                      {mode === "take" ? (
                        <input
                          type="radio"
                          name={`q${q.id}`}
                          checked={answers[q.id] === String(o.id)}
                          onChange={() => setAnswers({ ...answers, [q.id]: String(o.id) })}
                        />
                      ) : (
                        <span className="w-4 text-center">{mode === "manage" && o.is_correct ? "✓" : "·"}</span>
                      )}
                      {o.option_text}
                    </label>
                  ))}
                </div>
              ) : mode === "take" ? (
                <input
                  placeholder="Your answer"
                  value={answers[q.id] ?? ""}
                  onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                  className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                />
              ) : (
                <p className="mt-2 text-sm text-slate-500">
                  {mode === "manage" ? <>Answer: <span className="font-medium text-slate-700">{q.answer_text}</span></> : `Your answer: ${answers[q.id] || "—"}`}
                </p>
              )}

              {/* result feedback */}
              {r && (
                <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                  <p className={r.is_correct ? "font-medium text-emerald-700" : "font-medium text-rose-700"}>
                    {r.is_correct ? "Correct" : `Incorrect — correct answer: ${r.correct_answer}`}
                  </p>
                  {r.explanation && <p className="mt-1 text-slate-600">{r.explanation}</p>}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {mode === "take" && (
        <button onClick={onSubmitAttempt} className="w-full max-w-md rounded-xl bg-indigo-600 py-3 font-medium text-white hover:bg-indigo-700">
          Submit answers
        </button>
      )}

      {mode === "manage" && (
        <>
          <QuestionForm quizId={id} onAdded={() => reload()} />
          {attempts.length > 0 && (
            <section>
              <h4 className="mb-2 font-semibold text-slate-900">Past attempts</h4>
              <ul className="space-y-1 text-sm text-slate-600">
                {attempts.map((a) => (
                  <li key={a.id}>
                    {new Date(a.started_at).toLocaleString()} — <span className="font-medium">{a.score_pct}%</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
