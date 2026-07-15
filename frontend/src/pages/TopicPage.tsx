import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import FlashcardsSection from "../components/FlashcardsSection";
import NotesSection from "../components/NotesSection";
import QuizzesSection from "../components/QuizzesSection";
import {
  ApiError,
  deleteDocument,
  getTopic,
  listDocumentChunks,
  listDocuments,
  uploadDocument,
  type Chunk,
  type Document,
  type Topic,
} from "../api";

function StatusBadge({ status }: { status: Document["status"] }) {
  const styles = {
    processing: "bg-amber-100 text-amber-800",
    ready: "bg-emerald-100 text-emerald-800",
    failed: "bg-rose-100 text-rose-800",
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
  const [chunks, setChunks] = useState<Chunk[] | null>(null);
  const [openDocId, setOpenDocId] = useState<number | null>(null);
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
    if (!confirm("Delete this document and all its chunks?")) return;
    await deleteDocument(docId);
    if (openDocId === docId) {
      setOpenDocId(null);
      setChunks(null);
    }
    await refreshDocuments();
  }

  async function toggleChunks(docId: number) {
    if (openDocId === docId) {
      setOpenDocId(null);
      setChunks(null);
      return;
    }
    setOpenDocId(docId);
    setChunks(null);
    setChunks(await listDocumentChunks(docId));
  }

  return (
    <div className="space-y-8">
      <div>
        {topic && (
          <Link to={`/subjects/${topic.subject_id}`} className="text-sm text-indigo-600 hover:underline">
            ← Back to subject
          </Link>
        )}
        <h2 className="mt-2 text-2xl font-bold text-slate-900">{topic?.name ?? "…"}</h2>
        {topic?.description && <p className="mt-1 text-slate-500">{topic.description}</p>}
      </div>

      <nav className="flex gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-t-lg px-4 py-2 text-sm font-medium ${
              tab === t
                ? "border border-b-0 border-slate-200 bg-white text-indigo-700"
                : "text-slate-500 hover:text-slate-900"
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
        <h3 className="mb-4 text-lg font-semibold text-slate-900">Reading material</h3>

        <form
          onSubmit={onUpload}
          className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <input
            ref={fileInput}
            type="file"
            accept=".pdf,.txt,.md"
            required
            className="text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-indigo-700 hover:file:bg-indigo-100"
          />
          <button
            type="submit"
            disabled={uploading}
            className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {uploading ? "Uploading…" : "Upload"}
          </button>
          <span className="text-xs text-slate-400">PDF, TXT, or MD · max 25 MB</span>
        </form>
        {error && <p className="mb-3 text-sm text-rose-600">{error}</p>}

        {documents === null && <p className="text-slate-500">Loading…</p>}
        {documents !== null && documents.length === 0 && (
          <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-slate-500">
            No documents yet — upload the reading material for this topic.
          </p>
        )}

        <ul className="space-y-2">
          {(documents ?? []).map((d) => (
            <li key={d.id} className="rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-medium text-slate-900">
                    {d.title} <StatusBadge status={d.status} />
                  </p>
                  <p className="text-xs text-slate-500">
                    {d.original_filename}
                    {d.status === "ready" && ` · ${d.page_count} pages · ${d.chunk_count} chunks`}
                  </p>
                  {d.status === "failed" && d.error && (
                    <p className="mt-1 text-sm text-rose-600">{d.error}</p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {d.status === "ready" && (
                    <button
                      onClick={() => toggleChunks(d.id)}
                      className="text-sm font-medium text-indigo-600 hover:underline"
                    >
                      {openDocId === d.id ? "Hide chunks" : "View chunks"}
                    </button>
                  )}
                  <button
                    onClick={() => onDelete(d.id)}
                    className="text-sm text-slate-400 hover:text-rose-600"
                    title="Delete document"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {openDocId === d.id && (
                <div className="border-t border-slate-100 px-4 py-3">
                  {chunks === null && <p className="text-sm text-slate-500">Loading chunks…</p>}
                  {chunks !== null && (
                    <ul className="space-y-3">
                      {chunks.map((c) => (
                        <li key={c.id} className="rounded-lg bg-slate-50 p-3">
                          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                            Chunk {c.chunk_index + 1} · page {c.page_number} · ~
                            {Math.round(c.content.length / 4)} tokens
                          </p>
                          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                            {c.content}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
