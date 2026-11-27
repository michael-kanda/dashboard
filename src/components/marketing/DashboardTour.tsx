// src/components/marketing/DashboardTour.tsx
// Vorschaubild der Demo für die Landingpage. Ein Klick öffnet eine Lightbox,
// in der man durch die Bereiche des Dashboards blättert (Liste links, Bild mit Erklärung rechts).
// Die Bilder nimmt scripts/capture-dashboard-tour.mjs aus der Demo auf, je hell und dunkel.
'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowsAngleExpand, ChevronLeft, ChevronRight, X } from 'react-bootstrap-icons';
import { useFocusTrap } from '@/components/ui/useFocusTrap';
import TOUR_STEPS from '@/lib/dashboard-tour.json';

const SWIPE_MIN = 50;

// Hell und dunkel als zwei Bilder; das ausgeblendete lädt der Browser nicht.
// Die Dateien sind schon fertige WebP-Bilder, next/image bringt hier nichts.
/* eslint-disable @next/next/no-img-element */
function ThemedImage({ name, alt, className }: { name: string; alt: string; className: string }) {
  return (
    <>
      <img src={`/tour/${name}-light.webp`} alt={alt} className={`${className} dark:hidden`} loading="lazy" decoding="async" />
      <img src={`/tour/${name}-dark.webp`} alt={alt} className={`${className} hidden dark:block`} loading="lazy" decoding="async" />
    </>
  );
}

export default function DashboardTour() {
  const baseId = useId();
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const touchX = useRef<number | null>(null);
  const step = TOUR_STEPS[index];
  const count = TOUR_STEPS.length;

  const go = useCallback((delta: number) => {
    setIndex((current) => (current + delta + count) % count);
  }, [count]);

  const close = useCallback(() => setOpen(false), []);

  useFocusTrap(open, panelRef, close, (event) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      go(1);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      go(-1);
    }
  });

  // Seite dahinter nicht mitscrollen lassen
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Aktiven Reiter sichtbar halten (am Handy scrollt die Leiste seitlich)
  useEffect(() => {
    if (!open) return;
    const tab = tabRefs.current[index];
    tab?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    // Beim Blättern mit den Pfeiltasten wandert der Fokus mit, wenn er in der Liste steht
    if (document.activeElement?.getAttribute('role') === 'tab') tab?.focus();
  }, [open, index]);

  // Nachbarbilder vorladen, damit das Blättern ohne leeren Moment klappt
  useEffect(() => {
    if (!open) return;
    const theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    for (const delta of [1, -1]) {
      const neighbor = TOUR_STEPS[(index + delta + count) % count];
      new Image().src = `/tour/${neighbor.id}-${theme}.webp`;
    }
  }, [open, index, count]);

  const openAt = (next: number) => {
    setIndex(next);
    setOpen(true);
  };

  return (
    <>
      <figure>
        <button
          type="button"
          onClick={() => openAt(0)}
          aria-haspopup="dialog"
          className="group relative block w-full overflow-hidden rounded-[16px] border border-border bg-surface shadow-[0_24px_60px_-28px_rgba(0,0,0,0.35)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
        >
          <ThemedImage
            name="vorschau"
            alt="Das DataPeak-Dashboard mit Seitenleiste und Kennzahlen einer erfundenen Kanzlei"
            className="aspect-[1280/800] w-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.01]"
          />
          <span className="absolute bottom-4 right-4 inline-flex h-10 items-center gap-2 rounded-full border border-border bg-surface/95 px-4 text-[14px] font-semibold text-heading shadow-[0_8px_24px_-8px_rgba(0,0,0,0.3)] backdrop-blur">
            <ArrowsAngleExpand size={13} aria-hidden="true" />
            Vergrößern
          </span>
        </button>
        <figcaption className="mt-3 text-[13px] leading-[1.5] text-muted">
          Das echte Dashboard, gezeigt mit einer erfundenen Kanzlei. In der Vergrößerung blättern Sie durch alle {count} Bereiche.
        </figcaption>
      </figure>

      {open && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center md:p-6">
          <div className="absolute inset-0 bg-[rgba(0,0,0,0.6)]" onClick={close} aria-hidden="true" />
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${baseId}-title`}
            className="relative flex h-full w-full flex-col overflow-hidden bg-surface md:h-auto md:max-h-[92vh] md:max-w-[1180px] md:rounded-container md:border md:border-border md:shadow-dialog"
          >
            <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-3">
              <h2 id={`${baseId}-title`} className="text-[17px] font-semibold tracking-[-0.015em] text-heading">
                Rundgang durch das Dashboard
                <span className="ml-2 whitespace-nowrap text-[14px] font-medium tabular-nums text-muted">{index + 1} / {count}</span>
              </h2>
              <button
                type="button"
                onClick={close}
                aria-label="Schließen"
                className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-fill hover:text-heading focus-visible:outline-2 focus-visible:outline-accent"
              >
                <X size={22} aria-hidden="true" />
              </button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col md:grid md:grid-cols-[220px_minmax(0,1fr)]">
              <div
                role="tablist"
                aria-label="Bereiche des Dashboards"
                aria-orientation="vertical"
                className="flex flex-shrink-0 gap-1 overflow-x-auto border-b border-border px-3 py-2 md:flex-col md:overflow-y-auto md:border-b-0 md:border-r md:px-3 md:py-4"
              >
                {TOUR_STEPS.map((item, i) => {
                  const selected = i === index;
                  return (
                    <button
                      key={item.id}
                      ref={(el) => { tabRefs.current[i] = el; }}
                      type="button"
                      role="tab"
                      id={`${baseId}-tab-${item.id}`}
                      aria-selected={selected}
                      aria-controls={`${baseId}-panel`}
                      tabIndex={selected ? 0 : -1}
                      onClick={() => setIndex(i)}
                      className={`flex-shrink-0 whitespace-nowrap rounded-[8px] px-3 py-2 text-left text-[14px] transition-colors focus-visible:outline-2 focus-visible:outline-accent
                        ${selected ? 'bg-accent-tint font-semibold text-accent' : 'font-medium text-body hover:bg-fill hover:text-heading'}`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>

              <div
                id={`${baseId}-panel`}
                role="tabpanel"
                aria-labelledby={`${baseId}-tab-${step.id}`}
                className="flex min-h-0 flex-1 flex-col overflow-y-auto"
              >
                <div
                  className="flex flex-shrink-0 items-center justify-center bg-section-alt p-3 md:h-[min(58vh,560px)] md:p-5"
                  onTouchStart={(event) => { touchX.current = event.touches[0].clientX; }}
                  onTouchEnd={(event) => {
                    if (touchX.current === null) return;
                    const dx = event.changedTouches[0].clientX - touchX.current;
                    touchX.current = null;
                    if (Math.abs(dx) >= SWIPE_MIN) go(dx < 0 ? 1 : -1);
                  }}
                >
                  <ThemedImage
                    key={step.id}
                    name={step.id}
                    alt={`Bereich „${step.title}“ im Dashboard, mit Beispieldaten`}
                    className="max-h-full w-auto max-w-full rounded-[10px] object-contain"
                  />
                </div>

                <div className="flex flex-col gap-4 px-5 py-4 md:flex-row md:items-start md:justify-between md:gap-8">
                  <div className="max-w-[640px]">
                    <h3 className="text-[18px] font-semibold tracking-[-0.015em] text-heading">{step.title}</h3>
                    <p className="mt-1 text-[15px] leading-[1.55] text-body">{step.text}</p>
                    <p className="mt-3 border-l-2 border-border-strong pl-3 text-[14px] leading-[1.55] text-muted">
                      <span className="font-semibold text-heading">Ehrlich gesagt:</span> {step.honest}
                    </p>
                  </div>
                  <div className="flex flex-shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => go(-1)}
                      aria-label="Vorheriger Bereich"
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-heading transition-colors hover:bg-fill focus-visible:outline-2 focus-visible:outline-accent"
                    >
                      <ChevronLeft size={16} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => go(1)}
                      aria-label="Nächster Bereich"
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-heading transition-colors hover:bg-fill focus-visible:outline-2 focus-visible:outline-accent"
                    >
                      <ChevronRight size={16} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
