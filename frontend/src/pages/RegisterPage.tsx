import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiError, registerUser } from "../api";
import { useAuth } from "../auth";
import PasswordInput from "../components/PasswordInput";

export default function RegisterPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const mismatch = confirm.length > 0 && confirm !== password;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await registerUser(email, password, displayName);
      await signIn(email, password); // log straight in after registering
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
        <p className="mb-6 text-center text-dust">Create your account</p>
        <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-edge bg-lamp p-6 shadow-sm">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-chalk">Name</span>
            <input
              required
              maxLength={100}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-lg border border-edge px-3 py-2 focus:border-blue/60 focus:outline-none"
            />
          </label>
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
            <span className="mb-1 block text-sm font-medium text-chalk">
              Password <span className="font-normal text-dust/80">(min 8 characters)</span>
            </span>
            <PasswordInput
              value={password}
              onChange={setPassword}
              minLength={8}
              autoComplete="new-password"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-chalk">Confirm password</span>
            <PasswordInput
              value={confirm}
              onChange={setConfirm}
              minLength={8}
              autoComplete="new-password"
            />
            {mismatch && (
              <p className="mt-1 text-sm text-[#B4231F]">Passwords do not match</p>
            )}
          </label>
          {error && <p className="text-sm text-[#B4231F]">{error}</p>}
          <button
            type="submit"
            disabled={busy || mismatch}
            className="w-full rounded-lg bg-blue py-2 font-medium text-white hover:bg-bluedark disabled:opacity-50"
          >
            {busy ? "Creating…" : "Create account"}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-dust">
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-blue hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
