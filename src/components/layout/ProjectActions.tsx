'use client';

import { useState } from 'react';
import { Printer, Share } from 'react-bootstrap-icons';
import ShareLinkDialog from '@/components/ShareLinkDialog';

// Drucken und Gastlink für das geöffnete Projekt, zurückhaltend in der Sidebar.
export default function ProjectActions({ projectId, collapsed = false }: { projectId: string; collapsed?: boolean }) {
  const [isShareOpen, setIsShareOpen] = useState(false);

  const item = `flex h-8 items-center gap-2 rounded-lg text-[13px] font-medium text-muted transition-colors duration-150 ease-out
    hover:bg-fill hover:text-heading focus-visible:outline-2 focus-visible:outline-accent ${collapsed ? 'w-9 justify-center' : 'px-2.5'}`;

  return (
    <>
      <div className={`flex ${collapsed ? 'flex-col items-center' : 'items-center'} gap-0.5`}>
        <button type="button" onClick={() => window.print()} className={item} aria-label={collapsed ? 'Drucken' : undefined} title="Projektseite drucken">
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
