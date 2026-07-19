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
        className="w-full rounded-lg border border-edge px-3 py-2 pr-16 focus:border-blue/60 focus:outline-none"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute inset-y-0 right-3 text-sm font-medium text-dust hover:text-ink"
        aria-label={visible ? "Hide password" : "Show password"}
      >
        {visible ? "Hide" : "Show"}
      </button>
    </div>
  );
}
