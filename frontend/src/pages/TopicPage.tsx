import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { XIcon } from "../components/icons";
import { Link, useParams } from "react-router-dom";
import FlashcardsSection from "../components/FlashcardsSection";
import NotesSection from "../components/NotesSection";
import QuizzesSection from "../components/QuizzesSection";
import {
  ApiError,
  deleteDocument,
  getTopic,
  listDocuments,
  uploadDocument,
  type Document,
  type Topic,
} from "../api";

function StatusBadge({ status }: { status: Document["status"] }) {
  const styles = {
    processing: "bg-marker/15 text-marker",
    ready: "bg-[#4c7a4f]/25 text-[#9fd8a2]",
    failed: "bg-rule/20 text-[#eda297]",
  }[status];
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles}`}>
      {status === "processing" ? "processing…" : status}
    </span>
  );
}

const TABS = ["Documents", "Notes", "Flashcards", "Quizzes"] as const;
type Tab = (typeof TABS)[number];

export default function TopicPage() {
  const { topicId } = useParams();
  const id = Number(topicId);

  const [tab, setTab] = useState<Tab>("Documents");
  const [topic, setTopic] = useState<Topic | null>(null);
  const [documents, setDocuments] = useState<Document[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const refreshDocuments = useCallback(
    () => listDocuments(id).then(setDocuments).catch((e: Error) => setError(e.message)),
    [id],
  );

  useEffect(() => {
    getTopic(id).then(setTopic).catch((e: Error) => setError(e.message));
    refreshDocuments();
  }, [id, refreshDocuments]);

  // While any document is processing, poll the list every 2s so its badge
  // flips to ready/failed without a manual refresh.
  useEffect(() => {
    if (!documents?.some((d) => d.status === "processing")) return;
    const timer = setInterval(refreshDocuments, 2000);
    return () => clearInterval(timer);
  }, [documents, refreshDocuments]);

  async function onUpload(e: FormEvent) {
    e.preventDefault();
    const file = fileInput.current?.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      await uploadDocument(id, file);
      if (fileInput.current) fileInput.current.value = "";
      await refreshDocuments();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reach the server");
    } finally {
      setUploading(false);
    }
  }

  async function onDelete(docId: number) {
    if (!confirm("Delete this document?")) return;
    await deleteDocument(docId);
    await refreshDocuments();
  }

  return (
    <div className="space-y-8">
      <div>
        {topic && (
          <Link to={`/subjects/${topic.subject_id}`} className="text-sm text-marker hover:underline">
            ← Back to subject
          </Link>
        )}
        <h2 className="mt-2 text-2xl font-bold text-card">{topic?.name ?? "…"}</h2>
        {topic?.description && <p className="mt-1 text-dust">{topic.description}</p>}
      </div>

      <nav className="flex gap-1 overflow-x-auto border-b border-edge [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`shrink-0 rounded-t-lg px-4 py-2 text-sm font-medium ${
              tab === t
                ? "border border-b-0 border-edge bg-lamp text-marker"
                : "text-dust hover:text-card"
            }`}
          >
            {t}
          </button>
        ))}
      </nav>

      {tab === "Notes" && <NotesSection topicId={id} />}
      {tab === "Flashcards" && <FlashcardsSection topicId={id} />}
      {tab === "Quizzes" && <QuizzesSection topicId={id} />}

      <section className={tab === "Documents" ? "" : "hidden"}>
        <h3 className="mb-4 text-lg font-semibold text-card">Reading material</h3>

        <form
          onSubmit={onUpload}
          className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-edge bg-lamp p-4 shadow-sm"
        >
          <input
            ref={fileInput}
            type="file"
            accept=".pdf,.txt,.md"
            required
            className="text-sm text-dust file:mr-3 file:rounded-lg file:border-0 file:bg-[#2a2519] file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-marker hover:file:bg-[#332d22]"
          />
          <button
            type="submit"
            disabled={uploading}
            className="rounded-lg bg-marker px-4 py-1.5 text-sm font-medium text-ink hover:bg-[#ffe070] disabled:opacity-50"
          >
            {uploading ? "Uploading…" : "Upload"}
          </button>
          <span className="text-xs text-dust/80">PDF, TXT, or MD · max 25 MB</span>
        </form>
        {error && <p className="mb-3 text-sm text-[#e88a7d]">{error}</p>}

        {documents === null && <p className="text-dust">Loading…</p>}
        {documents !== null && documents.length === 0 && (
          <p className="rounded-lg border border-dashed border-[#3d362a] p-6 text-center text-dust">
            No documents yet — upload the reading material for this topic.
          </p>
        )}

        <ul className="space-y-2">
          {(documents ?? []).map((d) => (
            <li key={d.id} className="rounded-lg border border-edge bg-lamp shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-medium text-card">
                    {d.title} <StatusBadge status={d.status} />
                  </p>
                  <p className="text-xs text-dust">
                    {d.original_filename}
                    {d.status === "ready" && ` · ${d.page_count} page${d.page_count === 1 ? "" : "s"}`}
                  </p>
                  {d.status === "failed" && d.error && (
                    <p className="mt-1 text-sm text-[#e88a7d]">{d.error}</p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {d.status === "ready" && (
                    <Link
                      to={`/documents/${d.id}`}
                      className="rounded-lg border border-marker/40 bg-marker/12 px-3 py-1 text-sm font-medium text-marker transition hover:bg-marker/25"
                    >
                      Open
                    </Link>
                  )}
                  <button
                    onClick={() => onDelete(d.id)}
                    className="text-sm text-dust/80 hover:text-[#e88a7d]"
                    title="Delete document"
                  ><XIcon /></button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
