// src/components/marketing/ClosingCta.tsx
// Abschluss der Landingpage: Karte mit Text links und Dashboard-Ausschnitt rechts.
// Die Grafik nutzt Design-Tokens und passt sich hell und dunkel an.
import { ArrowRight, Download } from 'react-bootstrap-icons';
import { HANDBOOK_FILENAME, HANDBOOK_META, HANDBOOK_PATH } from '@/lib/handbook';
import AccessRequestButton from './AccessRequestButton';

const KPIS = [
  { label: 'Klicks', value: '1.848', delta: '+14,7 %' },
  { label: 'Conversions', value: '184', delta: '+18,9 %' },
  { label: 'KI-Besuche', value: '86', delta: '+42,6 %' },
];

// Klicks pro Tag, Demo-Verlauf (geglättet)
const LINE = 'M0 92 L30 86 L60 88 L90 78 L120 80 L150 68 L180 70 L210 58 L240 54 L270 44 L300 36';

function DashboardSnippet() {
  return (
    <div className="h-full w-full rounded-tl-[14px] border-l border-t border-border bg-surface p-4" aria-hidden="true">
      <div className="mb-4 flex gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-dot-off" />
        <span className="h-2.5 w-2.5 rounded-full bg-dot-off" />
        <span className="h-2.5 w-2.5 rounded-full bg-dot-off" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        {KPIS.map((kpi) => (
          <div key={kpi.label} className="rounded-[10px] bg-fill px-3 py-2">
            <p className="text-[11px] text-muted">{kpi.label}</p>
            <p className="text-[18px] font-bold tracking-[-0.02em] text-heading">{kpi.value}</p>
            <p className="text-[11px] font-semibold text-success">{kpi.delta}</p>
          </div>
        ))}
      </div>
      <svg viewBox="0 0 300 100" preserveAspectRatio="none" className="mt-4 h-28 w-full">
        <path d={`${LINE} L300 100 L0 100 Z`} style={{ fill: 'var(--dp-accent)', opacity: 0.12 }} />
        <path d={LINE} fill="none" style={{ stroke: 'var(--dp-accent)' }} strokeWidth="2.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}

export default function ClosingCta({ demoHref }: { demoHref: string }) {
  return (
    <section className="px-4 pb-24 sm:px-6">
      <div className="mx-auto grid max-w-[1120px] overflow-hidden rounded-[24px] border border-border bg-surface-secondary md:grid-cols-2">
        <div className="px-6 py-12 sm:px-12">
          <p className="mb-3 flex items-center gap-3 text-[12px] font-semibold uppercase tracking-[0.08em] text-accent">
            <span className="h-px w-6 bg-accent" aria-hidden="true" />
            Demo
          </p>
          <h2 className="text-[clamp(30px,4.2vw,44px)] font-bold leading-[1.08] tracking-[-0.025em] text-heading">Sehen Sie selbst.</h2>
          <p className="mt-4 max-w-[440px] text-[17px] leading-[1.55] text-body">
            Die Demo zeigt das echte Dashboard mit Beispieldaten, ohne Anmeldung. Für Ihr eigenes Projekt fragen Sie einfach einen Zugang an.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href={demoHref}
              target="_blank"
              rel="noopener"
              className="inline-flex h-11 items-center gap-2 rounded-full bg-accent-solid px-6 text-[15px] font-semibold text-white transition-opacity duration-150 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Demo ansehen <ArrowRight size={15} aria-hidden="true" />
            </a>
            <AccessRequestButton className="inline-flex h-11 items-center rounded-full border border-border-strong px-6 text-[15px] font-semibold text-heading transition-colors duration-150 hover:bg-fill focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" />
          </div>
          <a
            href={HANDBOOK_PATH}
            download={HANDBOOK_FILENAME}
            className="mt-6 inline-flex items-center gap-2 text-[15px] font-medium text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <Download size={15} aria-hidden="true" />
            Handbuch herunterladen <span className="text-muted">({HANDBOOK_META})</span>
          </a>
        </div>
        <div className="hidden items-end pl-6 pt-10 md:flex">
          <DashboardSnippet />
        </div>
      </div>
    </section>
  );
}
