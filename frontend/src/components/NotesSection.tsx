import { useCallback, useEffect, useState, type FormEvent } from "react";
import ReactMarkdown from "react-markdown";
import {
  acceptNote,
  ApiError,
  createNote,
  deleteNote,
  fetchNoteSources,
  listNotes,
  updateNote,
  type Note,
} from "../api";
import GenerateBar from "./GenerateBar";
import SourcesView from "./SourcesView";

export default function NotesSection({ topicId }: { topicId: number }) {
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [editing, setEditing] = useState<{ id: number; title: string; content: string } | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    () => listNotes(topicId).then(setNotes).catch((e: Error) => setError(e.message)),
    [topicId],
  );
  useEffect(() => {
    load();
  }, [load]);

  async function onAccept(id: number) {
    await acceptNote(id);
    setNotes((prev) => (prev ?? []).map((n) => (n.id === id ? { ...n, pending: false } : n)));
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const note = await createNote(topicId, title.trim(), content);
      setNotes((prev) => [...(prev ?? []), note]);
      setTitle("");
      setContent("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reach the server");
    }
  }

  async function onSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const updated = await updateNote(editing.id, {
      title: editing.title.trim(),
      content_md: editing.content,
    });
    setNotes((prev) => (prev ?? []).map((n) => (n.id === updated.id ? updated : n)));
    setEditing(null);
  }

  async function onDelete(id: number) {
    if (!confirm("Delete this note?")) return;
    await deleteNote(id);
    setNotes((prev) => (prev ?? []).filter((n) => n.id !== id));
  }

  return (
    <div className="space-y-6">
      <GenerateBar topicId={topicId} kind="notes" onDone={load} />
      {notes === null && <p className="text-slate-500">Loading…</p>}
      {notes !== null && notes.length === 0 && (
        <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-slate-500">
          No notes yet — write your first note below.
        </p>
      )}
      <ul className="space-y-2">
        {(notes ?? []).map((n) => (
          <li
            key={n.id}
            className={`rounded-lg border bg-white shadow-sm ${
              n.pending ? "border-amber-300" : "border-slate-200"
            }`}
          >
            {editing?.id === n.id ? (
              <form onSubmit={onSaveEdit} className="space-y-2 p-4">
                <input
                  required
                  value={editing.title}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 focus:border-indigo-500 focus:outline-none"
                />
                <textarea
                  rows={8}
                  value={editing.content}
                  onChange={(e) => setEditing({ ...editing, content: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm focus:border-indigo-500 focus:outline-none"
                />
                <div className="flex gap-2">
                  <button type="submit" className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700">
                    Save
                  </button>
                  <button type="button" onClick={() => setEditing(null)} className="px-3 py-1.5 text-sm text-slate-500 hover:text-slate-900">
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <>
                <div className="flex items-center justify-between px-4 py-3">
                  <button
                    onClick={() => setOpenId(openId === n.id ? null : n.id)}
                    className="min-w-0 flex-1 text-left font-medium text-slate-900 hover:text-indigo-700"
                  >
                    {n.title}
                    {n.pending && (
                      <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                        AI — review
                      </span>
                    )}
                  </button>
                  <div className="ml-3 flex gap-2">
                    <button
                      onClick={() => setEditing({ id: n.id, title: n.title, content: n.content_md })}
                      className="text-sm text-slate-400 hover:text-indigo-600"
                      title="Edit note"
                    >
                      ✎
                    </button>
                    <button onClick={() => onDelete(n.id)} className="text-sm text-slate-400 hover:text-rose-600" title="Delete note">
                      ✕
                    </button>
                  </div>
                </div>
                {openId === n.id && (
                  <div className="border-t border-slate-100 px-4 py-3">
                    <div className="prose prose-sm max-w-none text-slate-700 [&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1 [&_h1]:text-lg [&_h2]:text-base [&_h3]:text-sm [&_li]:ml-4 [&_ul]:list-disc">
                      <ReactMarkdown>{n.content_md || "*This note is empty.*"}</ReactMarkdown>
                    </div>
                    {n.origin === "ai" && (
                      <div className="mt-3">
                        <SourcesView fetch={() => fetchNoteSources(n.id)} />
                      </div>
                    )}
                    {n.pending && (
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => onAccept(n.id)}
                          className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => onDelete(n.id)}
                          className="rounded-lg bg-white px-3 py-1 text-xs font-medium text-rose-600 ring-1 ring-rose-200 hover:bg-rose-50"
                        >
                          Discard
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </li>
        ))}
      </ul>

      <form onSubmit={onCreate} className="max-w-xl space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h4 className="font-semibold text-slate-900">Add a note</h4>
        <input
          required
          maxLength={255}
          placeholder="Note title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none"
        />
        <textarea
          rows={6}
          placeholder="Write in Markdown — # headings, **bold**, - lists…"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm focus:border-indigo-500 focus:outline-none"
        />
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700">
          Add note
        </button>
      </form>
    </div>
  );
}
