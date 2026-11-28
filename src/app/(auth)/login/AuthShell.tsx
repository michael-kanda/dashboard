// src/app/(auth)/login/AuthShell.tsx
// Rahmen der Seiten „Passwort vergessen?“ und „Neues Passwort“, im Stil der Login-Seite.
import Link from 'next/link';
import type { ReactNode } from 'react';
import ThemeSwitch from '@/components/ThemeSwitch';

export const authRowClasses =
  'flex min-h-11 items-center gap-3 border-b border-border-subtle px-4 last:border-b-0 focus-within:bg-surface-secondary';
export const authFieldClasses =
  'h-11 min-w-0 flex-1 bg-transparent text-15 text-heading placeholder:text-placeholder focus:outline-none disabled:opacity-60';
export const authButtonClasses =
  'flex h-9 w-full items-center justify-center gap-2 rounded-control bg-accent-solid px-4 text-14 font-semibold text-white transition-opacity duration-150 ease-out hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60';

export default function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen w-full items-center justify-center bg-page px-4 py-16">
      <div className="absolute right-4 top-4">
        <ThemeSwitch />
      </div>
      <div className="w-full max-w-[360px]">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-[11px] bg-accent-solid text-18 font-bold text-white" aria-hidden="true">
            DP
          </span>
          <h1 className="text-23 font-bold tracking-[-0.02em] text-heading">{title}</h1>
          <p className="mt-1 text-14 text-muted">{subtitle}</p>
        </div>
        {children}
        <p className="mt-6 text-center text-13">
          <Link href="/login" className="text-accent hover:underline">Zurück zur Anmeldung</Link>
        </p>
      </div>
    </div>
  );
}
