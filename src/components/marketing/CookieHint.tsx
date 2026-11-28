// src/components/marketing/CookieHint.tsx
// Kleiner Hinweis unten auf der Landingpage: keine Tracking-Cookies, Link zur Datenschutzerklärung.
// Blendet sich nach 8 Sekunden aus (Balken läuft ab, hält bei Maus oder Fokus an) und
// erscheint in derselben Browser-Sitzung nicht wieder (sessionStorage).
'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShieldCheck, X } from 'react-bootstrap-icons';

const STORAGE_KEY = 'datapeak-cookie-hint';
const SHOW_DELAY_MS = 600;
const FADE_MS = 200;

export default function CookieHint() {
  const pathname = usePathname();
  const [state, setState] = useState<'hidden' | 'visible' | 'leaving'>('hidden');

  useEffect(() => {
    // Auf der Datenschutzerklärung selbst wäre der Hinweis doppelt.
    if (pathname === '/datenschutz') return;
    try {
      if (sessionStorage.getItem(STORAGE_KEY)) return;
    } catch {
      // Ohne sessionStorage erscheint der Hinweis bei jedem Seitenaufruf, das ist in Ordnung.
    }
    const timer = window.setTimeout(() => setState('visible'), SHOW_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  const dismiss = useCallback(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // siehe oben
    }
    setState('leaving');
    window.setTimeout(() => setState('hidden'), FADE_MS);
  }, []);

  if (state === 'hidden') return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-[max(16px,env(safe-area-inset-bottom))]">
      <div
        role="status"
        className={`dp-toast-in pointer-events-auto relative w-full max-w-[440px] overflow-hidden rounded-[20px] border border-border bg-surface shadow-dialog transition-opacity duration-200
          ${state === 'leaving' ? 'opacity-0' : 'opacity-100'}`}
      >
        <div className="flex items-center gap-3 py-3 pl-4 pr-2">
          <ShieldCheck size={18} aria-hidden="true" className="flex-shrink-0 text-accent" />
          <p className="min-w-0 flex-1 text-14 leading-[1.45] text-heading">
            {/* Leerzeichen als Umbruchstellen: am Handy rutscht nur der Link in die zweite Zeile */}
            <span className="whitespace-nowrap">Keine Tracking-Cookies</span>{' '}
            <span className="text-muted" aria-hidden="true">·</span>{' '}
            <Link href="/datenschutz" className="whitespace-nowrap font-medium text-accent underline underline-offset-[3px] hover:no-underline">
              Datenschutzerklärung
            </Link>
          </p>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Hinweis schließen"
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-fill hover:text-heading focus-visible:outline-2 focus-visible:outline-accent"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        {/* Restzeit (8 s, Dauer in globals.css .dp-countdown); endet die Animation, blendet sich der Hinweis aus */}
        <div
          aria-hidden="true"
          className="dp-countdown absolute inset-x-0 bottom-0 h-[3px] origin-left bg-accent"
          onAnimationEnd={dismiss}
        />
      </div>
    </div>
  );
}
