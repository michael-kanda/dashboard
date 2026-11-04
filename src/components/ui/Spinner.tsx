// Einheitlicher Ladeindikator: dezente Spur plus Bogen in der Textfarbe.
// In Buttons erbt er deren Schriftfarbe (weiß auf Akzent), sonst Akzentfarbe; hell und dunkel über Tokens.
export function Spinner({
  size = 16,
  label,
  className = 'text-accent',
}: {
  size?: number;
  label?: string;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={`dp-spinner flex-shrink-0 ${className}`}
      role={label ? 'status' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeOpacity="0.18" strokeWidth="2.5" />
      <path d="M12 2.5a9.5 9.5 0 0 1 9.5 9.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

// Seiten- oder Bereichsladen: Spinner mittig mit kurzer Beschriftung.
export function PageSpinner({ label = 'Wird geladen', className = 'min-h-[50vh]' }: { label?: string; className?: string }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`} role="status" aria-live="polite">
      <Spinner size={28} />
      <span className="text-[14px] text-muted">{label}</span>
    </div>
  );
}
