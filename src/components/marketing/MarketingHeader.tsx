// src/components/marketing/MarketingHeader.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, BoxArrowInRight } from 'react-bootstrap-icons';
import DataPeakLogo from './DataPeakLogo';
import { MARKETING_NAV } from './nav';

// Welcher Abschnitt gerade in der Bildschirmmitte steht; null oben im Hero oder auf Unterseiten.
function useActiveSection(ids: string[]) {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const sections = ids.map((id) => document.getElementById(id)).filter((el): el is HTMLElement => !!el);
    if (sections.length === 0) return;
    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }
        setActive(ids.find((id) => visible.has(id)) ?? null);
      },
      // Nur ein schmaler Streifen knapp über der Mitte zählt, damit immer höchstens einer aktiv ist.
      { rootMargin: '-45% 0px -50% 0px' },
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [ids]);

  return active;
}

const SECTION_IDS = MARKETING_NAV.map((item) => item.id);

export default function MarketingHeader({ appOrigin }: { appOrigin: string }) {
  const active = useActiveSection(SECTION_IDS);

  return (
    <header className="sticky top-0 z-40 border-b border-border-subtle bg-page/80 backdrop-blur-xl backdrop-saturate-150">
      <div className="mx-auto flex h-16 max-w-[1120px] items-center gap-2 px-4 sm:gap-5 sm:px-6 md:h-[72px]">
        <Link href="/" aria-label="DataPeak Startseite" className="mr-auto flex-shrink-0 rounded-control focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
          <DataPeakLogo className="h-8 w-auto md:h-10" />
        </Link>

        <nav aria-label="Hauptnavigation" className="hidden items-center gap-7 md:flex">
          {MARKETING_NAV.map((item) => {
            const isActive = active === item.id;
            return (
              <a
                key={item.id}
                href={`/#${item.id}`}
                aria-current={isActive ? 'true' : undefined}
                className={`dp-underline text-15 font-medium hover:text-heading focus-visible:outline-none
                  ${isActive ? 'text-heading' : 'text-body'}`}
              >
                {item.label}
              </a>
            );
          })}
        </nav>

        <span className="hidden h-5 w-px bg-border md:block" aria-hidden="true" />

        <a
          href={`${appOrigin}/login`}
          className="inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-control px-1 text-14 font-medium md:text-15 text-body transition-colors duration-150 hover:text-heading focus-visible:outline-2 focus-visible:outline-accent"
        >
          <BoxArrowInRight size={16} aria-hidden="true" />
          Anmelden
        </a>
        <a
          href={`${appOrigin}/demo-anwalt`}
          target="_blank"
          rel="noopener"
          className="group inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-full bg-accent-solid px-4 text-14 font-semibold md:px-5 md:text-15 text-white transition-opacity duration-150 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Demo<span className="hidden sm:inline"> ansehen</span>
          <ArrowRight size={14} aria-hidden="true" className="transition-transform duration-150 group-hover:translate-x-0.5" />
        </a>
      </div>
    </header>
  );
}
