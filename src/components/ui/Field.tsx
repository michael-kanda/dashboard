import type { ReactNode } from 'react';

export const inputClasses =
  'dp-field h-9 py-0 px-3 text-[14px]';

export const textareaClasses =
  'dp-field px-3 py-2 text-[14px]';

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
      <label htmlFor={htmlFor} className="dp-label text-[13px]">{label}</label>
      {children}
      {hint && !error && <p className="text-[13px] text-muted">{hint}</p>}
      {error && <p className="text-[13px] text-danger" role="alert">{error}</p>}
    </div>
  );
}
