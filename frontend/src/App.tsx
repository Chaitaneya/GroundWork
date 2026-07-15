import { BrowserRouter, Link, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { AuthProvider, RequireAuth, useAuth } from "./auth";
import Wordmark from "./components/Wordmark";
import DashboardPage from "./pages/DashboardPage";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import QuizPage from "./pages/QuizPage";
import RegisterPage from "./pages/RegisterPage";
import ReviewPage from "./pages/ReviewPage";
import StatusPage from "./pages/StatusPage";
import SubjectPage from "./pages/SubjectPage";
import SubjectsPage from "./pages/SubjectsPage";
import TopicPage from "./pages/TopicPage";

function NotFoundPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4">
      <h1 className="font-display text-6xl font-bold text-zinc-700">404</h1>
      <p className="mt-2 text-zinc-400">This page doesn't exist.</p>
      <Link to="/" className="mt-4 font-medium text-violet-400 hover:underline">
        ← Take me home
      </Link>
    </main>
  );
}

/** Visitors see the landing page; signed-in users go straight to the dashboard. */
function HomeGate() {
  const { user, initializing } = useAuth();
  if (initializing) return null;
  return user ? <Navigate to="/dashboard" replace /> : <LandingPage />;
}

function Layout() {
  const { user, signOut } = useAuth();
  const nav = "font-medium text-zinc-400 transition hover:text-zinc-100";
  return (
    <div className="min-h-screen bg-zinc-950">
      <header className="sticky top-0 z-40 border-b border-zinc-800/60 bg-zinc-950/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <Link to="/dashboard">
            <Wordmark />
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <Link to="/dashboard" className={nav}>
              Dashboard
            </Link>
            <Link to="/subjects" className={nav}>
              Subjects
            </Link>
            <Link to="/review" className="font-medium text-violet-400 transition hover:text-violet-300">
              Review
            </Link>
            <span className="hidden text-zinc-500 sm:inline">{user?.display_name}</span>
            <button onClick={signOut} className="text-zinc-500 hover:text-zinc-100">
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomeGate />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/status" element={<StatusPage />} />
          <Route
            element={
              <RequireAuth>
                <Layout />
              </RequireAuth>
            }
          >
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/subjects" element={<SubjectsPage />} />
            <Route path="/subjects/:subjectId" element={<SubjectPage />} />
            <Route path="/topics/:topicId" element={<TopicPage />} />
            <Route path="/quizzes/:quizId" element={<QuizPage />} />
            <Route path="/review" element={<ReviewPage />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
