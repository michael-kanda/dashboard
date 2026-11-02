// src/app/dashboard/freigabe/page.tsx
'use client';

import { useState, useEffect, ReactNode, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import DateRangeSelector, { type DateRangeOption } from '@/components/DateRangeSelector';
import { cn } from '@/lib/utils';

// Icons
import {
  FileEarmarkText,
  Search,
  SlashCircleFill,
  CheckCircleFill, // ✅ Wichtig
  InfoCircle,
  ExclamationTriangleFill,
  ArrowRepeat,
  InfoCircleFill,
  ListTask,
  Filter,
  ArrowUp,
  ArrowDown,
  CalendarEvent, 
  ClockHistory,
  ChatSquareText
} from 'react-bootstrap-icons';

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
  
  const colorClasses = isPositive ? 'text-success bg-success-bg' : 'text-danger bg-danger-bg';
  const Icon = isPositive ? ArrowUp : ArrowDown;

  return (
    <span className={cn('inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-[4px] text-[10px] font-bold', colorClasses)}>
      <Icon size={9} />
      {text}
    </span>
  );
};

const formatDateOnly = (dateString?: string | null) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export default function FreigabePage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();

  const [landingpages, setLandingpages] = useState<Landingpage[]>([]);
  const [filteredPages, setFilteredPages] = useState<Landingpage[]>([]);
  const [filterStatus, setFilterStatus] = useState<LandingpageStatus | 'alle'>('alle');
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState('');
  
  // ✅ State für das grüne Hackerl
  const [savedCommentId, setSavedCommentId] = useState<number | null>(null);
  
  const [dateRange, setDateRange] = useState<DateRangeOption>('30d');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadLandingpages = useCallback(async () => {
    if (!session?.user?.id) return;
    if (landingpages.length === 0) setIsLoading(true);

    try {
      const response = await fetch(`/api/users/${session.user.id}/landingpages`);
      if (!response.ok) throw new Error('API-Fehler');
      const data: Landingpage[] = await response.json();
      setLandingpages(data);
      if(message.startsWith('Starte')) setMessage('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Fehler');
    } finally {
      setIsLoading(false);
    }
  }, [session?.user?.id, landingpages.length, message]);

  useEffect(() => {
    if (authStatus === 'authenticated' && session?.user?.id) {
      loadLandingpages();
    }
  }, [authStatus, session?.user?.id, loadLandingpages]);

  useEffect(() => {
    setFilteredPages(filterStatus === 'alle' ? landingpages : landingpages.filter(lp => lp.status === filterStatus));
  }, [filterStatus, landingpages]);

  const updateStatus = async (landingpageId: number, newStatus: 'Freigegeben' | 'Gesperrt') => {
    const now = new Date().toISOString();
    const originalLandingpages = [...landingpages];
    setLandingpages(prev => prev.map(lp => lp.id === landingpageId ? { ...lp, status: newStatus, updated_at: now } : lp));
    setMessage('');

    try {
      const response = await fetch(`/api/landingpages/${landingpageId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (!response.ok) throw new Error('Status-Update fehlgeschlagen');
      setMessage(`Status auf "${newStatus}" geändert`);
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setLandingpages(originalLandingpages);
      setMessage('Fehler beim Ändern des Status');
    }
  };

  // ✅ Kommentarspeicher-Logik MIT Hackerl
  const saveComment = async (landingpageId: number, newComment: string) => {
    try {
      setLandingpages(prev => prev.map(lp => lp.id === landingpageId ? { ...lp, comment: newComment } : lp));
      
      const response = await fetch(`/api/landingpages/${landingpageId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: newComment })
      });
      if (!response.ok) throw new Error('Fehler');
      
      // ✅ LÄNGERE DAUER (60 Sekunden) & Feedback
      setSavedCommentId(landingpageId);
      setTimeout(() => setSavedCommentId(null), 60000); // 60000ms = 1 Minute

    } catch (error) {
      console.error(error);
      setMessage('Kommentar konnte nicht gespeichert werden');
    }
  };
  
  const handleGscRefresh = async () => {
    if (!session?.user?.id) return;
    setIsRefreshing(true);
    setMessage(`GSC-Abgleich...`);
    try {
      const response = await fetch('/api/landingpages/refresh-gsc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: session.user.id, dateRange })
      });
      if (!response.ok) throw new Error('Fehler');
      setMessage('Daten erfolgreich abgeglichen!');
      await loadLandingpages(); 
    } catch (error) {
      setMessage('Fehler beim Abgleich');
    } finally {
      setIsRefreshing(false);
    }
  };

  const getStatusStyle = (status: LandingpageStatus) => {
    switch (status) {
      case 'Offen': return 'text-accent border-border bg-accent-tint';
      case 'In Prüfung': return 'text-warning border-yellow-300 bg-warning-bg';
      case 'Gesperrt': return 'text-danger border-border bg-danger-bg';
      case 'Freigegeben': return 'text-success border-border bg-success-bg';
      default: return 'text-body border-border bg-surface-secondary';
    }
  };
  const getStatusIcon = (status: LandingpageStatus): ReactNode => {
    switch (status) {
      case 'Offen': return <FileEarmarkText className="inline-block" size={16} />;
      case 'In Prüfung': return <Search className="inline-block" size={16} />;
      case 'Gesperrt': return <SlashCircleFill className="inline-block" size={16} />;
      case 'Freigegeben': return <CheckCircleFill className="inline-block" size={16} />;
      default: return <InfoCircle className="inline-block" size={16} />;
    }
  };
  const filterOptions = [
    { label: 'Alle', value: 'alle', icon: <ListTask className="inline-block mr-1" size={16}/> },
    { label: 'Offen', value: 'Offen', icon: <FileEarmarkText className="inline-block mr-1" size={16}/> },
    { label: 'In Prüfung', value: 'In Prüfung', icon: <Search className="inline-block mr-1" size={16}/> },
    { label: 'Freigegeben', value: 'Freigegeben', icon: <CheckCircleFill className="inline-block mr-1" size={16}/> },
    { label: 'Gesperrt', value: 'Gesperrt', icon: <SlashCircleFill className="inline-block mr-1" size={16}/> },
  ];

  if (authStatus === 'loading') return <div className="p-8 text-center">Lade...</div>;
  if (authStatus === 'unauthenticated' || session?.user?.role !== 'BENUTZER') {
    router.push('/'); return null;
  }

  return (
    <div className="min-h-screen bg-surface-secondary p-8">
      <div className="max-w-full mx-auto"> 
        
        <div className="mb-8 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-heading">Landingpages Freigabe</h1>
            <p className="text-muted mt-2">Verwalten Sie den Status Ihrer Landingpages.</p>
          </div>
        </div>

        {message && (
          <div className={`mb-6 p-4 border rounded-md flex items-center gap-2 ${message.startsWith('Fehler') ? 'bg-danger-bg border-border text-danger' : 'bg-accent-tint border-border text-accent'}`}>
            {message.startsWith('Fehler') ? <ExclamationTriangleFill size={18}/> : <InfoCircleFill size={18}/>}
            {message}
          </div>
        )}

        <div className="bg-surface p-6 rounded-lg mb-6">
          <h3 className="text-lg font-semibold text-heading mb-4">GSC-Daten Abgleich</h3>
          <div className="flex flex-col sm:flex-row gap-4">
            <DateRangeSelector value={dateRange} onChange={setDateRange} className="w-full sm:w-auto" />
            <button onClick={handleGscRefresh} disabled={isRefreshing || isLoading} className="px-4 py-2 font-medium rounded-md text-white bg-accent-solid hover:opacity-90 disabled:bg-gray-400 disabled:cursor-wait flex items-center justify-center gap-2 w-full sm:w-auto">
              {isRefreshing ? <ArrowRepeat className="animate-spin" size={18} /> : <Search size={16} />}
              <span>{isRefreshing ? 'Wird abgeglichen...' : 'GSC-Daten abgleichen'}</span>
            </button>
          </div>
        </div>

        <div className="bg-surface p-4 rounded-lg mb-6">
           <h3 className="text-sm font-semibold text-muted mb-3 flex items-center gap-1"><Filter size={16}/> Filtern nach Status</h3>
           <div className="flex gap-2 flex-wrap">
              {filterOptions.map(option => (
                <button key={option.value} onClick={() => setFilterStatus(option.value as any)} className={`px-3 py-1.5 text-sm rounded-md font-medium border transition-colors flex items-center gap-1 ${filterStatus === option.value ? 'bg-accent-solid text-white border-accent' : 'bg-surface text-body border-border hover:bg-surface-secondary'}`}>
                    {option.icon} {option.label} ({option.value === 'alle' ? landingpages.length : landingpages.filter(lp => lp.status === option.value).length})
                </button>
             ))}
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12"><ArrowRepeat className="animate-spin inline-block text-accent mr-2" size={24}/><p className="text-muted inline-block">Lade Landingpages...</p></div>
        ) : filteredPages.length === 0 ? (
          <div className="bg-surface p-12 rounded-lg text-center">
             <p className="text-muted">{landingpages.length === 0 ? 'Sie haben noch keine Landingpages.' : `Keine Landingpages mit Status "${filterStatus}" gefunden.`}</p>
          </div>
        ) : (
          <div className="bg-surface rounded-lg overflow-x-auto">
            <table className="w-full min-w-[1400px]">
               <thead className="bg-surface-secondary border-b border-border">
                 <tr>
                   <th className="px-6 py-3 text-left text-xs font-medium text-muted w-[20%]">URL / Keyword</th>
                   <th className="px-6 py-3 text-left text-xs font-medium text-muted"><div className="flex items-center gap-1"><CalendarEvent/> Daten</div></th>
                   
                   <th className="px-6 py-3 text-right text-xs font-medium text-muted">GSC Klicks</th>
                   <th className="px-6 py-3 text-right text-xs font-medium text-muted">GSC Impr.</th>
                   <th className="px-6 py-3 text-right text-xs font-medium text-muted">GSC Pos.</th>
                   
                   <th className="px-6 py-3 text-left text-xs font-medium text-muted">Status</th>
                   <th className="px-6 py-3 text-left text-xs font-medium text-muted w-[35%]">
                     <div className="flex items-center gap-1"><ChatSquareText/> Anmerkung</div>
                   </th>
                   <th className="px-6 py-3 text-left text-xs font-medium text-muted">Aktionen</th>
                 </tr>
               </thead>
               <tbody className="bg-surface divide-y divide-border-subtle">
                 {filteredPages.map((lp) => (
                   <tr key={lp.id} className="hover:bg-surface-secondary transition-colors">
                     {/* (Spalten 1-6 bleiben gleich) */}
                     <td className="px-6 py-4 whitespace-nowrap align-top">
                       <div className="text-sm font-medium text-heading truncate" title={lp.haupt_keyword || undefined}>{lp.haupt_keyword || <span className="text-muted italic">Kein Keyword</span>}</div>
                       <a href={lp.url} target="_blank" rel="noopener noreferrer" className="text-accent hover:text-accent text-xs truncate block" title={lp.url}>{lp.url}</a>
                     </td>
                     <td className="px-6 py-4 whitespace-nowrap text-sm text-muted align-top">
                       <div className="text-xs">Erstellt: {formatDateOnly(lp.created_at)}</div>
                       <div className="text-xs">Update: {formatDateOnly(lp.updated_at)}</div>
                     </td>
                     <td className="px-6 py-4 whitespace-nowrap text-sm text-body text-right align-top">
                       <div className="flex flex-col items-end gap-1">
                         <span className="font-medium text-heading">{lp.gsc_klicks?.toLocaleString('de-DE') || '-'}</span>
                         <GscChangeIndicator change={lp.gsc_klicks_change} />
                       </div>
                     </td>
                     <td className="px-6 py-4 whitespace-nowrap text-sm text-body text-right align-top">
                       <div className="flex flex-col items-end gap-1">
                         <span className="font-medium text-heading">{lp.gsc_impressionen?.toLocaleString('de-DE') || '-'}</span>
                         <GscChangeIndicator change={lp.gsc_impressionen_change} />
                       </div>
                     </td>
                     <td className="px-6 py-4 whitespace-nowrap text-sm text-body text-right align-top">
                       <div className="flex flex-col items-end gap-1">
                         <span className="font-medium text-heading">{lp.gsc_position ? parseFloat(String(lp.gsc_position)).toFixed(2) : '-'}</span>
                         <GscChangeIndicator change={lp.gsc_position_change} isPosition={true} />
                       </div>
                     </td>
                     <td className="px-6 py-4 whitespace-nowrap align-top">
                       <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full border ${getStatusStyle(lp.status)}`}>{getStatusIcon(lp.status)} {lp.status}</span>
                     </td>

                     {/* ✅ Anmerkung mit Badge für Kunde */}
                     <td className="px-6 py-4 align-top relative">
                        <textarea
                          className="w-full text-sm p-2 border border-border rounded focus:ring-accent focus:border-accent resize-y"
                          rows={3}
                          defaultValue={lp.comment || ''}
                          placeholder="Anmerkung hinzufügen..."
                          onBlur={(e) => {
                            if (e.target.value !== (lp.comment || '')) {
                              saveComment(lp.id, e.target.value);
                            }
                          }}
                        />
                        {/* ✅ Feedback Badge (1 Minute) */}
                        {savedCommentId === lp.id && (
                          <div className="absolute top-2 right-2 bg-success-bg text-success text-[10px] font-medium px-2 py-1 rounded border border-border flex items-center gap-1.5 animate-in fade-in zoom-in duration-300 z-10">
                            <CheckCircleFill size={10} />
                            <span>Gespeichert & Betreuer benachrichtigt</span>
                          </div>
                        )}
                     </td>

                     <td className="px-6 py-4 whitespace-nowrap align-top">
                       <div className="flex flex-col gap-2">
                          <button onClick={() => updateStatus(lp.id, 'Freigegeben')} className="px-3 py-1.5 text-xs font-medium rounded bg-green-600 border border-green-600 text-white hover:bg-green-700 flex items-center gap-1 justify-center"><CheckCircleFill size={14} /> Freigeben</button>
                          <button onClick={() => updateStatus(lp.id, 'Gesperrt')} className="px-3 py-1.5 text-xs font-medium rounded border border-red-600 text-danger hover:bg-danger-bg flex items-center gap-1 justify-center"><SlashCircleFill size={14} /> Sperren</button>
                       </div>
                     </td>
                   </tr>
                 ))}
               </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
