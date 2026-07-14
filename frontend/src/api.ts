// Central place for talking to the backend. Every fetch in the app goes
// through request(), which attaches the auth token and normalizes errors.
const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

const TOKEN_KEY = "groundwork_token";

let token: string | null = localStorage.getItem(TOKEN_KEY);

export function setToken(next: string | null) {
  token = next;
  if (next) localStorage.setItem(TOKEN_KEY, next);
  else localStorage.removeItem(TOKEN_KEY);
}

export function hasToken(): boolean {
  return token !== null;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  // A 401 while we HOLD a token means the token expired or was revoked —
  // drop it and send the user to login instead of every action silently
  // failing. (A 401 with no token is just a wrong password on /login.)
  if (res.status === 401 && token) {
    setToken(null);
    window.location.assign("/login");
  }
  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (typeof body.detail === "string") detail = body.detail;
    } catch {
      // response body wasn't JSON; keep the generic message
    }
    throw new ApiError(res.status, detail);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

function postJson<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function patchJson<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ---------- types (mirror the backend's response schemas) ----------

export interface User {
  id: number;
  email: string;
  display_name: string;
}

export interface Subject {
  id: number;
  name: string;
  description: string;
  created_at: string;
  topic_count: number;
}

export interface Topic {
  id: number;
  subject_id: number;
  name: string;
  description: string;
  position: number;
  created_at: string;
}

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

// ---------- auth ----------

export const registerUser = (email: string, password: string, displayName: string) =>
  postJson<User>("/api/auth/register", {
    email,
    password,
    display_name: displayName,
  });

export async function login(email: string, password: string): Promise<void> {
  // The login endpoint speaks the OAuth2 password form: urlencoded body,
  // and the email travels in a field named "username".
  const data = await request<{ access_token: string }>("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username: email, password }),
  });
  setToken(data.access_token);
}

export const fetchMe = () => request<User>("/api/auth/me");

// ---------- subjects & topics ----------

export const listSubjects = () => request<Subject[]>("/api/subjects");
export const getSubject = (id: number) => request<Subject>(`/api/subjects/${id}`);
export const createSubject = (name: string, description: string) =>
  postJson<Subject>("/api/subjects", { name, description });
export const deleteSubject = (id: number) =>
  request<void>(`/api/subjects/${id}`, { method: "DELETE" });
export const updateSubject = (id: number, fields: { name?: string; description?: string }) =>
  patchJson<Subject>(`/api/subjects/${id}`, fields);

export const listTopics = (subjectId: number) =>
  request<Topic[]>(`/api/subjects/${subjectId}/topics`);
export const createTopic = (subjectId: number, name: string, description: string) =>
  postJson<Topic>(`/api/subjects/${subjectId}/topics`, { name, description });
export const deleteTopic = (id: number) =>
  request<void>(`/api/topics/${id}`, { method: "DELETE" });
export const updateTopic = (id: number, fields: { name?: string; description?: string }) =>
  patchJson<Topic>(`/api/topics/${id}`, fields);

// ---------- status page ----------

export const fetchHealth = () => request<HealthResponse>("/api/health");
export const fetchDbCheck = () => request<DbCheckResponse>("/api/db-check");
