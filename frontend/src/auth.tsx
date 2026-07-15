import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Navigate } from "react-router-dom";
import { fetchMe, hasToken, login as apiLogin, setToken, type User } from "./api";

interface AuthContextValue {
  user: User | null;
  initializing: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  // If a token survives from a previous visit, we don't know who the user
  // is until /me answers — "initializing" keeps protected pages from
  // bouncing to /login during that window.
  const [initializing, setInitializing] = useState(hasToken());

  useEffect(() => {
    if (!hasToken()) return;
    fetchMe()
      .then(setUser)
      .catch(() => setToken(null)) // stale/expired token — discard it
      .finally(() => setInitializing(false));
  }, []);

  async function signIn(email: string, password: string) {
    await apiLogin(email, password);
    setUser(await fetchMe());
  }

  function signOut() {
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, initializing, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, initializing } = useAuth();
  if (initializing) {
    return <p className="p-8 text-slate-400">Loading…</p>;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}
