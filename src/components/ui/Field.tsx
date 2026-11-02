import type { ReactNode } from 'react';

export const inputClasses =
  'h-9 w-full rounded-control border border-border bg-surface px-3 text-[13px] text-heading placeholder:text-muted ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60';

export const textareaClasses =
  'w-full rounded-control border border-border bg-surface px-3 py-2 text-[13px] text-heading placeholder:text-muted ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent';

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: ReactNode;
  htmlFor: string;
  error?: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-[12px] font-semibold text-muted">{label}</label>
      {children}
      {hint && !error && <p className="text-[12px] text-muted">{hint}</p>}
      {error && <p className="text-[12px] text-danger" role="alert">{error}</p>}
    </div>
  );
}
