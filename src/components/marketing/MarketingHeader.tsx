// src/components/marketing/MarketingHeader.tsx
'use client';

import Link from 'next/link';
import { BoxArrowInRight } from 'react-bootstrap-icons';
import DataPeakLogo from './DataPeakLogo';

const NAV = [
  { href: '/#funktionen', label: 'Funktionen' },
  { href: '/#ablauf', label: 'So funktioniert’s' },
  { href: '/#faq', label: 'FAQ' },
];

export default function MarketingHeader({ appOrigin }: { appOrigin: string }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border-subtle bg-page/80 backdrop-blur-xl backdrop-saturate-150">
      <div className="mx-auto flex h-14 max-w-[1120px] items-center gap-4 px-4 sm:px-6">
        <Link href="/" aria-label="DataPeak Startseite" className="mr-auto rounded-control focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
          <DataPeakLogo className="h-8 w-auto" />
        </Link>

        <nav aria-label="Hauptnavigation" className="hidden items-center gap-6 md:flex">
          {NAV.map((item) => (
            <a key={item.href} href={item.href} className="text-14 font-medium text-body transition-colors duration-150 hover:text-heading">
              {item.label}
            </a>
          ))}
        </nav>


        <a
          href={`${appOrigin}/demo-anwalt`}
          target="_blank"
          rel="noopener"
          className="hidden h-9 items-center rounded-full bg-accent-tint px-4 text-14 font-semibold text-accent transition-colors duration-150 hover:bg-accent-solid hover:text-white sm:inline-flex"
        >
          Demo
        </a>
        <a
          href={`${appOrigin}/login`}
          className="inline-flex h-9 items-center gap-2 rounded-full border border-border px-4 text-14 font-semibold text-heading transition-colors duration-150 hover:bg-fill"
        >
          <BoxArrowInRight size={15} aria-hidden="true" />
          Anmelden
        </a>
      </div>
    </header>
  );
}
