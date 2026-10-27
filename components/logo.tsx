export function LogoMark({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <rect x="7" y="7" width="34" height="34" rx="5" transform="rotate(45 24 24)" fill="#F2A900" stroke="#1E2320" strokeWidth="2.5" />
      <path d="M19 36c0-6 10-6 10-12s-6-6-6-12" fill="none" stroke="#1E2320" strokeWidth="4.2" strokeLinecap="round" />
      <path d="M19 36c0-6 10-6 10-12s-6-6-6-12" fill="none" stroke="#F2A900" strokeWidth="1.2" strokeDasharray="2.2 2.4" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <LogoMark />
      {!compact && <span className="font-display text-[1.35rem] font-extrabold tracking-tight text-charcoal">Road Fund</span>}
    </span>
  );
}
