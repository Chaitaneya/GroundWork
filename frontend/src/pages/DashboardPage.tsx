import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchDashboard, type Dashboard, type TopicStat } from "../api";

function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.06] backdrop-blur-xl p-5 shadow-sm">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-1 text-3xl font-bold text-slate-100">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

function WeaknessRow({ t }: { t: TopicStat }) {
  const parts = [
    t.quiz_accuracy !== null && `quiz ${Math.round(t.quiz_accuracy * 100)}%`,
    t.again_rate !== null && `forgot ${Math.round(t.again_rate * 100)}% of reviews`,
    t.avg_ease !== null && `ease ${t.avg_ease.toFixed(2)}`,
  ].filter(Boolean);
  return (
    <li className="py-3">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <Link to={`/topics/${t.topic_id}`} className="min-w-0 truncate font-medium text-slate-100 hover:text-teal-200">
          {t.topic_name}
          <span className="ml-2 text-xs font-normal text-slate-500">{t.subject_name}</span>
        </Link>
        <span className="shrink-0 text-sm font-semibold text-slate-300">{t.weakness}</span>
      </div>
      {/* single-hue magnitude bar: length encodes weakness, color stays constant */}
      <div className="h-2.5 w-full overflow-hidden rounded bg-white/10" title={`Weakness ${t.weakness} / 100`}>
        <div className="h-full rounded bg-gradient-to-r from-teal-400 to-cyan-400" style={{ width: `${t.weakness}%` }} />
      </div>
      <p className="mt-1 text-xs text-slate-500">{parts.join(" · ")}</p>
    </li>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboard().then(setData).catch((e: Error) => setError(e.message));
  }, []);

  if (error) return <p className="text-rose-400">{error}</p>;
  if (!data) return <p className="text-slate-400">Loading your dashboard…</p>;

  const ranked = data.topics
    .filter((t) => t.weakness !== null)
    .sort((a, b) => (b.weakness ?? 0) - (a.weakness ?? 0));
  const unranked = data.topics.filter((t) => t.weakness === null);
  const weekTotal = data.reviews_by_day.reduce((sum, d) => sum + d.count, 0);
  const maxDay = Math.max(1, ...data.reviews_by_day.map((d) => d.count));

  return (
    <div className="space-y-8">
      <h2 className="text-xl font-semibold text-slate-100">Dashboard</h2>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile
          label="Cards due now"
          value={String(data.due_now)}
          hint={data.due_now > 0 ? "Weakest topics come first in the queue" : "All caught up"}
        />
        <StatTile label="Reviews this week" value={String(weekTotal)} />
        <StatTile label="Topics tracked" value={String(data.topics.length)} />
      </div>

      {data.due_now > 0 && (
        <Link
          to="/review"
          className="inline-block rounded-lg bg-gradient-to-r from-teal-400 to-cyan-400 px-4 py-2 font-medium text-white hover:brightness-110"
        >
          Start reviewing →
        </Link>
      )}

      <section className="rounded-xl border border-white/10 bg-white/[0.06] backdrop-blur-xl p-5 shadow-sm">
        <h3 className="font-semibold text-slate-100">Weakest topics</h3>
        <p className="mt-0.5 text-xs text-slate-500">
          Score 0–100 from recent quiz accuracy, forgotten reviews, and card ease — higher means weaker.
        </p>
        {ranked.length === 0 ? (
          <p className="mt-4 text-sm text-slate-400">
            No signal yet — review some flashcards or take a quiz, and weakness scores appear here.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-white/10">
            {ranked.map((t) => (
              <WeaknessRow key={t.topic_id} t={t} />
            ))}
          </ul>
        )}
        {unranked.length > 0 && (
          <p className="mt-3 text-xs text-slate-500">
            Not enough data yet: {unranked.map((t) => t.topic_name).join(", ")}
          </p>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-white/10 bg-white/[0.06] backdrop-blur-xl p-5 shadow-sm">
          <h3 className="font-semibold text-slate-100">Review activity — last 7 days</h3>
          <div className="mt-4 flex h-32 items-end gap-2">
            {data.reviews_by_day.map((d) => (
              <div key={d.day} className="flex flex-1 flex-col items-center gap-1" title={`${d.day}: ${d.count} reviews`}>
                <span className="text-xs text-slate-400">{d.count > 0 ? d.count : ""}</span>
                <div
                  className="w-full max-w-8 rounded-t bg-gradient-to-r from-teal-400 to-cyan-400"
                  style={{ height: `${Math.max(d.count > 0 ? 8 : 2, (d.count / maxDay) * 96)}px` }}
                />
                <span className="text-[10px] text-slate-500">{d.day.slice(5)}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-white/10 bg-white/[0.06] backdrop-blur-xl p-5 shadow-sm">
          <h3 className="font-semibold text-slate-100">Recent quiz attempts</h3>
          {data.recent_attempts.length === 0 ? (
            <p className="mt-4 text-sm text-slate-400">No attempts yet — take a quiz from any topic.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {data.recent_attempts.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-slate-300">
                    {a.quiz_title}
                    <span className="ml-2 text-xs text-slate-500">{a.topic_name}</span>
                  </span>
                  <span className={`shrink-0 font-semibold ${
                    (a.score_pct ?? 0) >= 60 ? "text-emerald-400" : "text-rose-400"
                  }`}>
                    {a.score_pct}%
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
