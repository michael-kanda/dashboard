// src/components/ProjectsClientView.tsx
'use client';

import { useState } from 'react';
// NEU: useRouter für die Navigation nach dem Timeout
import { useRouter } from 'next/navigation'; 
// Link wird nur noch für nicht-interaktive Elemente verwendet oder entfernt, wo es ersetzt wird
// import Link from 'next/link'; 
import { 
  Search, Briefcase, CheckCircleFill, XCircleFill, FileEarmarkText, 
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
    let badgeClass = "bg-blue-50 text-blue-700 border-blue-200";
    let Icon = ArrowRight;
    let label = "0%";

    if (change !== undefined && change !== null) {
      if (change > 0) {
        badgeClass = "bg-green-50 text-green-700 border-green-200";
        Icon = ArrowUp;
        label = `+${change.toFixed(1)}%`;
      } else if (change < 0) {
        badgeClass = "bg-red-50 text-red-700 border-red-200";
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
    <div className="min-h-screen bg-surface-secondary p-4 sm:p-6 lg:p-8">
      <div className="max-w-[1600px] mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-heading flex items-center gap-3">
              <Briefcase className="text-indigo-600" />
              Projekt Übersicht
            </h1>
            <p className="text-gray-500 mt-1">
              Übersicht aller Kundenprojekte und deren aktueller Status.
            </p>
          </div>
          
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Projekt, Domain oder E-Mail suchen..."
              className="w-full pl-10 pr-4 py-2 border border-theme-border-default rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all bg-surface text-heading shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-6">
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
              <div key={user.id} className="bg-surface rounded-xl shadow-sm border border-theme-border-default hover:shadow-lg hover:border-indigo-300 dark:hover:border-indigo-500/30 hover:-translate-y-0.5 transition-all duration-300 p-6 flex flex-col h-full">
                
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                        <Globe size={18} className="text-gray-400" />
                        {user.domain || 'Keine Domain'}
                      </h3>
                      {renderTrendBadge(user.total_impression_change)}
                    </div>
                    <div className="text-sm text-gray-500 mt-1">{user.email}</div>
                  </div>
                  
                  {/* BUTTON 1: ZUM DASHBOARD (Link durch div/button mit onClick ersetzt) */}
                  <div 
                    onClick={() => handleNavigationWithLightbox(
                        `/projekt/${user.id}`, 
                        `Lade Dashboard für ${user.domain || 'das Projekt'}...`
                    )}
                    className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:text-indigo-800 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 cursor-pointer"
                    role="button" // Barrierefreiheit: Als Button kennzeichnen
                    tabIndex={0} // Barrierefreiheit: Fokussierbar machen
                  >
                    Zum Dashboard <BoxArrowInRight size={16}/>
                  </div>
                </div>

                <hr className="border-gray-100 mb-4" />

                <div className="grid grid-cols-2 gap-4 mb-5">
                  <div className="flex flex-col">
                    <span className="text-xs text-gray-400 uppercase font-bold tracking-wider block mb-1">Projekt-Timeline</span>
                    <div className="flex flex-col gap-1">
                      {user.project_timeline_active ? (
                        <>
                          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-green-700 bg-green-50 px-2.5 py-1 rounded-full border border-green-100 w-fit">
                            <CheckCircleFill size={12} /> Aktiviert
                          </span>
                          {dateRangeString && (
                            <span className="text-xs text-gray-500 flex items-center gap-1 mt-1 ml-1">
                              <CalendarRange size={10} /> {dateRangeString}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full border border-gray-200 w-fit">
                          <XCircleFill size={12} /> Deaktiviert
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end">
                    <span className="text-xs text-gray-400 uppercase font-bold tracking-wider block mb-1">Redaktionsplan</span>
                    {hasRedaktionsplan ? (
                      // BUTTON 2: REDAKTIONSPLAN (Link durch span mit onClick ersetzt)
                      <span 
                        onClick={() => handleNavigationWithLightbox(
                            `/admin/redaktionsplan?id=${user.id}`, 
                            `Weiterleitung zum Redaktionsplan...`
                        )}
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 px-2.5 py-1 rounded-full border border-indigo-600 transition-colors w-fit cursor-pointer shadow-sm"
                        role="button"
                        tabIndex={0}
                      >
                        <FileEarmarkText size={12} /> Vorhanden (Öffnen)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 w-fit">
                        <span className="w-3 h-3 rounded-full border-2 border-gray-300"></span>
                        Nein
                      </span>
                    )}
                  </div>
                </div>

                <div className="mb-5 bg-surface-secondary rounded-lg p-3 border border-theme-border-subtle">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-semibold text-gray-700">Landingpages ({user.landingpages_count || 0})</span>
                  </div>
                  {hasRedaktionsplan ? (
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <div className="flex flex-col bg-white rounded border border-gray-200 p-1.5">
                        <span className="text-[10px] text-gray-400 uppercase">Offen</span>
                        <span className="text-sm font-bold text-blue-600">{user.landingpages_offen}</span>
                      </div>
                      <div className="flex flex-col bg-white rounded border border-gray-200 p-1.5">
                        <span className="text-[10px] text-gray-400 uppercase">Prüfung</span>
                        <span className="text-sm font-bold text-amber-500">{user.landingpages_in_pruefung}</span>
                      </div>
                      <div className="flex flex-col bg-white rounded border border-gray-200 p-1.5">
                        <span className="text-[10px] text-gray-400 uppercase">Freigabe</span>
                        <span className="text-sm font-bold text-green-600">{user.landingpages_freigegeben}</span>
                      </div>
                      <div className="flex flex-col bg-white rounded border border-gray-200 p-1.5">
                        <span className="text-[10px] text-gray-400 uppercase">Gesperrt</span>
                        <span className="text-sm font-bold text-red-500">{user.landingpages_gesperrt}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-gray-400 text-center py-2 italic">Keine Landingpages angelegt</div>
                  )}
                </div>

                <div className="mt-auto pt-3 border-t border-gray-100 flex items-start gap-2 text-xs text-gray-500">
                  <ShieldLock size={12} className="mt-0.5 flex-shrink-0" />
                  <div className="flex flex-col w-full">
                    <span className="font-medium mb-1">Betreut durch:</span>
                    <div className="flex flex-wrap gap-1">
                      {adminsDisplay.split(', ').map((adminEmail, idx) => (
                        <span key={idx} className="bg-gray-100 px-2 py-0.5 rounded text-gray-700 truncate max-w-full" title={adminEmail}>
                          {adminEmail}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

              </div>
            );
          })}
          
          {filteredProjects.length === 0 && (
            <div className="col-span-full text-center py-12 bg-surface rounded-xl border border-theme-border-default text-muted">
              Keine Projekte gefunden.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
