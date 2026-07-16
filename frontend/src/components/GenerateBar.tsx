import { useEffect, useState } from "react";
import {
  ApiError,
  listGenerationJobs,
  startGeneration,
  type GenerationJob,
  type GenerationKind,
  type QuizDifficulty,
} from "../api";

const KIND_LABEL: Record<GenerationKind, string> = {
  notes: "notes",
  flashcards: "flashcards",
  quiz: "a quiz",
};

// Staged status messages, advanced by elapsed time — tells the user what's
// actually happening during the 10-30s a generation takes.
const STAGES: Record<GenerationKind, string[]> = {
  flashcards: [
    "Reading your study material…",
    "Finding the most relevant passages…",
    "Writing flashcards grounded in your documents…",
    "Checking every card against its sources…",
    "Almost done…",
  ],
  notes: [
    "Reading your study material…",
    "Finding the most relevant passages…",
    "Writing structured notes from your documents…",
    "Checking the note against its sources…",
    "Almost done…",
  ],
  quiz: [
    "Reading your study material…",
    "Finding the most relevant passages…",
    "Writing quiz questions from your documents…",
    "Verifying answers against the sources…",
    "Almost done…",
  ],
};

const STAGE_SECONDS = 6; // advance to the next message every N seconds

export default function GenerateBar({
  topicId,
  kind,
  onDone,
}: {
  topicId: number;
  kind: GenerationKind;
  onDone: () => void;
}) {
  const [job, setJob] = useState<GenerationJob | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [difficulty, setDifficulty] = useState<QuizDifficulty>("standard");
  const [error, setError] = useState<string | null>(null);

  const active = job !== null && (job.status === "queued" || job.status === "running");

  // poll the job while it runs
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(async () => {
      const jobs = await listGenerationJobs(topicId);
      const latest = jobs.find((j) => j.kind === kind) ?? null;
      setJob(latest);
      if (latest?.status === "done") onDone();
    }, 2500);
    return () => clearInterval(timer);
  }, [active, topicId, kind, onDone]);

  // tick the elapsed clock for staged messages
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [active]);

  async function onGenerate() {
    setError(null);
    setElapsed(0);
    try {
      setJob(await startGeneration(topicId, kind, 10, difficulty));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reach the server");
    }
  }

  const stages = STAGES[kind];
  const stage = stages[Math.min(Math.floor(elapsed / STAGE_SECONDS), stages.length - 1)];

  return (
    <div className="rounded-xl border border-marker/25 bg-marker/12 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={onGenerate}
          disabled={active}
          className="rounded-lg bg-marker px-4 py-2 text-sm font-medium text-ink hover:bg-[#ffe070] disabled:opacity-50"
        >
          {active ? "Generating…" : `Generate ${KIND_LABEL[kind]} from documents`}
        </button>
        {kind === "quiz" && !active && (
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value as QuizDifficulty)}
            className="rounded-lg border border-[#3d362a] bg-lamp px-2 py-1.5 text-sm text-chalk focus:border-marker/70 focus:outline-none"
            title="Quiz difficulty"
          >
            <option value="intro">Intro</option>
            <option value="standard">Standard</option>
            <option value="exam">Exam-level</option>
          </select>
        )}
        {!active && (
          <p className="text-xs text-dust">
            Grounded in this topic's uploaded material — every item cites its source passages.
          </p>
        )}
      </div>

      {active && (
        <div className="mt-3">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#2a2519]">
            <div className="h-full w-1/3 animate-[slide_1.2s_ease-in-out_infinite] rounded-full bg-marker" />
          </div>
          <p className="mt-2 text-sm text-marker">{stage}</p>
          <style>{`@keyframes slide { 0% { margin-left: -33% } 100% { margin-left: 100% } }`}</style>
        </div>
      )}

      {job?.status === "done" && (
        <p className="mt-2 text-sm text-[#8fcf92]">
          Created {job.created_count} item{job.created_count === 1 ? "" : "s"} for your review
          {job.rejected_count > 0 &&
            ` (${job.rejected_count} rejected for failing the source-citation check)`}
          .
        </p>
      )}
      {job?.status === "failed" && <p className="mt-2 text-sm text-[#e88a7d]">{job.error}</p>}
      {error && <p className="mt-2 text-sm text-[#e88a7d]">{error}</p>}
    </div>
  );
}
