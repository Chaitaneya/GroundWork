import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import SourcesView from "../components/SourcesView";
import {
  addQuestion,
  ApiError,
  deleteQuestion,
  fetchQuestionSources,
  getQuiz,
  listAttempts,
  submitAttempt,
  type Attempt,
  type AttemptResult,
  type NewQuestion,
  type Question,
  type QuizDetail,
} from "../api";

// Mode rules (standard quiz UX): correct answers are visible ONLY in
// "edit" (the owner deliberately editing) and "result" (after submitting).
// "overview" and "take" never reveal them.
type Mode = "overview" | "edit" | "take" | "result";

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
    "w-full rounded-lg border border-zinc-700 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none";

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900 p-5 shadow-sm">
      <h4 className="font-semibold text-zinc-100">Add a question</h4>
      <div className="flex gap-2">
        {(["mcq", "true_false", "short_answer"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setQtype(t)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              qtype === t ? "bg-violet-500 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
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
          <p className="text-xs text-zinc-500">Select the radio next to the correct option.</p>
        </div>
      )}

      {qtype === "true_false" && (
        <div className="flex items-center gap-4 text-sm text-zinc-300">
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
      {error && <p className="text-sm text-rose-400">{error}</p>}
      <button type="submit" className="rounded-lg bg-violet-500 px-4 py-2 text-sm font-medium text-white hover:bg-violet-400">
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
  const [mode, setMode] = useState<Mode>("overview");
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    getQuiz(id).then(setQuiz).catch((e: Error) => setError(e.message));
    listAttempts(id).then(setAttempts).catch(() => {});
  }, [id]);

  useEffect(reload, [reload]);

  function startTaking() {
    setAnswers({});
    setResult(null);
    setMode("take");
  }

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
        <p className="text-rose-400">{error}</p>
        <Link to="/subjects" className="text-violet-400 hover:underline">← Back</Link>
      </div>
    );
  }
  if (!quiz) return <p className="text-zinc-400">Loading…</p>;

  const revealAnswers = mode === "edit"; // never in overview/take
  const resultFor = (qid: number) => result?.results.find((r) => r.question_id === qid);

  return (
    <div className="space-y-8">
      <div>
        <Link to={`/topics/${quiz.topic_id}`} className="text-sm text-violet-400 hover:underline">
          ← Back to topic
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-zinc-100">{quiz.title}</h2>
            <p className="text-sm text-zinc-400">
              {quiz.questions.length} question{quiz.questions.length === 1 ? "" : "s"}
              {mode === "edit" && " · editing (correct answers visible)"}
            </p>
          </div>
          <div className="flex gap-2">
            {mode === "overview" && (
              <>
                {quiz.questions.length > 0 && (
                  <button
                    onClick={startTaking}
                    className="rounded-lg bg-violet-500 px-4 py-2 font-medium text-white hover:bg-violet-400"
                  >
                    Take quiz
                  </button>
                )}
                <button
                  onClick={() => setMode("edit")}
                  className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 font-medium text-zinc-300 hover:bg-zinc-800"
                >
                  Edit
                </button>
              </>
            )}
            {mode === "edit" && (
              <button
                onClick={() => setMode("overview")}
                className="rounded-lg bg-violet-500 px-4 py-2 font-medium text-white hover:bg-violet-400"
              >
                Done editing
              </button>
            )}
            {mode === "take" && (
              <button onClick={() => setMode("overview")} className="text-sm text-zinc-400 hover:text-zinc-100">
                Cancel
              </button>
            )}
            {mode === "result" && (
              <div className="flex gap-2">
                <button
                  onClick={startTaking}
                  className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 font-medium text-zinc-300 hover:bg-zinc-800"
                >
                  Retake
                </button>
                <button
                  onClick={() => setMode("overview")}
                  className="rounded-lg bg-violet-500 px-4 py-2 font-medium text-white hover:bg-violet-400"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
        {mode === "result" && result && (
          <p className="mt-2 text-lg font-semibold text-zinc-100">
            Score: <span className={result.score_pct >= 60 ? "text-emerald-400" : "text-rose-400"}>{result.score_pct}%</span>
          </p>
        )}
      </div>

      {quiz.questions.length === 0 && mode !== "edit" && (
        <p className="rounded-lg border border-dashed border-zinc-700 p-6 text-center text-zinc-400">
          This quiz has no questions yet — hit Edit to add some.
        </p>
      )}

      <ol className="space-y-4">
        {quiz.questions.map((q, qi) => {
          const r = resultFor(q.id);
          return (
            <li key={q.id} className={`rounded-xl border bg-zinc-900 p-5 shadow-sm ${
              r ? (r.is_correct ? "border-emerald-500/40" : "border-rose-500/40") : "border-zinc-800"
            }`}>
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium text-zinc-100">
                  {qi + 1}. {q.prompt}
                </p>
                {mode === "edit" && (
                  <button
                    onClick={async () => {
                      if (!confirm("Delete this question?")) return;
                      await deleteQuestion(q.id);
                      reload();
                    }}
                    className="text-sm text-zinc-500 hover:text-rose-400"
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
                        mode === "take" ? "cursor-pointer hover:bg-zinc-800" : ""
                      } ${revealAnswers && o.is_correct ? "bg-emerald-500/10 font-medium text-emerald-300" : "text-zinc-300"} ${
                        r && answers[q.id] === String(o.id) ? (r.is_correct ? "bg-emerald-500/10" : "bg-rose-500/10") : ""
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
                        <span className="w-4 text-center">{revealAnswers && o.is_correct ? "✓" : "·"}</span>
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
                  className="mt-3 w-full rounded-lg border border-zinc-700 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none"
                />
              ) : (
                <p className="mt-2 text-sm text-zinc-400">
                  {revealAnswers ? (
                    <>Answer: <span className="font-medium text-zinc-300">{q.answer_text}</span></>
                  ) : mode === "result" ? (
                    `Your answer: ${answers[q.id] || "—"}`
                  ) : (
                    "Short-answer question"
                  )}
                </p>
              )}

              {mode === "edit" && q.origin === "ai" && (
                <div className="mt-3">
                  <SourcesView fetch={() => fetchQuestionSources(q.id)} />
                </div>
              )}

              {/* result feedback */}
              {r && (
                <div className="mt-3 rounded-lg bg-zinc-950 px-3 py-2 text-sm">
                  <p className={r.is_correct ? "font-medium text-emerald-400" : "font-medium text-rose-400"}>
                    {r.is_correct ? "Correct" : `Incorrect — correct answer: ${r.correct_answer}`}
                  </p>
                  {r.explanation && <p className="mt-1 text-zinc-400">{r.explanation}</p>}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {mode === "take" && (
        <button onClick={onSubmitAttempt} className="w-full max-w-md rounded-xl bg-violet-500 py-3 font-medium text-white hover:bg-violet-400">
          Submit answers
        </button>
      )}

      {mode === "edit" && <QuestionForm quizId={id} onAdded={() => reload()} />}

      {mode === "overview" && attempts.length > 0 && (
        <section>
          <h4 className="mb-2 font-semibold text-zinc-100">Past attempts</h4>
          <ul className="space-y-1 text-sm text-zinc-400">
            {attempts.map((a) => (
              <li key={a.id}>
                {new Date(a.started_at).toLocaleString()} — <span className="font-medium">{a.score_pct}%</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
