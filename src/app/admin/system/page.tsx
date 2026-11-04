'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { ArrowRepeat, PersonCircle } from 'react-bootstrap-icons';
import { toast } from 'sonner';
import LoginLogbook from '@/app/admin/LoginLogbook';
import AiModelSettings from './AiModelSettings';
import { roleLabel } from '@/lib/ui-labels';
import { PageContainer, PageHeader } from '@/components/ui/Page';
import { GroupedSection, GroupedRow } from '@/components/ui/GroupedList';
import { DataList, DataListHead, EmptyRow, PrimaryCell, Td, Th, Tr } from '@/components/ui/DataList';
import { SearchField } from '@/components/ui/SearchField';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Button } from '@/components/ui/Button';
import { MetricTile, StatusDot, StatusPill } from '@/components/ui/Status';
import { Toggle } from '@/components/ui/Toggle';
import { PageSpinner, Spinner } from '@/components/ui/Spinner';

const SERVICE_STATUS: Record<string, { tone: 'success' | 'warning' | 'danger' | 'off'; label: string }> = {
  ok: { tone: 'success', label: 'Verbunden' },
  warning: { tone: 'warning', label: 'Warnung' },
  error: { tone: 'danger', label: 'Fehler' },
  pending: { tone: 'off', label: 'Wird geprüft' },
};

function serviceStatus(value?: string) {
  return SERVICE_STATUS[value || 'pending'] ?? SERVICE_STATUS.error;
}

type SystemTab = 'uebersicht' | 'zugriffe' | 'anmeldungen';

const TABS: { value: SystemTab; label: string }[] = [
  { value: 'uebersicht', label: 'Übersicht' },
  { value: 'zugriffe', label: 'Zugriffe' },
  { value: 'anmeldungen', label: 'Anmeldungen' },
];

type AccessFilter = 'alle' | 'eingeschraenkt';

const ACCESS_FILTERS: { value: AccessFilter; label: string }[] = [
  { value: 'alle', label: 'Alle' },
  { value: 'eingeschraenkt', label: 'Eingeschränkt' },
];

// Typen erweitert
type UserStatus = {
  id: string;
  email: string;
  role: string;
  domain: string | null;
  maintenance_mode: boolean;
  ki_tool_enabled?: boolean;
  data_max_enabled?: boolean; // NEU: DataMax Status
};

export default function SystemHealthPage() {
  const [status, setStatus] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSchedulingRefresh, setIsSchedulingRefresh] = useState(false);
  const [cacheNotice, setCacheNotice] = useState<string | null>(null);
  const [tab, setTab] = useState<SystemTab>('uebersicht');
  const [searchTerm, setSearchTerm] = useState('');
  const [accessFilter, setAccessFilter] = useState<AccessFilter>('alle');
  
  // --- WARTUNGSMODUS STATE ---
  const [maintenanceUsers, setMaintenanceUsers] = useState<UserStatus[]>([]);
  const [maintenanceCount, setMaintenanceCount] = useState(0);
  const [isLoadingMaintenance, setIsLoadingMaintenance] = useState(false);
  const [togglingMaintId, setTogglingMaintId] = useState<string | null>(null);

  // --- KI-TOOL STATE ---
  const [kiToolUsers, setKiToolUsers] = useState<UserStatus[]>([]);
  const [kiToolDisabledCount, setKiToolDisabledCount] = useState(0);
  const [isLoadingKiTool, setIsLoadingKiTool] = useState(false);
  const [togglingKiId, setTogglingKiId] = useState<string | null>(null);

  // --- DATAMAX CHAT STATE (NEU) ---
  const [dataMaxUsers, setDataMaxUsers] = useState<UserStatus[]>([]);
  const [dataMaxDisabledCount, setDataMaxDisabledCount] = useState(0);
  const [isLoadingDataMax, setIsLoadingDataMax] = useState(false);
  const [togglingDataMaxId, setTogglingDataMaxId] = useState<string | null>(null);

  // --- FETCHERS ---
  // quiet: ohne Ladeansicht nachladen, z. B. nach dem Speichern des KI-Modells.
  const fetchStatus = async (quiet = false) => {
    if (!quiet) setIsLoading(true);
    try {
      const res = await fetch('/api/admin/system-status');
      if (res.ok) setStatus(await res.json());
    } catch (e) { console.error(e); } finally { if (!quiet) setIsLoading(false); }
  };

  const fetchMaintenanceStatus = useCallback(async () => {
    setIsLoadingMaintenance(true);
    try {
      const res = await fetch('/api/admin/maintenance');
      const data = await res.json();
      setMaintenanceUsers(data.users || []);
      setMaintenanceCount(data.count || 0);
    } catch (e) { console.error(e); } finally { setIsLoadingMaintenance(false); }
  }, []);

  const fetchKiToolStatus = useCallback(async () => {
    setIsLoadingKiTool(true);
    try {
      const res = await fetch('/api/admin/ki-tool-settings');
      const data = await res.json();
      setKiToolUsers(data.users || []);
      setKiToolDisabledCount(data.disabledCount || 0);
    } catch (e) { console.error(e); } finally { setIsLoadingKiTool(false); }
  }, []);

  // NEU: DataMax Fetcher
  const fetchDataMaxStatus = useCallback(async () => {
    setIsLoadingDataMax(true);
    try {
      const res = await fetch('/api/admin/datamax-settings');
      const data = await res.json();
      setDataMaxUsers(data.users || []);
      setDataMaxDisabledCount(data.disabledCount || 0);
    } catch (e) { console.error(e); } finally { setIsLoadingDataMax(false); }
  }, []);

  useEffect(() => {
    fetchStatus();
    fetchMaintenanceStatus();
    fetchKiToolStatus();
    fetchDataMaxStatus();
  }, [fetchMaintenanceStatus, fetchKiToolStatus, fetchDataMaxStatus]);

  // --- ACTIONS ---

  const toggleMaintenance = async (userId: string, currentMode: boolean) => {
    const shouldActivate = !currentMode;
    if (shouldActivate && !confirm('Benutzer wirklich sperren (Wartungsmodus)?')) return;
    setTogglingMaintId(userId);
    try {
      const res = await fetch('/api/admin/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, isActive: shouldActivate })
      });
      if (res.ok) await fetchMaintenanceStatus();
      else toast.error((await res.json()).message || 'Fehler');
    } catch { toast.error('Verbindungsfehler'); } finally { setTogglingMaintId(null); }
  };

  const toggleKiTool = async (userId: string, currentEnabled: boolean) => {
    const user = kiToolUsers.find(u => u.id === userId);
    if (user?.role === 'SUPERADMIN') return toast('Superadmins können nicht gesperrt werden.');
    const newState = currentEnabled === false ? true : false; 
    setTogglingKiId(userId);
    try {
      const res = await fetch('/api/admin/ki-tool-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, isEnabled: newState })
      });
      if (res.ok) await fetchKiToolStatus();
      else toast.error((await res.json()).message || 'Fehler');
    } catch { toast.error('Verbindungsfehler'); } finally { setTogglingKiId(null); }
  };

  // NEU: DataMax Toggle
  const toggleDataMax = async (userId: string, currentEnabled?: boolean) => {
    const user = dataMaxUsers.find(u => u.id === userId);
    if (user?.role === 'SUPERADMIN') return toast('Superadmins können nicht gesperrt werden.');
    // Default ist true (wenn undefined). Also togglen wir basierend darauf.
    const isCurrentlyEnabled = currentEnabled !== false;
    const newState = !isCurrentlyEnabled;

    setTogglingDataMaxId(userId);
    try {
      const res = await fetch('/api/admin/datamax-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, isEnabled: newState })
      });
      if (res.ok) await fetchDataMaxStatus();
      else toast.error((await res.json()).message || 'Fehler');
    } catch { toast.error('Verbindungsfehler'); } finally { setTogglingDataMaxId(null); }
  };

  // NEU: Alle KI-Tool sperren (außer SUPERADMIN)
  const bulkDisableKiTool = async () => {
    const nonSuperadmins = kiToolUsers.filter(u => u.role !== 'SUPERADMIN' && u.ki_tool_enabled !== false);
    if (nonSuperadmins.length === 0) return toast('Keine User zum Sperren vorhanden.');
    if (!confirm(`KI-Tool für ${nonSuperadmins.length} User deaktivieren? (Superadmins ausgenommen)`)) return;
    // Optimistisches Update
    setKiToolUsers(prev => prev.map(u => u.role === 'SUPERADMIN' ? u : { ...u, ki_tool_enabled: false }));
    setKiToolDisabledCount(kiToolUsers.filter(u => u.role !== 'SUPERADMIN').length);
    try {
      const res = await fetch('/api/admin/ki-tool-settings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bulkDisable: true })
      });
      if (!res.ok) throw new Error('Fehler');
      await fetchKiToolStatus();
    } catch { toast.error('Fehler beim Sperren'); await fetchKiToolStatus(); }
  };

  // NEU: Alle KI-Tool freigeben
  const bulkEnableKiTool = async () => {
    const disabled = kiToolUsers.filter(u => u.ki_tool_enabled === false);
    if (disabled.length === 0) return toast('Alle User haben bereits Zugriff.');
    if (!confirm(`KI-Tool für ${disabled.length} User wieder aktivieren?`)) return;
    setKiToolUsers(prev => prev.map(u => ({ ...u, ki_tool_enabled: true })));
    setKiToolDisabledCount(0);
    try {
      const res = await fetch('/api/admin/ki-tool-settings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bulkEnable: true })
      });
      if (!res.ok) throw new Error('Fehler');
      await fetchKiToolStatus();
    } catch { toast.error('Fehler beim Freigeben'); await fetchKiToolStatus(); }
  };

  // NEU: Alle DataMax sperren (außer SUPERADMIN)
  const bulkDisableDataMax = async () => {
    const nonSuperadmins = dataMaxUsers.filter(u => u.role !== 'SUPERADMIN' && u.data_max_enabled !== false);
    if (nonSuperadmins.length === 0) return toast('Keine User zum Sperren vorhanden.');
    if (!confirm(`DataMax Chat für ${nonSuperadmins.length} User deaktivieren? (Superadmins ausgenommen)`)) return;
    setDataMaxUsers(prev => prev.map(u => u.role === 'SUPERADMIN' ? u : { ...u, data_max_enabled: false }));
    setDataMaxDisabledCount(dataMaxUsers.filter(u => u.role !== 'SUPERADMIN').length);
    try {
      const res = await fetch('/api/admin/datamax-settings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bulkDisable: true })
      });
      if (!res.ok) throw new Error('Fehler');
      await fetchDataMaxStatus();
    } catch { toast.error('Fehler beim Sperren'); await fetchDataMaxStatus(); }
  };

  // NEU: Alle DataMax freigeben
  const bulkEnableDataMax = async () => {
    const disabled = dataMaxUsers.filter(u => u.data_max_enabled === false);
    if (disabled.length === 0) return toast('Alle User haben bereits Zugriff.');
    if (!confirm(`DataMax Chat für ${disabled.length} User wieder aktivieren?`)) return;
    setDataMaxUsers(prev => prev.map(u => ({ ...u, data_max_enabled: true })));
    setDataMaxDisabledCount(0);
    try {
      const res = await fetch('/api/admin/datamax-settings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bulkEnable: true })
      });
      if (!res.ok) throw new Error('Fehler');
      await fetchDataMaxStatus();
    } catch { toast.error('Fehler beim Freigeben'); await fetchDataMaxStatus(); }
  };

  const handleScheduleRefresh = async () => {
    if (!confirm('Alle gespeicherten Dashboard-Daten zur Aktualisierung vormerken? Bis zum erfolgreichen Abruf bleiben die bisherigen Daten sichtbar.')) return;
    setIsSchedulingRefresh(true);
    setCacheNotice(null);
    try {
      const response = await fetch('/api/clear-cache', { method: 'POST', body: JSON.stringify({}) });
      if (!response.ok) throw new Error('Aktualisierung konnte nicht vorgemerkt werden.');
      const result = await response.json();
      setCacheNotice(`${result.rowsMarkedStale ?? 0} Einträge zur Aktualisierung vorgemerkt.`);
    } catch (error) {
      setCacheNotice(error instanceof Error ? error.message : 'Aktualisierung fehlgeschlagen.');
    } finally { setIsSchedulingRefresh(false); }
  };

  // --- ZUGRIFFE: eine Liste aus den drei Quellen ---
  const accessUsers = useMemo(() => {
    const byId = new Map<string, UserStatus>();
    for (const list of [maintenanceUsers, kiToolUsers, dataMaxUsers]) {
      for (const user of list) byId.set(user.id, { ...byId.get(user.id), ...user });
    }
    for (const user of kiToolUsers) {
      const merged = byId.get(user.id);
      if (merged) merged.ki_tool_enabled = user.ki_tool_enabled;
    }
    for (const user of dataMaxUsers) {
      const merged = byId.get(user.id);
      if (merged) merged.data_max_enabled = user.data_max_enabled;
    }
    for (const user of maintenanceUsers) {
      const merged = byId.get(user.id);
      if (merged) merged.maintenance_mode = user.maintenance_mode;
    }
    return Array.from(byId.values()).sort((a, b) => a.email.localeCompare(b.email));
  }, [maintenanceUsers, kiToolUsers, dataMaxUsers]);

  const isRestricted = (user: UserStatus) =>
    Boolean(user.maintenance_mode) || user.ki_tool_enabled === false || user.data_max_enabled === false;

  const filteredUsers = accessUsers.filter((user) => {
    const term = searchTerm.toLowerCase();
    const matches = user.email.toLowerCase().includes(term) || (user.domain && user.domain.toLowerCase().includes(term));
    return matches && (accessFilter === 'alle' || isRestricted(user));
  });

  const isLoadingAccess = isLoadingMaintenance || isLoadingKiTool || isLoadingDataMax;
  const refreshAccess = () => {
    fetchMaintenanceStatus();
    fetchKiToolStatus();
    fetchDataMaxStatus();
  };

  if (isLoading) {
    return (
      <PageContainer>
        <PageHeader title="System" subtitle="Dienste, Zugriffe und Anmeldungen" />
        <PageSpinner label="System-Status wird geladen" />
      </PageContainer>
    );
  }
  if (!status) {
    return (
      <PageContainer>
        <PageHeader title="System" subtitle="Dienste, Zugriffe und Anmeldungen" />
        <p className="text-[14px] text-danger" role="alert">Fehler beim Laden.</p>
      </PageContainer>
    );
  }

  const services: { label: string; data?: { status?: string; message?: string }; detail?: string }[] = [
    { label: 'Datenbank', data: status.database },
    { label: 'Google Auth', data: status.google },
    {
      label: 'KI Modell',
      data: status.aiModel,
      detail: [
        status.aiModel?.activeModel && `Aktiv: ${status.aiModel.activeModel}`,
        status.aiModel?.fallbackModel && `Fallback: ${status.aiModel.fallbackModel}`,
        typeof status.aiModel?.latency === 'number' && `${status.aiModel.latency} ms`,
      ].filter(Boolean).join(' · '),
    },
    { label: 'Semrush API', data: status.semrush },
    { label: 'GSC API', data: status.gscApi },
  ];
  const servicesWithIssues = services.filter(({ data }) => data?.status === 'error' || data?.status === 'warning').length;

  return (
    <PageContainer>
      <PageHeader title="System" subtitle="Dienste, Zugriffe und Anmeldungen">
        <SegmentedControl label="Bereich" options={TABS} value={tab} onChange={setTab} />
      </PageHeader>

      {tab === 'uebersicht' && (
        <div className="space-y-[22px]">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricTile
              label="Dienste"
              value={servicesWithIssues === 0 ? 'OK' : servicesWithIssues}
              hint={servicesWithIssues === 0 ? 'Alle verbunden' : 'mit Warnung oder Fehler'}
            />
            <MetricTile label="Gesperrt" value={maintenanceCount} hint="Wartungsmodus" />
            <MetricTile label="Ohne KI-Tool" value={kiToolDisabledCount} hint="Benutzer" />
            <MetricTile label="Ohne DataMax" value={dataMaxDisabledCount} hint="Benutzer" />
          </div>

          <GroupedSection title="Dienste">
            {services.map(({ label, data, detail }) => {
              const state = serviceStatus(data?.status);
              return (
                <GroupedRow
                  key={label}
                  label={label}
                  description={[data?.message || 'Prüfe …', detail].filter(Boolean).join(' · ')}
                >
                  <StatusDot tone={state.tone}>{state.label}</StatusDot>
                </GroupedRow>
              );
            })}
          </GroupedSection>

          <AiModelSettings
            primary={status.aiModel?.primaryModel || status.aiModel?.activeModel || ''}
            fallback={status.aiModel?.fallbackModel || ''}
            onSaved={() => fetchStatus(true)}
          />

          <GroupedSection title="Dashboard-Daten" help={cacheNotice ? <span role="status">{cacheNotice}</span> : 'Gespeicherte Abrufe aus Google und Semrush.'}>
            <GroupedRow label="Gespeicherte Einträge" description="Bis zur neuen Abfrage bleiben die bisherigen Daten sichtbar.">
              <span className="font-semibold tabular-nums text-heading">{status.cache.count}</span>
              <Button variant="plain" size="sm" onClick={handleScheduleRefresh} disabled={isSchedulingRefresh}>
                {isSchedulingRefresh ? <Spinner size={14} className="" /> : <ArrowRepeat size={14} aria-hidden="true" />}
                Aktualisierung vormerken
              </Button>
            </GroupedRow>
          </GroupedSection>
        </div>
      )}

      {tab === 'zugriffe' && (
        <div className="space-y-[22px]">
          <div className="flex flex-wrap items-center gap-2.5">
            <SegmentedControl label="Benutzer filtern" options={ACCESS_FILTERS} value={accessFilter} onChange={setAccessFilter} />
            <SearchField label="Benutzer durchsuchen" placeholder="E-Mail oder Domain" value={searchTerm} onChange={setSearchTerm} />
            <Button variant="plain" size="sm" onClick={refreshAccess} disabled={isLoadingAccess} className="ml-auto">
              {isLoadingAccess ? <Spinner size={14} className="" /> : <ArrowRepeat size={14} aria-hidden="true" />}
              Aktualisieren
            </Button>
          </div>

          <DataList label="Zugriffe" minWidth={720}>
            <DataListHead>
              <Th>Benutzer</Th>
              <Th>Rolle</Th>
              <Th className="text-center">Zugang</Th>
              <Th className="text-center">KI-Tool</Th>
              <Th className="text-center">DataMax</Th>
            </DataListHead>
            <tbody aria-busy={isLoadingAccess}>
              {filteredUsers.length === 0 && <EmptyRow colSpan={5}>Keine Benutzer gefunden</EmptyRow>}
              {filteredUsers.map((user) => {
                const isSuperadmin = user.role === 'SUPERADMIN';
                return (
                  <Tr key={user.id}>
                    <Td><PrimaryCell icon={<PersonCircle size={16} />} title={user.email} subtitle={user.domain || undefined} /></Td>
                    <Td><StatusPill>{roleLabel(user.role)}</StatusPill></Td>
                    <Td className="text-center">
                      <Toggle
                        checked={!user.maintenance_mode}
                        onChange={() => toggleMaintenance(user.id, Boolean(user.maintenance_mode))}
                        label={`Zugang für ${user.email}`}
                        disabled={togglingMaintId === user.id}
                      />
                    </Td>
                    <Td className="text-center">
                      <Toggle
                        checked={isSuperadmin || user.ki_tool_enabled !== false}
                        onChange={() => toggleKiTool(user.id, user.ki_tool_enabled !== false)}
                        label={isSuperadmin ? `KI-Tool für ${user.email} (geschützt)` : `KI-Tool für ${user.email}`}
                        disabled={togglingKiId === user.id || isSuperadmin}
                      />
                    </Td>
                    <Td className="text-center">
                      <Toggle
                        checked={isSuperadmin || user.data_max_enabled !== false}
                        onChange={() => toggleDataMax(user.id, user.data_max_enabled)}
                        label={isSuperadmin ? `DataMax für ${user.email} (geschützt)` : `DataMax für ${user.email}`}
                        disabled={togglingDataMaxId === user.id || isSuperadmin}
                      />
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </DataList>

          <GroupedSection title="Für alle Benutzer" help="Superadmins sind ausgenommen.">
            <GroupedRow label="KI-Tool" description={kiToolDisabledCount > 0 ? `${kiToolDisabledCount} ohne Zugriff` : 'Alle haben Zugriff'}>
              <Button variant="plain" size="sm" onClick={bulkEnableKiTool} disabled={isLoadingKiTool}>Alle freigeben</Button>
              <Button variant="destructive" size="sm" onClick={bulkDisableKiTool} disabled={isLoadingKiTool}>Alle sperren</Button>
            </GroupedRow>
            <GroupedRow label="DataMax Chat" description={dataMaxDisabledCount > 0 ? `${dataMaxDisabledCount} ohne Zugriff` : 'Alle haben Zugriff'}>
              <Button variant="plain" size="sm" onClick={bulkEnableDataMax} disabled={isLoadingDataMax}>Alle freigeben</Button>
              <Button variant="destructive" size="sm" onClick={bulkDisableDataMax} disabled={isLoadingDataMax}>Alle sperren</Button>
            </GroupedRow>
          </GroupedSection>
        </div>
      )}

      {tab === 'anmeldungen' && <LoginLogbook />}
    </PageContainer>
  );
}
