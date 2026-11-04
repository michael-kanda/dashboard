// src/app/admin/redaktionsplan/page.tsx
'use client';

import { useState, useEffect, ReactNode, useCallback, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { User } from '@/types';
import DateRangeSelector, { type DateRangeOption } from '@/components/DateRangeSelector';
import { PageContainer, PageHeader } from '@/components/ui/Page';
import { GroupedSection, GroupedRow } from '@/components/ui/GroupedList';
import { SearchField } from '@/components/ui/SearchField';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Button, IconButton } from '@/components/ui/Button';
import { DataList, DataListHead, EmptyRow, ListSkeleton, Td, Th, Tr } from '@/components/ui/DataList';
import { StatusPill, type StatusTone } from '@/components/ui/Status';
import { inputClasses, textareaClasses } from '@/components/ui/Field';

// Icons
import { ArrowUp, ArrowDown, CheckCircleFill, Search, Trash } from 'react-bootstrap-icons';
import { Spinner } from '@/components/ui/Spinner';

// Typdefinition
type Landingpage = {
  id: number;
  url: string;
  haupt_keyword: string | null;
  weitere_keywords: string | null;
  status: 'Offen' | 'In Prüfung' | 'Gesperrt' | 'Freigegeben';
  comment: string | null;
  user_id: string;
  created_at: string;
  updated_at?: string;
  
  gsc_klicks: number | null;
  gsc_klicks_change: number | null;
  gsc_impressionen: number | null;
  gsc_impressionen_change: number | null;
  gsc_position: number | string | null;
  gsc_position_change: number | string | null;
  gsc_last_updated: string | null;
  gsc_last_range: string | null;
};

type LandingpageStatus = Landingpage['status'];

// Helper für GSC Indicators
const GscChangeIndicator = ({ change, isPosition = false }: { change: number | string | null | undefined, isPosition?: boolean }) => {
  const numChange = (change === null || change === undefined || change === '') ? 0 : parseFloat(String(change));
  if (numChange === 0) return null;
  
  let isPositive = isPosition ? numChange < 0 : numChange > 0;
  
  let text = isPosition 
    ? (numChange > 0 ? `+${numChange.toFixed(2)}` : numChange.toFixed(2)) 
    : (numChange > 0 ? `+${numChange.toLocaleString('de-DE')}` : numChange.toLocaleString('de-DE'));
  
  const Icon = isPositive ? ArrowUp : ArrowDown;

  return (
    <StatusPill tone={isPositive ? 'success' : 'danger'} className="gap-0.5 tabular-nums">
      <Icon size={9} aria-hidden="true" />
      {text}
    </StatusPill>
  );
};

const formatDateOnly = (dateString?: string | null) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

// Interne Komponente
function RedaktionsplanContent() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialProjectId = searchParams.get('id');

  const [projects, setProjects] = useState<User[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>(initialProjectId || '');
  const [landingpages, setLandingpages] = useState<Landingpage[]>([]);
  const [filteredPages, setFilteredPages] = useState<Landingpage[]>([]);
  const [filterStatus, setFilterStatus] = useState<LandingpageStatus | 'alle'>('alle');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [message, setMessage] = useState('');
  
  // NEU: Suchzustand für Projekte
  const [projectSearch, setProjectSearch] = useState('');
  
  const [savedCommentId, setSavedCommentId] = useState<number | null>(null);
  
  const [dateRange, setDateRange] = useState<DateRangeOption>('30d');
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (authStatus === 'authenticated') loadProjects();
  }, [authStatus]);

  const loadLandingpages = useCallback(async (userId: string) => {
    setIsLoading(true);
    setMessage('');
    try {
      const response = await fetch(`/api/users/${userId}/landingpages`);
      if (!response.ok) throw new Error('Fehler beim Laden');
      const data: Landingpage[] = await response.json();
      setLandingpages(data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Fehler');
      setLandingpages([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedProject) loadLandingpages(selectedProject);
    else { setLandingpages([]); setFilteredPages([]); }
    setFilterStatus('alle');
  }, [selectedProject, loadLandingpages]);

  useEffect(() => {
    setFilteredPages(filterStatus === 'alle' ? landingpages : landingpages.filter(lp => lp.status === filterStatus));
  }, [filterStatus, landingpages]);

  const loadProjects = async () => {
    setIsLoadingProjects(true);
    try {
      const response = await fetch('/api/users?onlyCustomers=true');
      if (!response.ok) throw new Error('Fehler');
      const data: User[] = await response.json();
      setProjects(data);
    } catch (error) { setMessage('Fehler beim Laden der Projekte'); } finally { setIsLoadingProjects(false); }
  };

  const updateStatus = async (landingpageId: number, newStatus: LandingpageStatus) => {
    const now = new Date().toISOString();
    const originalLandingpages = [...landingpages];
    setLandingpages(prev => prev.map(lp => lp.id === landingpageId ? { ...lp, status: newStatus, updated_at: now } : lp));

    try {
      const response = await fetch(`/api/landingpages/${landingpageId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (!response.ok) throw new Error('Update fehlgeschlagen');
      setMessage(`Status geändert`);
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setLandingpages(originalLandingpages);
      setMessage('Fehler beim Ändern des Status');
    }
  };

  const saveComment = async (landingpageId: number, newComment: string) => {
    try {
      setLandingpages(prev => prev.map(lp => lp.id === landingpageId ? { ...lp, comment: newComment } : lp));
      
      const response = await fetch(`/api/landingpages/${landingpageId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: newComment })
      });

      if (!response.ok) throw new Error('Kommentar konnte nicht gespeichert werden');
      
      setSavedCommentId(landingpageId);
      setTimeout(() => setSavedCommentId(null), 60000); 

    } catch (error) {
      console.error(error);
      setMessage('Fehler beim Speichern des Kommentars');
    }
  };

  const deleteLandingpage = async (landingpageId: number, landingpageUrl: string) => {
    if (!window.confirm(`Wirklich löschen?\n\n${landingpageUrl}`)) return;
    try {
      const response = await fetch(`/api/landingpages/${landingpageId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Löschen fehlgeschlagen');
      setLandingpages(prev => prev.filter(lp => lp.id !== landingpageId));
      setMessage('✅ Gelöscht');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) { setMessage('Fehler beim Löschen'); }
  };

const handleGscRefresh = async () => {
  if (!selectedProject) return;
  setIsRefreshing(true);
  setMessage('');
  
  try {
    const response = await fetch('/api/landingpages/refresh-gsc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: selectedProject, dateRange })
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.message || 'GSC-Abgleich fehlgeschlagen');
    }
    
    // ✅ KORREKTUR: Zuerst die Tabelle neu laden
    // loadLandingpages löscht alle Nachrichten ("setMessage('')"), 
    // deshalb muss das passieren, BEVOR wir unsere Erfolgsmeldung setzen.
    await loadLandingpages(selectedProject);

    // ✅ Erfolgsmeldung erst JETZT setzen
    const updatedCount = result.updatedCount || 0;
    setMessage(`GSC-Daten erfolgreich abgeglichen! ${updatedCount} Seiten aktualisiert.`);
    
    // Auto-Hide nach 5 Sekunden
    setTimeout(() => setMessage(''), 5000);
    
  } catch (error) { 
    setMessage(`Fehler beim GSC-Abgleich: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`);
    setTimeout(() => setMessage(''), 8000);
  } finally { 
    setIsRefreshing(false); 
  }
};

  const STATUS_TONES: Record<LandingpageStatus, StatusTone> = {
    'Offen': 'accent',
    'In Prüfung': 'warning',
    'Gesperrt': 'danger',
    'Freigegeben': 'success',
  };
  const filterOptions: { label: string; value: LandingpageStatus | 'alle' }[] = (
    ['alle', 'Offen', 'In Prüfung', 'Freigegeben', 'Gesperrt'] as (LandingpageStatus | 'alle')[]
  ).map((value) => ({
    value,
    label: `${value === 'alle' ? 'Alle' : value} ${value === 'alle' ? landingpages.length : landingpages.filter(lp => lp.status === value).length}`,
  }));

  if (authStatus === 'loading') return <PageContainer><ListSkeleton rows={3} label="Wird geladen …" /></PageContainer>;
  if (authStatus === 'unauthenticated' || (session?.user?.role !== 'ADMIN' && session?.user?.role !== 'SUPERADMIN')) {
    router.push('/'); return null;
  }

  const visibleProjects = projects.filter(p => {
    if (!projectSearch) return true;
    const searchLower = projectSearch.toLowerCase();
    const domain = p.domain?.toLowerCase() || '';
    const email = p.email?.toLowerCase() || '';
    return domain.includes(searchLower) || email.includes(searchLower);
  });

  return (
    <PageContainer>
      <PageHeader title="Redaktionspläne" subtitle="Landingpages und Anmerkungen verwalten">
        {selectedProject && (
          <SegmentedControl label="Nach Status filtern" options={filterOptions} value={filterStatus} onChange={setFilterStatus} />
        )}
      </PageHeader>

      {message && (
        <p role="status" className={`text-[14px] ${message.startsWith('Fehler') ? 'text-danger' : 'text-success'}`}>
          {message}
        </p>
      )}

      <GroupedSection title="Projekt">
        <GroupedRow label="Projekt suchen">
          <SearchField label="Projekte durchsuchen" placeholder="Domain oder E-Mail" value={projectSearch} onChange={setProjectSearch} />
        </GroupedRow>
        <GroupedRow label="Projekt auswählen" htmlFor="projectSelect">
          <select
            id="projectSelect"
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            disabled={isLoadingProjects}
            className={`${inputClasses} min-w-[240px]`}
          >
            <option value="">{isLoadingProjects ? 'Projekte werden geladen …' : 'Bitte wählen'}</option>
            {visibleProjects.map((p) => <option key={p.id} value={p.id}>{p.domain || p.email}</option>)}
          </select>
        </GroupedRow>
        {selectedProject && (
          <GroupedRow label="GSC-Daten abgleichen" description="Klicks, Impressionen und Position für den gewählten Zeitraum">
            <DateRangeSelector value={dateRange} onChange={setDateRange} className="w-full sm:w-auto" />
            <Button variant="plain" size="sm" onClick={handleGscRefresh} disabled={isRefreshing || isLoading}>
              {isRefreshing ? <Spinner size={14} className="" /> : <Search size={14} aria-hidden="true" />}
              {isRefreshing ? 'Wird abgeglichen …' : 'Abgleichen'}
            </Button>
          </GroupedRow>
        )}
      </GroupedSection>

      {selectedProject && (
        isLoading ? (
          <ListSkeleton rows={4} label="Landingpages werden geladen …" />
        ) : (
          <DataList label="Landingpages" minWidth={1320}>
            <DataListHead>
              <Th className="w-[20%]">URL / Keyword</Th>
              <Th>Daten</Th>
              <Th className="text-right">GSC Klicks</Th>
              <Th className="text-right">GSC Impr.</Th>
              <Th className="text-right">GSC Pos.</Th>
              <Th>Status</Th>
              <Th className="w-[32%]">Anmerkung</Th>
              <Th className="text-right">Aktionen</Th>
            </DataListHead>
            <tbody>
              {filteredPages.length === 0 && <EmptyRow colSpan={8}>Keine Landingpages gefunden</EmptyRow>}
              {filteredPages.map((lp) => (
                <Tr key={lp.id} className="align-top">
                  <Td className="align-top">
                    <div className="max-w-[280px] truncate text-[15px] font-semibold text-heading" title={lp.haupt_keyword || undefined}>
                      {lp.haupt_keyword || <span className="font-normal text-muted">Kein Keyword</span>}
                    </div>
                    <a href={lp.url} target="_blank" rel="noopener noreferrer" className="block max-w-[280px] truncate text-[13px] text-accent hover:underline" title={lp.url}>{lp.url}</a>
                  </Td>
                  <Td className="whitespace-nowrap align-top text-[13px] text-muted">
                    <div>Erstellt: {formatDateOnly(lp.created_at)}</div>
                    <div>Update: {formatDateOnly(lp.updated_at)}</div>
                  </Td>
                  <Td className="whitespace-nowrap text-right align-top">
                    <div className="flex flex-col items-end gap-1">
                      <span className="font-medium text-heading tabular-nums">{lp.gsc_klicks?.toLocaleString('de-AT') || '–'}</span>
                      <GscChangeIndicator change={lp.gsc_klicks_change} />
                    </div>
                  </Td>
                  <Td className="whitespace-nowrap text-right align-top">
                    <div className="flex flex-col items-end gap-1">
                      <span className="font-medium text-heading tabular-nums">{lp.gsc_impressionen?.toLocaleString('de-AT') || '–'}</span>
                      <GscChangeIndicator change={lp.gsc_impressionen_change} />
                    </div>
                  </Td>
                  <Td className="whitespace-nowrap text-right align-top">
                    <div className="flex flex-col items-end gap-1">
                      <span className="font-medium text-heading tabular-nums">{lp.gsc_position ? parseFloat(String(lp.gsc_position)).toLocaleString('de-AT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '–'}</span>
                      <GscChangeIndicator change={lp.gsc_position_change} isPosition={true} />
                    </div>
                  </Td>
                  <Td className="whitespace-nowrap align-top"><StatusPill tone={STATUS_TONES[lp.status] ?? 'neutral'}>{lp.status}</StatusPill></Td>
                  <Td className="relative align-top">
                    <label htmlFor={`comment-${lp.id}`} className="sr-only">Anmerkung zu {lp.url}</label>
                    <textarea
                      id={`comment-${lp.id}`}
                      className={`${textareaClasses} resize-y`}
                      rows={3}
                      defaultValue={lp.comment || ''}
                      placeholder="Anmerkung hinzufügen …"
                      onBlur={(e) => {
                        if (e.target.value !== (lp.comment || '')) {
                          saveComment(lp.id, e.target.value);
                        }
                      }}
                    />
                    {savedCommentId === lp.id && (
                      <div role="status" className="absolute right-[26px] top-5 z-10 inline-flex items-center gap-1.5 rounded-pill bg-success-bg px-2 py-0.5 text-[13px] font-semibold text-success">
                        <CheckCircleFill size={10} aria-hidden="true" />
                        Gespeichert & Kunde benachrichtigt
                      </div>
                    )}
                  </Td>
                  <Td className="whitespace-nowrap align-top">
                    <div className="flex items-center justify-end gap-1">
                      <div role="group" aria-label="Status setzen" className="inline-flex rounded-[9px] bg-fill p-0.5">
                        {(['Offen', 'In Prüfung', 'Freigegeben', 'Gesperrt'] as LandingpageStatus[]).map(status => (
                          <button
                            key={status}
                            type="button"
                            onClick={() => updateStatus(lp.id, status)}
                            disabled={lp.status === status}
                            aria-pressed={lp.status === status}
                            aria-label={`Status auf „${status}“ setzen`}
                            title={status}
                            className={`h-7 w-7 rounded-[7px] text-[13px] transition-colors duration-150 ease-out ${lp.status === status ? 'bg-surface font-semibold text-heading shadow-segment' : 'font-medium text-secondary hover:text-heading'}`}
                          >
                            {status.substring(0, 1)}
                          </button>
                        ))}
                      </div>
                      <IconButton label={`Landingpage ${lp.url} löschen`} onClick={() => deleteLandingpage(lp.id, lp.url)} className="text-danger hover:text-danger">
                        <Trash size={15} aria-hidden="true" />
                      </IconButton>
                    </div>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </DataList>
        )
      )}
    </PageContainer>
  );
}

export default function RedaktionsplanPage() {
  return (
    <Suspense fallback={<PageContainer><ListSkeleton rows={3} label="Redaktionsplan wird geladen …" /></PageContainer>}>
      <RedaktionsplanContent />
    </Suspense>
  );
}
