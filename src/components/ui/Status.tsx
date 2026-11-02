import type { ReactNode } from 'react';
import { formatTrendPercent } from '@/lib/ui-labels';

export type StatusTone = 'success' | 'warning' | 'danger' | 'neutral' | 'accent';

const TONES: Record<StatusTone, string> = {
  success: 'bg-success-bg text-success',
  warning: 'bg-warning-bg text-warning',
  danger: 'bg-danger-bg text-danger',
  neutral: 'bg-fill text-neutral-fg',
  accent: 'bg-accent-tint text-accent',
};

export function StatusPill({ tone = 'neutral', children, className = '' }: { tone?: StatusTone; children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-pill px-2 py-0.5 text-[13px] font-semibold ${TONES[tone]} ${className}`}>
      {children}
    </span>
  );
}

export function TrendPill({ value }: { value: number }) {
  const tone: StatusTone = !Number.isFinite(value) || value === 0 ? 'neutral' : value > 0 ? 'success' : 'danger';
  return <StatusPill tone={tone} className="tabular-nums">{formatTrendPercent(value)}</StatusPill>;
}

const DOTS: Record<'success' | 'warning' | 'danger' | 'off' | 'accent', string> = {
  success: 'bg-success-bar',
  warning: 'bg-warning-bar',
  danger: 'bg-danger-bar',
  accent: 'bg-accent',
  off: 'bg-dot-off',
};

export function StatusDot({ tone = 'success', children }: { tone?: keyof typeof DOTS; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 text-[14px] text-body">
      <span className={`h-[7px] w-[7px] flex-shrink-0 rounded-full ${DOTS[tone]}`} aria-hidden="true" />
      {children}
    </span>
  );
}

// Landingpage-Status: Freigabe, Prüfung, Offen, Gesperrt.
export function StackedStatusBar({
  approved,
  review,
  open,
  blocked,
  total,
}: {
  approved: number;
  review: number;
  open: number;
  blocked: number;
  total: number;
}) {
  const sum = Math.max(total, approved + review + open + blocked, 1);
  const segments = [
    { value: approved, className: 'bg-success-bar' },
    { value: review, className: 'bg-warning-bar' },
    { value: open, className: 'bg-accent' },
    { value: blocked, className: 'bg-danger-bar' },
  ];
  return (
    <div className="min-w-[140px]">
      <div
        role="img"
        aria-label={`${approved} freigegeben, ${review} in Prüfung, ${open} offen, ${blocked} gesperrt`}
        className="flex h-1.5 w-full overflow-hidden rounded-[3px] bg-fill"
      >
        {segments.map((segment, i) =>
          segment.value > 0 ? (
            <span key={i} className={segment.className} style={{ width: `${(segment.value / sum) * 100}%` }} />
          ) : null,
        )}
      </div>
      <div className="mt-1 text-[13px] text-muted tabular-nums">
        {approved} von {total} freigegeben
      </div>
    </div>
  );
}

export function MetricTile({ label, value, hint }: { label: ReactNode; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="rounded-container border border-border bg-surface px-[18px] py-4">
      <div className="text-[13px] text-muted">{label}</div>
      <div className="mt-1 text-[29px] font-semibold leading-tight text-heading tabular-nums">{value}</div>
      {hint && <div className="mt-1 text-[13px] text-muted">{hint}</div>}
    </div>
  );
}
