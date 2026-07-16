import { lazy, Suspense } from "react";
import { BrowserRouter, Link, Navigate, NavLink, Outlet, Route, Routes } from "react-router-dom";
import { AuthProvider, RequireAuth, useAuth } from "./auth";
import { BookIcon, HomeIcon, ZapIcon } from "./components/icons";
import Wordmark from "./components/Wordmark";

// Route-level code splitting: each page loads only when visited.
const LandingPage = lazy(() => import("./pages/LandingPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const RegisterPage = lazy(() => import("./pages/RegisterPage"));
const StatusPage = lazy(() => import("./pages/StatusPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const SubjectsPage = lazy(() => import("./pages/SubjectsPage"));
const SubjectPage = lazy(() => import("./pages/SubjectPage"));
const TopicPage = lazy(() => import("./pages/TopicPage"));
const QuizPage = lazy(() => import("./pages/QuizPage"));
const ReviewPage = lazy(() => import("./pages/ReviewPage"));
const DocumentPage = lazy(() => import("./pages/DocumentPage"));

function NotFoundPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-transparent px-4">
      <h1 className="font-display text-6xl font-bold text-slate-700">404</h1>
      <p className="mt-2 text-slate-400">This page doesn't exist.</p>
      <Link to="/" className="mt-4 font-medium text-teal-300 hover:underline">
        Take me home
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

const NAV_ITEMS = [
  { to: "/dashboard", label: "Home", Icon: HomeIcon },
  { to: "/subjects", label: "Subjects", Icon: BookIcon },
  { to: "/review", label: "Review", Icon: ZapIcon },
];

function Layout() {
  const { user, signOut } = useAuth();
  return (
    <div className="min-h-screen bg-transparent">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-white/5 backdrop-blur-xl">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <Link to="/dashboard">
            <Wordmark />
          </Link>
          {/* desktop inline nav */}
          <div className="hidden items-center gap-5 text-sm sm:flex">
            {NAV_ITEMS.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) =>
                  `font-medium transition ${isActive ? "text-teal-300" : "text-slate-400 hover:text-slate-100"}`
                }
              >
                {n.label}
              </NavLink>
            ))}
            <span className="text-slate-500">{user?.display_name}</span>
            <button onClick={signOut} className="text-slate-500 hover:text-slate-100">
              Sign out
            </button>
          </div>
          {/* mobile: just a sign-out affordance up top */}
          <button
            onClick={signOut}
            className="text-sm font-medium text-slate-400 hover:text-slate-100 sm:hidden"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* extra bottom padding on mobile so the tab bar never covers content */}
      <main className="mx-auto max-w-4xl px-4 pt-6 pb-28 sm:py-8">
        <Outlet />
      </main>

      {/* mobile bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-white/[0.07] backdrop-blur-xl sm:hidden">
        <div className="mx-auto flex max-w-md items-stretch justify-around px-2 py-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))]">
          {NAV_ITEMS.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center gap-1 rounded-xl py-1.5 text-[11px] font-medium transition ${
                  isActive ? "text-teal-300" : "text-slate-400"
                }`
              }
            >
              <Icon className="h-5 w-5" />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<div className="p-8 text-sm text-slate-500">Loading…</div>}>
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
              <Route path="/documents/:documentId" element={<DocumentPage />} />
            </Route>
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}
