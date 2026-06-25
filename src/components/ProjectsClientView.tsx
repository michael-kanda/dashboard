// src/components/ProjectsClientView.tsx
'use client';

import { useState } from 'react';
// NEU: useRouter für die Navigation nach dem Timeout
import { useRouter } from 'next/navigation'; 
// Link wird nur noch für nicht-interaktive Elemente verwendet oder entfernt, wo es ersetzt wird
// import Link from 'next/link'; 
import {
  Search, CheckCircleFill, XCircleFill, FileEarmarkText,
  ShieldLock, BoxArrowInRight, Globe, CalendarRange,
  ArrowUp, ArrowDown, ArrowRight
} from 'react-bootstrap-icons';
import { addMonths, format } from 'date-fns';
// ✅ WICHTIG: Importiere ProjectStats aus schemas
import type { ProjectStats } from '@/lib/schemas';
// NEU: Import der Lightbox-Komponente
import TransitioningLightbox from '@/components/ui/TransitioningLightbox'; 

interface Props {
  initialProjects: ProjectStats[];
}

// Zeit in Millisekunden, die die Lightbox angezeigt wird, bevor die Navigation startet.
const LIGHTBOX_DELAY_MS = 500; 

export default function ProjectsClientView({ initialProjects }: Props) {
  const router = useRouter(); // Initialisiere den Router für die Navigation
  
  const [searchTerm, setSearchTerm] = useState('');
  // NEUE STATES FÜR DIE LIGHTBOX UND NACHRICHT
  const [isNavigating, setIsNavigating] = useState(false);
  const [lightboxMessage, setLightboxMessage] = useState('');

  /**
   * Zeigt die Lightbox an und leitet dann nach einer kurzen Verzögerung um.
   * @param path Der Zielpfad (href).
   * @param message Die in der Lightbox anzuzeigende Nachricht.
   */
  const handleNavigationWithLightbox = (path: string, message: string) => {
    // 1. Lightbox-Status setzen
    setLightboxMessage(message);
    setIsNavigating(true);

    // 2. Verzögerte Navigation starten
    setTimeout(() => {
      router.push(path);
      // Beim Routenwechsel wird die Komponente sowieso unmounted,
      // aber es ist sauberer, den State nach der Navigation zurückzusetzen,
      // falls das Routing fehlschlägt oder ähnliches.
      // In Next.js ist das Zurücksetzen oft nicht nötig, aber eine Option.
      // setIsNavigating(false); 
    }, LIGHTBOX_DELAY_MS); 
  };


  // Filtern passiert jetzt client-seitig auf den bereits geladenen Daten
  const filteredProjects = initialProjects.filter(user => 
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.domain && user.domain.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const renderTrendBadge = (change: number | undefined) => {
    let badgeClass = "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-900";
    let Icon = ArrowRight;
    let label = "0%";

    if (change !== undefined && change !== null) {
      if (change > 0) {
        badgeClass = "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-300 dark:border-green-900";
        Icon = ArrowUp;
        label = `+${change.toFixed(1)}%`;
      } else if (change < 0) {
        badgeClass = "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-900";
        Icon = ArrowDown;
        label = `${change.toFixed(1)}%`;
      }
    } else {
        label = "-";
    }

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold border ${badgeClass}`} title="Reichweiten-Trend (GSC)">
        <Icon size={12} />
        {label}
      </span>
    );
  };

  // WICHTIG: Wenn die Navigation aktiv ist, nur die Lightbox rendern
  if (isNavigating) {
    return <TransitioningLightbox message={lightboxMessage} />;
  }

  return (
    <div className="min-h-screen bg-surface-secondary px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1540px]">
        <div className="mb-7 flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">
              Kundenprojekte
            </p>
            <h1 className="text-2xl font-semibold text-heading">Projektübersicht</h1>
            <p className="mt-1 text-sm text-muted">
              {filteredProjects.length} von {initialProjects.length} Projekten
            </p>
          </div>
          
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" size={16} />
            <input
              type="text"
              placeholder="Projekt, Domain oder E-Mail suchen..."
              className="w-full rounded-md border border-theme-border-default bg-surface py-2 pl-10 pr-4 text-sm text-heading outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 2xl:grid-cols-3">
          {filteredProjects.map((user) => {
            const hasRedaktionsplan = (user.landingpages_count || 0) > 0;
            const adminsDisplay = user.assigned_admins 
              ? user.assigned_admins 
              : (user.creator_email || 'System');

            let dateRangeString = null;
            if (user.project_timeline_active) {
              const start = user.project_start_date ? new Date(user.project_start_date) : new Date(user.createdAt || new Date());
              const duration = user.project_duration_months || 6;
              const end = addMonths(start, duration);
              dateRangeString = `${format(start, 'dd.MM.yyyy')} - ${format(end, 'dd.MM.yyyy')}`;
            }

            return (
              <article key={user.id} className="dashboard-widget-surface flex h-full flex-col rounded-lg p-5 transition-shadow hover:shadow-lg">
                
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="flex min-w-0 items-center gap-2 text-base font-semibold text-heading">
                        <Globe size={16} className="shrink-0 text-faint" />
                        <span className="truncate">
                        {user.domain || 'Keine Domain'}
                        </span>
                      </h3>
                      {renderTrendBadge(user.total_impression_change)}
                    </div>
                    <div className="mt-1 truncate text-xs text-muted">{user.email}</div>
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => handleNavigationWithLightbox(
                        `/projekt/${user.id}`, 
                        `Lade Dashboard für ${user.domain || 'das Projekt'}...`
                    )}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700"
                  >
                    Öffnen <BoxArrowInRight size={14}/>
                  </button>
                </div>

                <div className="mb-4 grid grid-cols-2 gap-4 border-y border-theme-border-subtle py-4">
                  <div className="flex flex-col">
                    <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-faint">Projekt-Timeline</span>
                    <div className="flex flex-col gap-1">
                      {user.project_timeline_active ? (
                        <>
                          <span className="inline-flex w-fit items-center gap-1.5 rounded-md bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                            <CheckCircleFill size={12} /> Aktiviert
                          </span>
                          {dateRangeString && (
                            <span className="text-xs text-muted flex items-center gap-1 mt-1 ml-1">
                              <CalendarRange size={10} /> {dateRangeString}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="inline-flex w-fit items-center gap-1.5 rounded-md bg-surface-tertiary px-2 py-1 text-xs font-medium text-muted">
                          <XCircleFill size={12} /> Deaktiviert
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end">
                    <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-faint">Redaktionsplan</span>
                    {hasRedaktionsplan ? (
                      // BUTTON 2: REDAKTIONSPLAN (Link durch span mit onClick ersetzt)
                      <span 
                        onClick={() => handleNavigationWithLightbox(
                            `/admin/redaktionsplan?id=${user.id}`, 
                            `Weiterleitung zum Redaktionsplan...`
                        )}
                        className="inline-flex w-fit cursor-pointer items-center gap-1.5 rounded-md bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 transition hover:bg-blue-100 dark:bg-blue-950/30 dark:text-blue-300"
                        role="button"
                        tabIndex={0}
                      >
                        <FileEarmarkText size={12} /> Vorhanden (Öffnen)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-muted w-fit">
                        <span className="w-3 h-3 rounded-full border-2 border-theme-border-default"></span>
                        Nein
                      </span>
                    )}
                  </div>
                </div>

                <div className="mb-4 rounded-md bg-surface-secondary p-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-semibold text-body">Landingpages ({user.landingpages_count || 0})</span>
                  </div>
                  {hasRedaktionsplan ? (
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <div className="flex flex-col rounded bg-surface p-1.5">
                        <span className="text-[10px] text-faint uppercase">Offen</span>
                        <span className="text-sm font-bold text-blue-600">{user.landingpages_offen}</span>
                      </div>
                      <div className="flex flex-col rounded bg-surface p-1.5">
                        <span className="text-[10px] text-faint uppercase">Prüfung</span>
                        <span className="text-sm font-bold text-amber-500">{user.landingpages_in_pruefung}</span>
                      </div>
                      <div className="flex flex-col rounded bg-surface p-1.5">
                        <span className="text-[10px] text-faint uppercase">Freigabe</span>
                        <span className="text-sm font-bold text-green-600">{user.landingpages_freigegeben}</span>
                      </div>
                      <div className="flex flex-col rounded bg-surface p-1.5">
                        <span className="text-[10px] text-faint uppercase">Gesperrt</span>
                        <span className="text-sm font-bold text-red-500">{user.landingpages_gesperrt}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-faint text-center py-2 italic">Keine Landingpages angelegt</div>
                  )}
                </div>

                <div className="mt-auto flex items-start gap-2 border-t border-theme-border-subtle pt-3 text-xs text-muted">
                  <ShieldLock size={12} className="mt-0.5 flex-shrink-0" />
                  <div className="flex flex-col w-full">
                    <span className="font-medium mb-1">Betreut durch:</span>
                    <div className="flex flex-wrap gap-1">
                      {adminsDisplay.split(', ').map((adminEmail, idx) => (
                        <span key={idx} className="max-w-full truncate rounded bg-surface-tertiary px-2 py-0.5 text-body" title={adminEmail}>
                          {adminEmail}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

              </article>
            );
          })}
          
          {filteredProjects.length === 0 && (
            <div className="dashboard-widget-surface col-span-full rounded-lg py-12 text-center text-muted">
              Keine Projekte gefunden.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
