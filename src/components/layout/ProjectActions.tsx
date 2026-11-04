'use client';

import { useState } from 'react';
import { Printer, Share } from 'react-bootstrap-icons';
import ShareLinkDialog from '@/components/ShareLinkDialog';

// Drucken und Gastlink für das geöffnete Projekt, zurückhaltend in der Sidebar.
// Drucken öffnet den eigenen Druckbericht mit dem aktuell gewählten Zeitraum.
function openReport(projectId: string) {
  const range = new URLSearchParams(window.location.search).get('range');
  const params = new URLSearchParams({ print: '1', ...(range ? { range } : {}) });
  window.open(`/projekt/${projectId}/bericht?${params.toString()}`, '_blank', 'noopener');
}

export default function ProjectActions({ projectId, collapsed = false }: { projectId: string; collapsed?: boolean }) {
  const [isShareOpen, setIsShareOpen] = useState(false);

  const item = `flex h-8 items-center gap-2 rounded-lg text-[13px] font-medium text-muted transition-colors duration-150 ease-out
    hover:bg-fill hover:text-heading focus-visible:outline-2 focus-visible:outline-accent ${collapsed ? 'w-9 justify-center' : 'px-2.5'}`;

  return (
    <>
      <div className={`flex ${collapsed ? 'flex-col items-center' : 'items-center'} gap-0.5`}>
        <button type="button" onClick={() => openReport(projectId)} className={item} aria-label={collapsed ? 'Drucken' : undefined} title="Projektseite drucken">
          <Printer size={14} aria-hidden="true" />
          {!collapsed && 'Drucken'}
        </button>
        <button type="button" onClick={() => setIsShareOpen(true)} className={item} aria-label={collapsed ? 'Teilen' : undefined} title="Gastlink für 24 Stunden erstellen">
          <Share size={14} aria-hidden="true" />
          {!collapsed && 'Teilen'}
        </button>
      </div>
      <ShareLinkDialog projectId={projectId} open={isShareOpen} onClose={() => setIsShareOpen(false)} />
    </>
  );
}
