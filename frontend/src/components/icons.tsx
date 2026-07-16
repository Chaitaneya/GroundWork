// Minimal inline SVG icon set (stroke = currentColor) — no emoji anywhere.
const base = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  viewBox: "0 0 24 24",
};

type P = { className?: string };

export function HomeIcon({ className = "h-5 w-5" }: P) {
  return (
    <svg {...base} className={className}>
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M9 22V12h6v10" />
    </svg>
  );
}

export function BookIcon({ className = "h-5 w-5" }: P) {
  return (
    <svg {...base} className={className}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

export function ZapIcon({ className = "h-5 w-5" }: P) {
  return (
    <svg {...base} className={className}>
      <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );
}

export function PencilIcon({ className = "h-4 w-4" }: P) {
  return (
    <svg {...base} className={className}>
      <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
    </svg>
  );
}

export function XIcon({ className = "h-4 w-4" }: P) {
  return (
    <svg {...base} className={className}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

export function SendIcon({ className = "h-4 w-4" }: P) {
  return (
    <svg {...base} className={className}>
      <path d="m22 2-7 20-4-9-9-4L22 2z" />
      <path d="M22 2 11 13" />
    </svg>
  );
}

export function FileIcon({ className = "h-4 w-4" }: P) {
  return (
    <svg {...base} className={className}>
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <path d="M14 2v6h6" />
    </svg>
  );
}
