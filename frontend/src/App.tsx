import { BrowserRouter, Link, Outlet, Route, Routes } from "react-router-dom";

function NotFoundPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4">
      <h1 className="text-5xl font-bold text-slate-300">404</h1>
      <p className="mt-2 text-slate-600">This page doesn't exist.</p>
      <Link to="/" className="mt-4 font-medium text-indigo-600 hover:underline">
        ← Back to your subjects
      </Link>
    </main>
  );
}
import { AuthProvider, RequireAuth, useAuth } from "./auth";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import StatusPage from "./pages/StatusPage";
import QuizPage from "./pages/QuizPage";
import ReviewPage from "./pages/ReviewPage";
import SubjectPage from "./pages/SubjectPage";
import SubjectsPage from "./pages/SubjectsPage";
import TopicPage from "./pages/TopicPage";

function Layout() {
  const { user, signOut } = useAuth();
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <Link to="/" className="text-lg font-bold text-slate-900">
            Groundwork
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <Link to="/review" className="font-medium text-indigo-600 hover:underline">
              Review
            </Link>
            <span className="text-slate-500">{user?.display_name}</span>
            <button onClick={signOut} className="text-slate-500 hover:text-slate-900">
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
            <Route index element={<SubjectsPage />} />
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
