'use client';

import Image from 'next/image';
import Link from 'next/link';

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
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-surface/70 backdrop-blur-md transition-all animate-in fade-in duration-300">
      <div className="bg-surface p-8 rounded-3xl shadow-2xl border border-theme-border-subtle flex flex-col items-center gap-6 max-w-md w-full text-center transform scale-100 animate-in zoom-in-95 duration-300">
        <div className="relative w-full flex justify-center">
          <Image
            src="/data-max-arbeitet.webp"
            alt="Data Max arbeitet"
            width={400}
            height={400}
            className="h-[200px] w-auto object-contain"
            priority
          />
        </div>
        <div>
          <h3 className="text-xl font-bold text-strong mb-1">{content[0]}</h3>
          <p className="text-muted text-sm leading-relaxed">
            {content[1]}
          </p>
        </div>
        {state === 'loading' && <div className="w-full h-1.5 bg-surface-tertiary rounded-full overflow-hidden">
          <div className="h-full bg-indigo-500 w-1/3 rounded-full animate-indeterminate-bar" />
        </div>}
        {state !== 'loading' && (fallbackHref || onCheck) && (
          <div className="flex flex-wrap justify-center gap-2">
            {fallbackHref && (
              <Link href={fallbackHref} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                Vorhandene Daten anzeigen
              </Link>
            )}
            {onCheck && (
              <button type="button" onClick={onCheck} className="rounded-md border border-theme-border-subtle px-4 py-2 text-sm font-semibold text-heading hover:bg-surface-secondary">
                Status erneut prüfen
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
