// Central place for talking to the backend. Every fetch in the app goes
// through here, so switching the base URL (e.g. at deploy time) is one line.
const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export interface HealthResponse {
  status: string;
  app: string;
}

export interface DbCheckResponse {
  connected: boolean;
  detail?: string;
  postgres_version?: string;
  server_time?: string;
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`${path} responded ${res.status}`);
  return res.json() as Promise<T>;
}

export const fetchHealth = () => getJson<HealthResponse>("/api/health");
export const fetchDbCheck = () => getJson<DbCheckResponse>("/api/db-check");
