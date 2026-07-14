import { useEffect, useState } from "react";
import {
  fetchDbCheck,
  fetchHealth,
  type DbCheckResponse,
  type HealthResponse,
} from "./api";

type Loadable<T> =
  | { state: "loading" }
  | { state: "error"; message: string }
  | { state: "ok"; data: T };

function useLoad<T>(loader: () => Promise<T>): Loadable<T> {
  const [value, setValue] = useState<Loadable<T>>({ state: "loading" });
  useEffect(() => {
    loader()
      .then((data) => setValue({ state: "ok", data }))
      .catch((err: Error) => setValue({ state: "error", message: err.message }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return value;
}

function StatusDot({ ok }: { ok: boolean | null }) {
  const color = ok === null ? "bg-amber-400" : ok ? "bg-emerald-500" : "bg-rose-500";
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${color}`} />;
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
      {children}
    </section>
  );
}

export default function App() {
  const health = useLoad<HealthResponse>(fetchHealth);
  const db = useLoad<DbCheckResponse>(fetchDbCheck);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12">
      <div className="mx-auto max-w-2xl space-y-6">
        <header>
          <h1 className="text-3xl font-bold text-slate-900">Groundwork</h1>
          <p className="mt-1 text-slate-600">Phase 0 — system status</p>
        </header>

        <Card title="Backend API">
          {health.state === "loading" && (
            <p className="flex items-center gap-2 text-slate-500"><StatusDot ok={null} /> Checking…</p>
          )}
          {health.state === "error" && (
            <div className="flex items-start gap-2">
              <StatusDot ok={false} />
              <p className="text-slate-700">
                Not reachable ({health.message}). Is uvicorn running on port 8000?
              </p>
            </div>
          )}
          {health.state === "ok" && (
            <p className="flex items-center gap-2 text-slate-700">
              <StatusDot ok={true} /> FastAPI is up — <code className="rounded bg-slate-100 px-1">{health.data.app}</code>
            </p>
          )}
        </Card>

        <Card title="Database (Neon Postgres)">
          {db.state === "loading" && (
            <p className="flex items-center gap-2 text-slate-500"><StatusDot ok={null} /> Checking…</p>
          )}
          {db.state === "error" && (
            <div className="flex items-start gap-2">
              <StatusDot ok={false} />
              <p className="text-slate-700">Couldn't reach the backend to check ({db.message}).</p>
            </div>
          )}
          {db.state === "ok" && db.data.connected && (
            <div className="space-y-1 text-slate-700">
              <p className="flex items-center gap-2"><StatusDot ok={true} /> Connected</p>
              <p className="text-sm text-slate-500">{db.data.postgres_version}</p>
              <p className="text-sm text-slate-500">Server time: {db.data.server_time}</p>
            </div>
          )}
          {db.state === "ok" && !db.data.connected && (
            <div className="flex items-start gap-2">
              <StatusDot ok={false} />
              <p className="text-slate-700">{db.data.detail}</p>
            </div>
          )}
        </Card>
      </div>
    </main>
  );
}
