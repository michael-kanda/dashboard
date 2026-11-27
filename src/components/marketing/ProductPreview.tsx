// src/components/marketing/ProductPreview.tsx
// Nachgebaute Dashboard-Ansicht mit Beispieldaten für die Landingpage.
'use client';

import { useId, useState } from 'react';
import { BarChartLineFill, ChatQuoteFill, Stars } from 'react-bootstrap-icons';
import DataMaxIllustration from './DataMaxIllustration';

const TABS = [
  { id: 'uebersicht', label: 'Übersicht', icon: BarChartLineFill },
  { id: 'ki', label: 'KI-Traffic', icon: Stars },
  { id: 'datamax', label: 'DataMax', icon: ChatQuoteFill },
] as const;

type TabId = (typeof TABS)[number]['id'];

const KPIS = [
  { label: 'Klicks', value: '4.812', delta: '+12 %' },
  { label: 'Impressionen', value: '182.400', delta: '+8 %' },
  { label: 'Besucher', value: '3.960', delta: '+5 %' },
  { label: 'Conversions', value: '74', delta: '+18 %' },
];

// Klicks pro Woche, Beispielverlauf
const TREND = [41, 44, 43, 47, 46, 52, 50, 55, 58, 57, 63, 66];

const AI_SOURCES = [
  { name: 'ChatGPT', sessions: 312, delta: '+24 %', share: 100 },
  { name: 'Perplexity', sessions: 88, delta: '+9 %', share: 28 },
  { name: 'Gemini', sessions: 61, delta: '+41 %', share: 20 },
  { name: 'Claude', sessions: 27, delta: '+6 %', share: 9 },
];

function Sparkline() {
  const width = 320;
  const height = 96;
  const max = Math.max(...TREND);
  const min = Math.min(...TREND) - 6;
  const points = TREND.map((v, i) => {
    const x = (i / (TREND.length - 1)) * width;
    const y = height - ((v - min) / (max - min)) * (height - 8) - 4;
    return [x, y] as const;
  });
  const line = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${line} L${width},${height} L0,${height} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-24 w-full" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="dp-trend-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--dp-accent)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="var(--dp-accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#dp-trend-fill)" />
      <path d={line} fill="none" stroke="var(--dp-accent)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

function OverviewPanel() {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {KPIS.map((kpi) => (
          <div key={kpi.label} className="rounded-[10px] border border-border-subtle bg-surface px-3 py-2.5">
            <p className="text-[11px] font-medium text-muted">{kpi.label}</p>
            <p className="mt-0.5 flex items-baseline gap-2">
              <span className="text-[19px] font-bold tracking-[-0.02em] text-heading">{kpi.value}</span>
              <span className="text-[11px] font-semibold text-success">{kpi.delta}</span>
            </p>
          </div>
        ))}
      </div>
      <div className="rounded-[10px] border border-border-subtle bg-surface px-3 pt-2.5">
        <p className="text-[11px] font-medium text-muted">Klicks aus der Google-Suche, letzte 12 Wochen</p>
        <Sparkline />
      </div>
    </div>
  );
}

function AiPanel() {
  const score = 64;
  const circumference = 2 * Math.PI * 26;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4 rounded-[10px] border border-border-subtle bg-surface px-3 py-3">
        <svg viewBox="0 0 64 64" className="h-16 w-16 flex-shrink-0 -rotate-90" aria-hidden="true">
          <circle cx="32" cy="32" r="26" fill="none" stroke="var(--dp-fill)" strokeWidth="7" />
          <circle
            cx="32" cy="32" r="26" fill="none" stroke="var(--dp-accent)" strokeWidth="7" strokeLinecap="round"
            strokeDasharray={`${(score / 100) * circumference} ${circumference}`}
          />
        </svg>
        <div>
          <p className="text-[11px] font-medium text-muted">GEO-Sichtbarkeits-Score</p>
          <p className="text-[25px] font-bold leading-none tracking-[-0.02em] text-heading">
            {score}<span className="text-[14px] font-medium text-muted"> / 100</span>
          </p>
          <p className="mt-1 text-[12px] text-body">KI-Anteil, Quellen-Vielfalt und Wachstum</p>
        </div>
      </div>
      <ul className="divide-y divide-border-subtle rounded-[10px] border border-border-subtle bg-surface">
        {AI_SOURCES.map((source) => (
          <li key={source.name} className="flex items-center gap-3 px-3 py-2">
            <span className="w-[74px] text-[13px] font-semibold text-heading">{source.name}</span>
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-fill">
              <span className="block h-full rounded-full bg-accent-solid" style={{ width: `${source.share}%` }} />
            </span>
            <span className="w-10 text-right text-[12px] tabular-nums text-body">{source.sessions}</span>
            <span className="w-11 text-right text-[11px] font-semibold text-success">{source.delta}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DataMaxPanel() {
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-accent-tint">
          <DataMaxIllustration headOnly className="h-7 w-7" title="" />
        </span>
        <div className="rounded-[12px] rounded-tl-[4px] border border-border-subtle bg-surface px-3 py-2.5 text-[13px] leading-[1.5] text-body">
          <p className="font-semibold text-heading">Gute Nachrichten für diesen Monat.</p>
          <p className="mt-1">
            Die Klicks aus Google sind um 12 % gestiegen, vor allem über die Seite <span className="font-medium text-heading">/scheidung</span>.
            Aus ChatGPT kommen 24 % mehr Besucher als im Vormonat.
          </p>
        </div>
      </div>
      <div className="rounded-[10px] border border-border-subtle bg-surface px-3 py-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">Empfehlung</p>
        <p className="mt-1 text-[13px] leading-[1.5] text-body">
          Die Frage „Was kostet eine einvernehmliche Scheidung?“ wird oft gesucht, aber selten geklickt.
          Ein eigener Abschnitt mit Kostenrahmen auf /scheidung kann das ändern.
        </p>
      </div>
    </div>
  );
}

export default function ProductPreview() {
  const [active, setActive] = useState<TabId>('uebersicht');
  const baseId = useId();

  return (
    <figure className="w-full">
      <div role="tablist" aria-label="Bereiche der Vorschau" className="mb-3 inline-flex rounded-[10px] bg-fill p-0.5">
        {TABS.map(({ id, label, icon: Icon }) => {
          const selected = active === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              id={`${baseId}-tab-${id}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel`}
              onClick={() => setActive(id)}
              className={`inline-flex h-8 items-center gap-1.5 rounded-[8px] px-3 text-[13px] transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-accent
                ${selected ? 'bg-surface font-semibold text-heading shadow-segment' : 'font-medium text-muted hover:text-heading'}`}
            >
              <Icon size={12} aria-hidden="true" />
              {label}
            </button>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-[16px] border border-border bg-surface-secondary shadow-[0_24px_60px_-28px_rgba(0,0,0,0.35)]">
        <div className="flex items-center gap-2 border-b border-border-subtle bg-surface px-4 py-2.5">
          <span className="flex gap-1.5" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full bg-dot-off" />
            <span className="h-2.5 w-2.5 rounded-full bg-dot-off" />
            <span className="h-2.5 w-2.5 rounded-full bg-dot-off" />
          </span>
          <span className="ml-2 truncate text-[12px] text-muted">app.datapeak.at · kanzlei-beispiel.at</span>
        </div>
        <div
          id={`${baseId}-panel`}
          role="tabpanel"
          aria-labelledby={`${baseId}-tab-${active}`}
          className="min-h-[300px] p-4"
        >
          {active === 'uebersicht' && <OverviewPanel />}
          {active === 'ki' && <AiPanel />}
          {active === 'datamax' && <DataMaxPanel />}
        </div>
      </div>
      <figcaption className="mt-3 text-[13px] leading-[1.5] text-muted">
        Beispieldaten einer erfundenen Kanzlei. In der Demo sehen Sie das echte Dashboard.
      </figcaption>
    </figure>
  );
}
