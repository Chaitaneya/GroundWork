import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiError } from "../api";
import { useAuth } from "../auth";
import PasswordInput from "../components/PasswordInput";

export default function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signIn(email, password);
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reach the server");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-transparent px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-center text-2xl font-bold text-ink">Groundwork</h1>
        <p className="mb-6 text-center text-dust">Sign in to your study space</p>
        <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-edge bg-lamp p-6 shadow-sm">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-chalk">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-edge px-3 py-2 focus:border-blue/60 focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-chalk">Password</span>
            <PasswordInput
              value={password}
              onChange={setPassword}
              autoComplete="current-password"
            />
          </label>
          {error && <p className="text-sm text-[#B4231F]">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-blue py-2 font-medium text-white hover:bg-bluedark disabled:opacity-50"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-dust">
          New here?{" "}
          <Link to="/register" className="font-medium text-blue hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </main>
  );
}
