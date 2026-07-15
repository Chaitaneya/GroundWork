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

export interface Document {
  id: number;
  topic_id: number;
  title: string;
  original_filename: string;
  status: "processing" | "ready" | "failed";
  page_count: number;
  error: string | null;
  created_at: string;
  chunk_count: number;
}

export interface Chunk {
  id: number;
  chunk_index: number;
  page_number: number;
  content: string;
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

export const getTopic = (id: number) => request<Topic>(`/api/topics/${id}`);
export const listTopics = (subjectId: number) =>
  request<Topic[]>(`/api/subjects/${subjectId}/topics`);
export const createTopic = (subjectId: number, name: string, description: string) =>
  postJson<Topic>(`/api/subjects/${subjectId}/topics`, { name, description });
export const deleteTopic = (id: number) =>
  request<void>(`/api/topics/${id}`, { method: "DELETE" });
export const updateTopic = (id: number, fields: { name?: string; description?: string }) =>
  patchJson<Topic>(`/api/topics/${id}`, fields);

// ---------- documents & chunks ----------

export function uploadDocument(topicId: number, file: File): Promise<Document> {
  const form = new FormData();
  form.append("file", file);
  // No Content-Type header here — the browser sets multipart/form-data
  // with the boundary itself. Setting it manually breaks the upload.
  return request<Document>(`/api/topics/${topicId}/documents`, {
    method: "POST",
    body: form,
  });
}

export const listDocuments = (topicId: number) =>
  request<Document[]>(`/api/topics/${topicId}/documents`);
export const deleteDocument = (id: number) =>
  request<void>(`/api/documents/${id}`, { method: "DELETE" });
export const listDocumentChunks = (documentId: number) =>
  request<Chunk[]>(`/api/documents/${documentId}/chunks`);

// ---------- notes ----------

export interface Note {
  id: number;
  topic_id: number;
  title: string;
  content_md: string;
  origin: "manual" | "ai";
  pending: boolean;
  created_at: string;
  updated_at: string;
}

export const listNotes = (topicId: number) => request<Note[]>(`/api/topics/${topicId}/notes`);
export const createNote = (topicId: number, title: string, content_md: string) =>
  postJson<Note>(`/api/topics/${topicId}/notes`, { title, content_md });
export const updateNote = (id: number, fields: { title?: string; content_md?: string }) =>
  patchJson<Note>(`/api/notes/${id}`, fields);
export const deleteNote = (id: number) => request<void>(`/api/notes/${id}`, { method: "DELETE" });

// ---------- flashcards & review ----------

export interface Flashcard {
  id: number;
  topic_id: number;
  front: string;
  back: string;
  origin: "manual" | "ai";
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  lapses: number;
  due_at: string;
  suspended: boolean;
  pending: boolean;
  created_at: string;
}

export interface QueueCard extends Flashcard {
  topic_name: string;
  subject_name: string;
}

export const listFlashcards = (topicId: number) =>
  request<Flashcard[]>(`/api/topics/${topicId}/flashcards`);
export const createFlashcard = (topicId: number, front: string, back: string) =>
  postJson<Flashcard>(`/api/topics/${topicId}/flashcards`, { front, back });
export const updateFlashcard = (id: number, fields: { front?: string; back?: string; suspended?: boolean }) =>
  patchJson<Flashcard>(`/api/flashcards/${id}`, fields);
export const deleteFlashcard = (id: number) =>
  request<void>(`/api/flashcards/${id}`, { method: "DELETE" });
export const reviewFlashcard = (id: number, rating: 1 | 2 | 3 | 4) =>
  postJson<Flashcard>(`/api/flashcards/${id}/review`, { rating });
export const fetchReviewQueue = () => request<QueueCard[]>("/api/review/queue");

// ---------- quizzes ----------

export interface QuestionOption {
  id: number;
  option_text: string;
  is_correct: boolean;
}

export interface Question {
  id: number;
  qtype: "mcq" | "true_false" | "short_answer";
  prompt: string;
  answer_text: string | null;
  explanation: string;
  origin: string;
  position: number;
  options: QuestionOption[];
}

export interface Quiz {
  id: number;
  topic_id: number;
  title: string;
  origin: string;
  pending: boolean;
  created_at: string;
  question_count: number;
}

export interface QuizDetail extends Quiz {
  questions: Question[];
}

export interface QuestionResult {
  question_id: number;
  is_correct: boolean;
  correct_answer: string;
  explanation: string;
}

export interface AttemptResult {
  id: number;
  score_pct: number;
  results: QuestionResult[];
}

export interface Attempt {
  id: number;
  started_at: string;
  score_pct: number | null;
}

export interface NewQuestion {
  qtype: Question["qtype"];
  prompt: string;
  options: { option_text: string; is_correct: boolean }[];
  answer_text: string | null;
  explanation: string;
}

export const listQuizzes = (topicId: number) => request<Quiz[]>(`/api/topics/${topicId}/quizzes`);
export const createQuiz = (topicId: number, title: string) =>
  postJson<Quiz>(`/api/topics/${topicId}/quizzes`, { title });
export const getQuiz = (id: number) => request<QuizDetail>(`/api/quizzes/${id}`);
export const deleteQuiz = (id: number) => request<void>(`/api/quizzes/${id}`, { method: "DELETE" });
export const addQuestion = (quizId: number, q: NewQuestion) =>
  postJson<Question>(`/api/quizzes/${quizId}/questions`, q);
export const deleteQuestion = (id: number) =>
  request<void>(`/api/questions/${id}`, { method: "DELETE" });
export const submitAttempt = (quizId: number, answers: { question_id: number; given_answer: string }[]) =>
  postJson<AttemptResult>(`/api/quizzes/${quizId}/attempts`, { answers });
export const listAttempts = (quizId: number) =>
  request<Attempt[]>(`/api/quizzes/${quizId}/attempts`);

// ---------- AI generation ----------

export type GenerationKind = "notes" | "flashcards" | "quiz";

export interface GenerationJob {
  id: number;
  topic_id: number;
  kind: GenerationKind;
  status: "queued" | "running" | "done" | "failed";
  model: string;
  created_count: number;
  rejected_count: number;
  error: string | null;
  created_at: string;
  finished_at: string | null;
}

export type QuizDifficulty = "intro" | "standard" | "exam";

export const startGeneration = (
  topicId: number,
  kind: GenerationKind,
  count = 10,
  difficulty: QuizDifficulty = "standard",
) => postJson<GenerationJob>(`/api/topics/${topicId}/generate`, { kind, count, difficulty });
export const listGenerationJobs = (topicId: number) =>
  request<GenerationJob[]>(`/api/topics/${topicId}/generation-jobs`);

export const acceptAllPending = (topicId: number, kind: GenerationKind) =>
  postJson<void>(`/api/topics/${topicId}/pending/accept-all`, { kind });
export const discardAllPending = (topicId: number, kind: GenerationKind) =>
  postJson<void>(`/api/topics/${topicId}/pending/discard-all`, { kind });

export const acceptFlashcard = (id: number) =>
  request<void>(`/api/flashcards/${id}/accept`, { method: "POST" });
export const acceptNote = (id: number) =>
  request<void>(`/api/notes/${id}/accept`, { method: "POST" });
export const acceptQuiz = (id: number) =>
  request<void>(`/api/quizzes/${id}/accept`, { method: "POST" });

export const fetchFlashcardSources = (id: number) =>
  request<Chunk[]>(`/api/flashcards/${id}/sources`);
export const fetchNoteSources = (id: number) => request<Chunk[]>(`/api/notes/${id}/sources`);
export const fetchQuestionSources = (id: number) =>
  request<Chunk[]>(`/api/questions/${id}/sources`);

// ---------- analytics ----------

export interface TopicStat {
  topic_id: number;
  topic_name: string;
  subject_name: string;
  card_count: number;
  due_count: number;
  review_count: number;
  again_rate: number | null;
  avg_ease: number | null;
  quiz_attempt_count: number;
  quiz_accuracy: number | null;
  weakness: number | null;
}

export interface Dashboard {
  topics: TopicStat[];
  due_now: number;
  reviews_by_day: { day: string; count: number }[];
  recent_attempts: {
    id: number;
    quiz_title: string;
    topic_name: string;
    score_pct: number | null;
    started_at: string;
  }[];
}

export const fetchDashboard = () => request<Dashboard>("/api/analytics/overview");

// ---------- status page ----------

export const fetchHealth = () => request<HealthResponse>("/api/health");
export const fetchDbCheck = () => request<DbCheckResponse>("/api/db-check");
