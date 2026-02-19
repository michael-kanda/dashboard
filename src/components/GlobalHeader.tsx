// src/components/GlobalHeader.tsx
'use client';

import React from 'react';
import { Globe, ShieldLock } from 'react-bootstrap-icons';
import DateRangeSelector, { type DateRangeOption } from '@/components/DateRangeSelector';

interface GlobalHeaderProps {
  domain?: string;
  projectId?: string;
  dateRange: DateRangeOption;
  onDateRangeChange: (range: DateRangeOption) => void;
  userRole?: string;
  userEmail?: string;
}

export default function GlobalHeader({
  domain,
  projectId,
  dateRange,
  onDateRangeChange,
  userRole = 'USER',
  userEmail = ''
}: GlobalHeaderProps) {

  const isAdmin = userRole === 'ADMIN' || userRole === 'SUPERADMIN';

  return (
    <div className="relative sm:sticky sm:top-0 z-40 card-glass p-4 sm:p-6 mb-6 print:hidden bg-white/95 dark:bg-gray-900/95 backdrop-blur-md transition-all duration-200 border-b border-gray-100 dark:border-gray-800">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        
        {/* LINKE SEITE: Projekt-Kontext */}
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 bg-indigo-50/80 dark:bg-indigo-500/15 p-3 rounded-xl backdrop-blur-sm shadow-sm border border-indigo-100/50 dark:border-indigo-500/20">
            <Globe size={28} />
          </div>

          <div className="h-12 w-px bg-gray-200/60 dark:bg-gray-700/60 mx-1 hidden sm:block"></div>

          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl font-bold text-theme-heading tracking-tight">{domain || 'Projekt Dashboard'}</h1>
              {isAdmin && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
                  <ShieldLock size={10} />
                  <span>Admin</span>
                </span>
              )}
            </div>

            <div className="flex flex-col gap-1">
              {/* Projekt-ID */}
              {projectId && (
                <span className="text-[10px] text-theme-muted font-mono tracking-wide">
                  ID: {projectId}
                </span>
              )}

              {/* Betreut durch */}
              {userEmail && (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 mt-1 rounded-full text-[10px] font-bold tracking-wider bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-500/15 dark:to-teal-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-100/80 dark:border-emerald-500/25 shadow-sm w-fit">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                  </span>
                  <span className="uppercase">Betreut durch:</span>
                  <span className="lowercase font-medium">{userEmail}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RECHTE SEITE: Date Range + Update-Info */}
        <div className="w-full sm:w-auto flex flex-col gap-2 sm:items-end">

          {/* Update-Info (über dem Picker) */}
          <span className="text-theme-muted text-[10px] flex items-center gap-1">
            <span>Google Updates: 24h</span>
            <span className="text-gray-300 dark:text-gray-600">•</span>
            <span>Semrush Updates: 14 Tage</span>
          </span>

          <DateRangeSelector
            value={dateRange}
            onChange={onDateRangeChange}
            className="w-full sm:w-auto shadow-sm"
          />
        </div>
      </div>
    </div>
  );
}
