import { useState } from "react";

interface Props {
  value: string;
  onChange: (value: string) => void;
  minLength?: number;
  autoComplete?: string;
}

export default function PasswordInput({ value, onChange, minLength, autoComplete }: Props) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        type={visible ? "text" : "password"}
        required
        minLength={minLength}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-zinc-700 px-3 py-2 pr-16 focus:border-violet-500 focus:outline-none"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute inset-y-0 right-3 text-sm font-medium text-zinc-400 hover:text-zinc-200"
        aria-label={visible ? "Hide password" : "Show password"}
      >
        {visible ? "Hide" : "Show"}
      </button>
    </div>
  );
}
