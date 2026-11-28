'use client';

import { useState } from 'react';
import { Printer, Share } from 'react-bootstrap-icons';
import ShareLinkDialog from '@/components/ShareLinkDialog';
import DemoShareDialog from '@/components/DemoShareDialog';

// Drucken und Gastlink für das geöffnete Projekt, zurückhaltend in der Sidebar.
// Drucken öffnet den eigenen Druckbericht mit dem aktuell gewählten Zeitraum und Vergleich.
function openReport(projectId: string | null) {
  const current = new URLSearchParams(window.location.search);
  const range = current.get('range');
  const vergleich = current.get('vergleich');
  const params = new URLSearchParams({ print: '1', ...(range ? { range } : {}), ...(vergleich ? { vergleich } : {}) });
  const base = projectId ? `/projekt/${projectId}/bericht` : '/demo-anwalt/bericht';
  window.open(`${base}?${params.toString()}`, '_blank', 'noopener');
}

/** projectId null = öffentliche Demo (Demo-Bericht, Demo-Link statt Gastlink). */
export default function ProjectActions({ projectId, collapsed = false }: { projectId: string | null; collapsed?: boolean }) {
  const [isShareOpen, setIsShareOpen] = useState(false);

  const item = `flex h-8 items-center gap-2 rounded-lg text-13 font-medium text-muted transition-colors duration-150 ease-out
    hover:bg-fill hover:text-heading focus-visible:outline-2 focus-visible:outline-accent ${collapsed ? 'w-9 justify-center' : 'px-2.5'}`;

  return (
    <>
      <div className={`flex ${collapsed ? 'flex-col items-center' : 'items-center'} gap-0.5`}>
        <button type="button" onClick={() => openReport(projectId)} className={item} aria-label={collapsed ? 'Drucken' : undefined} title="Bericht drucken oder als PDF sichern">
          <Printer size={14} aria-hidden="true" />
          {!collapsed && 'Drucken'}
        </button>
        <button type="button" onClick={() => setIsShareOpen(true)} className={item} aria-label={collapsed ? 'Teilen' : undefined} title="Gastlink für 24 Stunden erstellen">
          <Share size={14} aria-hidden="true" />
          {!collapsed && 'Teilen'}
        </button>
      </div>
      {projectId ? (
        <ShareLinkDialog projectId={projectId} open={isShareOpen} onClose={() => setIsShareOpen(false)} />
      ) : (
        <DemoShareDialog open={isShareOpen} onClose={() => setIsShareOpen(false)} />
      )}
    </>
  );
}
