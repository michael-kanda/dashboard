// src/components/GlobalHeader.tsx
'use client';

import React, { useState } from 'react';
import { Printer, Share } from 'react-bootstrap-icons';
import { StatusPill } from '@/components/ui/Status';
import { Button } from '@/components/ui/Button';
import ShareLinkDialog from '@/components/ShareLinkDialog';
import { Avatar } from '@/components/ui/AvatarStack';
import DateRangeSelector, { type DateRangeOption } from '@/components/DateRangeSelector';

interface GlobalHeaderProps {
  domain?: string;
  projectId?: string;
  dateRange: DateRangeOption;
  onDateRangeChange: (range: DateRangeOption) => void;
  userRole?: string;
  userEmail?: string;
  userAnsprache?: string | null;
}

export default function GlobalHeader({
  domain,
  projectId,
  dateRange,
  onDateRangeChange,
  userRole = 'USER',
  userEmail = '',
  userAnsprache = null
}: GlobalHeaderProps) {

  const isAdmin = userRole === 'ADMIN' || userRole === 'SUPERADMIN';
  const isGuest = userRole === 'GAST';
  const [isShareOpen, setIsShareOpen] = useState(false);
  const hour = new Date().getHours();
  const greeting =
    hour >= 5 && hour < 11 ? 'Guten Morgen' :
    hour >= 11 && hour < 14 ? 'Mahlzeit' :
    hour >= 18 || hour < 5 ? 'Guten Abend' :
    'Guten Tag';
  const trimmedAnsprache = userAnsprache?.trim();
  const userGreeting = trimmedAnsprache ? `${greeting}, ${trimmedAnsprache}` : greeting;

  return (
    <header className="z-40 -mx-[clamp(16px,3vw,40px)] mb-[22px] border-b border-border-subtle bg-page px-[clamp(16px,3vw,40px)] pb-4 pt-1 print:hidden sm:sticky sm:top-0">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-[29px] font-bold leading-[1.1] tracking-[-0.02em] text-heading">{domain || 'Projekt Dashboard'}</h1>
            {isAdmin && <StatusPill>Admin</StatusPill>}
          </div>
          <div className="mt-1.5 flex flex-col items-start gap-1 text-[14px] text-muted">
            {isAdmin && projectId && <span className="font-mono text-[13px]">ID: {projectId}</span>}
            {!isAdmin && !isGuest && <span>{userGreeting}</span>}
            {userEmail && (
              <span className="inline-flex items-center gap-1.5">
                <Avatar email={userEmail} size={22} />
                <span>Betreut durch {userEmail.toLowerCase()}</span>
              </span>
            )}
          </div>
        </div>

        <div className="flex w-full flex-col gap-1.5 sm:w-auto sm:items-end">
          <span className="text-[13px] text-muted">Google Updates: 24 h · Semrush Updates: 14 Tage</span>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
            <Button variant="secondary" onClick={() => window.print()}>
              <Printer size={14} aria-hidden="true" />
              Drucken
            </Button>
            {!isGuest && projectId && (
              <Button variant="secondary" onClick={() => setIsShareOpen(true)}>
                <Share size={14} aria-hidden="true" />
                Teilen
              </Button>
            )}
            <DateRangeSelector value={dateRange} onChange={onDateRangeChange} className="w-full sm:w-auto" />
          </div>
        </div>
      </div>
      {projectId && !isGuest && (
        <ShareLinkDialog projectId={projectId} open={isShareOpen} onClose={() => setIsShareOpen(false)} />
      )}
    </header>
  );
}
