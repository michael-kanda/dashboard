// src/components/marketing/MarketingFooter.tsx
import Link from 'next/link';
import DataPeakLogo from './DataPeakLogo';

export default function MarketingFooter({ appOrigin }: { appOrigin: string }) {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border-subtle">
      <div className="mx-auto flex max-w-[1120px] flex-col gap-5 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex flex-col gap-2">
          <div className="self-start">
            <DataPeakLogo className="h-7 w-auto" />
          </div>
          <p className="text-[13px] text-muted">
            &copy; {year}{' '}
            <a href="https://designare.at/" target="_blank" rel="noopener noreferrer" className="hover:text-heading hover:underline">
              Michael Kanda
            </a>
            . SEO- und KI-Sichtbarkeit in einem Dashboard.
          </p>
        </div>
        <nav aria-label="Rechtliches" className="flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-body">
          <Link href="/impressum" className="hover:text-heading hover:underline">Impressum</Link>
          <Link href="/datenschutz" className="hover:text-heading hover:underline">Datenschutz</Link>
          <a href={`${appOrigin}/demo-anwalt`} className="hover:text-heading hover:underline">Demo</a>
          <a href={`${appOrigin}/login`} className="hover:text-heading hover:underline">Anmelden</a>
        </nav>
      </div>
    </footer>
  );
}
