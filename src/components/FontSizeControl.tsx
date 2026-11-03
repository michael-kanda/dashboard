'use client';

import { useEffect, useState } from 'react';

// Persönliche Schriftgröße je Browser. Skaliert den Inhaltsbereich per CSS zoom (--dp-content-zoom),
// weil die Schriftgrößen in px angegeben sind. layout.tsx setzt den Wert schon vor dem ersten Zeichnen.
export const FONT_SCALE_KEY = 'datapeak-font-scale';
export const FONT_SCALE_STEPS = [0.9, 1, 1.1, 1.2, 1.35] as const;

export function applyFontScale(scale: number) {
  document.documentElement.style.setProperty('--dp-content-zoom', String(scale));
}

function readStoredScale(): number {
  try {
    const stored = Number(localStorage.getItem(FONT_SCALE_KEY));
    return (FONT_SCALE_STEPS as readonly number[]).includes(stored) ? stored : 1;
  } catch {
    return 1;
  }
}

export default function FontSizeControl() {
  const [scale, setScale] = useState(1);
  useEffect(() => setScale(readStoredScale()), []);

  const index = FONT_SCALE_STEPS.indexOf(scale as (typeof FONT_SCALE_STEPS)[number]);
  const change = (direction: -1 | 1) => {
    const next = FONT_SCALE_STEPS[Math.min(FONT_SCALE_STEPS.length - 1, Math.max(0, index + direction))];
    setScale(next);
    applyFontScale(next);
    try {
      localStorage.setItem(FONT_SCALE_KEY, String(next));
    } catch {
      // Ohne localStorage gilt die Größe nur bis zum Neuladen.
    }
  };

  const button =
    'flex h-8 w-8 items-center justify-center rounded-lg font-semibold text-heading transition-colors duration-150 ease-out ' +
    'hover:bg-fill focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-40 disabled:hover:bg-transparent';

  return (
    <div className="flex items-center justify-between gap-2" role="group" aria-label="Schriftgröße">
      <span className="text-[13px] font-medium text-muted">Schriftgröße</span>
      <div className="flex items-center gap-0.5">
        <button type="button" className={`${button} text-[13px]`} onClick={() => change(-1)} disabled={index <= 0} aria-label="Schrift kleiner" title="Schrift kleiner">
          A−
        </button>
        <span className="w-11 text-center text-[13px] tabular-nums text-muted" aria-live="polite">
          {Math.round(scale * 100)} %
        </span>
        <button type="button" className={`${button} text-[16px]`} onClick={() => change(1)} disabled={index >= FONT_SCALE_STEPS.length - 1} aria-label="Schrift größer" title="Schrift größer">
          A+
        </button>
      </div>
    </div>
  );
}
