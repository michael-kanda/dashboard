'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Spinner } from '@/components/ui/Spinner';

type LoadingState = 'loading' | 'scheduled' | 'failed' | 'unavailable';

export default function DashboardLoadingOverlay({
  state = 'loading',
  fallbackHref,
  onCheck,
}: {
  state?: LoadingState;
  fallbackHref?: string;
  onCheck?: () => void;
}) {
  const content = {
    loading: ['Dashboard wird geladen', 'Die verfügbaren Daten werden vorbereitet. Das Dashboard öffnet sich automatisch.'],
    scheduled: ['Daten noch nicht verfügbar', 'Die Synchronisierung ist vorgemerkt. Sobald Daten vorliegen, können Sie das Projekt erneut öffnen.'],
    failed: ['Synchronisierung fehlgeschlagen', 'Die Daten konnten nicht geladen werden. Ein weiterer Versuch wird automatisch eingeplant.'],
    unavailable: ['Status nicht erreichbar', 'Der Synchronisierungsstatus konnte gerade nicht geprüft werden.'],
  }[state];

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[var(--dp-surface-overlay)] px-4" role="status" aria-live="polite">
      <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-container border border-border bg-surface p-7 text-center shadow-dialog">
        {state === 'loading' ? (
          <Spinner size={32} />
        ) : (
          <Image
            src="/data-max-arbeitet.webp"
            alt=""
            width={400}
            height={400}
            className="h-[120px] w-auto object-contain"
            priority
          />
        )}
        <div>
          <h3 className="mb-1 text-[18px] font-semibold text-heading">{content[0]}</h3>
          <p className="text-[14px] leading-relaxed text-muted">
            {content[1]}
          </p>
        </div>
        {state !== 'loading' && (fallbackHref || onCheck) && (
          <div className="flex flex-wrap justify-center gap-2">
            {fallbackHref && (
              <Link href={fallbackHref} className="rounded-md bg-accent-solid px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
                Vorhandene Daten anzeigen
              </Link>
            )}
            {onCheck && (
              <button type="button" onClick={onCheck} className="rounded-md border border-border-subtle px-4 py-2 text-sm font-semibold text-heading hover:bg-surface-secondary">
                Status erneut prüfen
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
