import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ApiError,
  chatWithDocument,
  fetchDocumentFileUrl,
  getDocument,
  type ChatSource,
  type Document,
} from "../api";
import { SendIcon } from "../components/icons";

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: ChatSource[];
}

export default function DocumentPage() {
  const { documentId } = useParams();
  const id = Number(documentId);
  const navigate = useNavigate();

  const [doc, setDoc] = useState<Document | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileText, setFileText] = useState<string | null>(null);
  const [viewerError, setViewerError] = useState<string | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getDocument(id).then(setDoc).catch((e: Error) => setViewerError(e.message));
  }, [id]);

  useEffect(() => {
    if (!doc) return;
    let url: string | null = null;
    fetchDocumentFileUrl(id)
      .then(async (u) => {
        if (doc.original_filename.toLowerCase().endsWith(".pdf")) {
          url = u;
          setFileUrl(u);
        } else {
          setFileText(await (await fetch(u)).text());
          URL.revokeObjectURL(u);
        }
      })
      .catch((e: Error) => setViewerError(e.message));
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [doc, id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  async function onSend(e: FormEvent) {
    e.preventDefault();
    const question = input.trim();
    if (!question || thinking) return;
    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setInput("");
    setThinking(true);
    try {
      const reply = await chatWithDocument(id, question, history);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: reply.answer, sources: reply.sources },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            err instanceof ApiError ? err.message : "Something went wrong — try again.",
        },
      ]);
    } finally {
      setThinking(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-8.5rem)] flex-col lg:h-[calc(100vh-7rem)]">
      {/* page header with a clear way back */}
      <div className="mb-3 flex items-center gap-3">
        <button
          onClick={() => (doc ? navigate(`/topics/${doc.topic_id}`) : navigate(-1))}
          className="btn-quiet shrink-0 px-3 py-1.5 text-sm"
        >
          ← Back
        </button>
        <p className="min-w-0 truncate font-display text-lg font-semibold text-card">
          {doc?.title ?? "Loading"}
        </p>
        {doc && (
          <span className="ml-auto shrink-0 font-mono text-xs text-dust/80">
            {doc.page_count} page{doc.page_count === 1 ? "" : "s"}
          </span>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
      {/* viewer */}
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-edge bg-lamp">
        <div className="min-h-64 flex-1 bg-[#100e0b]">
          {viewerError && <p className="p-6 text-sm text-dust">{viewerError}</p>}
          {fileUrl && <iframe src={fileUrl} title="Document" className="h-full w-full" />}
          {fileText !== null && (
            <div className="h-full overflow-y-auto p-5">
              <pre className="font-sans text-sm leading-relaxed whitespace-pre-wrap text-chalk">
                {fileText}
              </pre>
            </div>
          )}
        </div>
      </section>

      {/* chat */}
      <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-edge bg-lamp lg:w-[380px]">
        <div className="border-b border-edge px-4 py-2.5">
          <p className="text-sm font-medium text-card">Ask this document</p>
          <p className="text-xs text-dust/80">Answers come only from this file, with page references.</p>
        </div>

        <div ref={scrollRef} className="min-h-40 flex-1 space-y-3 overflow-y-auto p-4">
          {messages.length === 0 && !thinking && (
            <p className="text-sm text-dust/80">
              Try: "Summarize this document" or "Explain the hardest concept here simply."
            </p>
          )}
          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "bg-card text-ink"
                    : "border border-edge bg-lamp text-chalk"
                }`}
              >
                <p className="whitespace-pre-wrap">{m.content}</p>
                {m.sources && m.sources.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {m.sources.map((s, j) => (
                      <span
                        key={j}
                        title={s.snippet}
                        className="cursor-help rounded-full border border-marker/40 bg-marker/12 px-2 py-0.5 text-[11px] text-marker"
                      >
                        p. {s.page_number}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {thinking && (
            <div className="flex justify-start">
              <div className="rounded-2xl border border-edge bg-lamp px-3.5 py-2 text-sm text-dust">
                Reading the document…
              </div>
            </div>
          )}
        </div>

        <form onSubmit={onSend} className="flex gap-2 border-t border-edge p-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything about this file"
            maxLength={2000}
            className="min-w-0 flex-1 rounded-xl border border-edge bg-lamp px-3 py-2 text-sm text-card placeholder:text-dust/80 focus:border-marker/70 focus:outline-none"
          />
          <button
            type="submit"
            disabled={thinking || !input.trim()}
            className="rounded-xl bg-marker px-3.5 text-ink transition hover:bg-[#ffe070] disabled:opacity-40"
            title="Send"
          >
            <SendIcon />
          </button>
        </form>
      </section>
      </div>
    </div>
  );
}
