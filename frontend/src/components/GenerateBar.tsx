import { useEffect, useState } from "react";
import {
  ApiError,
  listGenerationJobs,
  startGeneration,
  type GenerationJob,
  type GenerationKind,
} from "../api";

const KIND_LABEL: Record<GenerationKind, string> = {
  notes: "notes",
  flashcards: "flashcards",
  quiz: "a quiz",
};

/** "Generate with AI" trigger + live status of the latest job of this kind.
 *  Polls while a job runs; calls onDone() when new items are ready. */
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
  const [error, setError] = useState<string | null>(null);

  const active = job !== null && (job.status === "queued" || job.status === "running");

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(async () => {
      const jobs = await listGenerationJobs(topicId);
      const latest = jobs.find((j) => j.kind === kind) ?? null;
      setJob(latest);
      if (latest && latest.status !== "queued" && latest.status !== "running") {
        if (latest.status === "done") onDone();
      }
    }, 2500);
    return () => clearInterval(timer);
  }, [active, topicId, kind, onDone]);

  async function onGenerate() {
    setError(null);
    try {
      setJob(await startGeneration(topicId, kind));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reach the server");
    }
  }

  return (
    <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={onGenerate}
          disabled={active}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {active ? "Generating…" : `✨ Generate ${KIND_LABEL[kind]} from documents`}
        </button>
        <p className="text-xs text-slate-500">
          Grounded in this topic's uploaded material — every item cites its source passages.
        </p>
      </div>
      {job?.status === "done" && (
        <p className="mt-2 text-sm text-emerald-700">
          Created {job.created_count} item{job.created_count === 1 ? "" : "s"} for your review
          {job.rejected_count > 0 &&
            ` (${job.rejected_count} rejected for failing the source-citation check)`}
          .
        </p>
      )}
      {job?.status === "failed" && <p className="mt-2 text-sm text-rose-600">{job.error}</p>}
      {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
    </div>
  );
}
