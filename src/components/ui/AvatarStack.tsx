import { initials } from '@/lib/ui-labels';

function paletteIndex(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  return (hash % 6) + 1;
}

export function Avatar({ email, size = 26 }: { email: string; size?: number }) {
  const n = paletteIndex(email.toLowerCase());
  return (
    <span
      title={email}
      className="inline-flex flex-shrink-0 items-center justify-center rounded-full border-2 border-surface font-bold"
      style={{
        width: size,
        height: size,
        fontSize: size >= 30 ? 11 : 10,
        backgroundColor: `var(--dp-avatar-${n}-bg)`,
        color: `var(--dp-avatar-${n}-fg)`,
      }}
    >
      {initials(email)}
    </span>
  );
}

export function AvatarStack({ emails, max = 4, emptyLabel = '–' }: { emails: string[]; max?: number; emptyLabel?: string }) {
  const unique = Array.from(new Set(emails.map((e) => e.trim()).filter(Boolean)));
  if (unique.length === 0) return <span className="text-[13px] text-muted">{emptyLabel}</span>;
  const shown = unique.slice(0, max);
  const rest = unique.length - shown.length;
  return (
    <span className="flex items-center" aria-label={`Betreut von ${unique.join(', ')}`}>
      {shown.map((email, i) => (
        <span key={email} className={i > 0 ? '-ml-1.5' : ''}>
          <Avatar email={email} />
        </span>
      ))}
      {rest > 0 && <span className="ml-1.5 text-[12px] text-muted tabular-nums">+{rest}</span>}
    </span>
  );
}
