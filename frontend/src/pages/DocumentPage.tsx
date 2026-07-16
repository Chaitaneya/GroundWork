import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
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
    <div className="flex h-[calc(100vh-8.5rem)] flex-col gap-4 lg:h-[calc(100vh-7rem)] lg:flex-row">
      {/* viewer */}
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
          <div className="min-w-0">
            {doc && (
              <Link
                to={`/topics/${doc.topic_id}`}
                className="text-xs text-teal-300 hover:underline"
              >
                Back to topic
              </Link>
            )}
            <p className="truncate text-sm font-medium text-slate-100">
              {doc?.title ?? "Loading"}
            </p>
          </div>
          {doc && (
            <span className="shrink-0 text-xs text-slate-500">
              {doc.page_count} page{doc.page_count === 1 ? "" : "s"}
            </span>
          )}
        </div>
        <div className="min-h-64 flex-1 bg-black/30">
          {viewerError && <p className="p-6 text-sm text-slate-400">{viewerError}</p>}
          {fileUrl && <iframe src={fileUrl} title="Document" className="h-full w-full" />}
          {fileText !== null && (
            <div className="h-full overflow-y-auto p-5">
              <pre className="font-sans text-sm leading-relaxed whitespace-pre-wrap text-slate-300">
                {fileText}
              </pre>
            </div>
          )}
        </div>
      </section>

      {/* chat */}
      <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] lg:w-[380px]">
        <div className="border-b border-white/10 px-4 py-2.5">
          <p className="text-sm font-medium text-slate-100">Ask this document</p>
          <p className="text-xs text-slate-500">Answers come only from this file, with page references.</p>
        </div>

        <div ref={scrollRef} className="min-h-40 flex-1 space-y-3 overflow-y-auto p-4">
          {messages.length === 0 && !thinking && (
            <p className="text-sm text-slate-500">
              Try: "Summarize this document" or "Explain the hardest concept here simply."
            </p>
          )}
          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "bg-gradient-to-r from-teal-500/80 to-cyan-500/80 text-white"
                    : "border border-white/10 bg-white/[0.07] text-slate-200"
                }`}
              >
                <p className="whitespace-pre-wrap">{m.content}</p>
                {m.sources && m.sources.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {m.sources.map((s, j) => (
                      <span
                        key={j}
                        title={s.snippet}
                        className="cursor-help rounded-full border border-teal-300/30 bg-teal-400/10 px-2 py-0.5 text-[11px] text-teal-200"
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
              <div className="rounded-2xl border border-white/10 bg-white/[0.07] px-3.5 py-2 text-sm text-slate-400">
                Reading the document…
              </div>
            </div>
          )}
        </div>

        <form onSubmit={onSend} className="flex gap-2 border-t border-white/10 p-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything about this file"
            maxLength={2000}
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-teal-300/50 focus:outline-none"
          />
          <button
            type="submit"
            disabled={thinking || !input.trim()}
            className="rounded-xl bg-gradient-to-r from-teal-400 to-cyan-400 px-3.5 text-white transition hover:brightness-110 disabled:opacity-40"
            title="Send"
          >
            <SendIcon />
          </button>
        </form>
      </section>
    </div>
  );
}
