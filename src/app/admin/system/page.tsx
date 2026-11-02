'use client';

import React, { useEffect, useState, useCallback, type ReactNode } from 'react';
import { ArrowRepeat, PersonCircle } from 'react-bootstrap-icons';
import LoginLogbook from '@/app/admin/LoginLogbook';
import { roleLabel } from '@/lib/ui-labels';
import { PageContainer, PageHeader, SectionTitle } from '@/components/ui/Page';
import { GroupedSection, GroupedRow } from '@/components/ui/GroupedList';
import { DataList, DataListHead, EmptyRow, ListSkeleton, PrimaryCell, Td, Th, Tr } from '@/components/ui/DataList';
import { SearchField } from '@/components/ui/SearchField';
import { Button } from '@/components/ui/Button';
import { StatusDot, StatusPill } from '@/components/ui/Status';
import { Toggle } from '@/components/ui/Toggle';

const SERVICE_STATUS: Record<string, { tone: 'success' | 'warning' | 'danger' | 'off'; label: string }> = {
  ok: { tone: 'success', label: 'Verbunden' },
  warning: { tone: 'warning', label: 'Warnung' },
  error: { tone: 'danger', label: 'Fehler' },
  pending: { tone: 'off', label: 'Wird geprüft' },
};

function serviceStatus(value?: string) {
  return SERVICE_STATUS[value || 'pending'] ?? SERVICE_STATUS.error;
}

// Abschnitt mit Nutzerliste und Schalter je Nutzer (Wartung, KI-Tool, DataMax).
function PermissionSection({
  title,
  statusLine,
  actions,
  search,
  onSearch,
  searchLabel,
  isLoading,
  children,
  footer,
}: {
  title: string;
  statusLine: string;
  actions: ReactNode;
  search: string;
  onSearch: (value: string) => void;
  searchLabel: string;
  isLoading: boolean;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section className="min-w-0">
      <SectionTitle title={title} help={statusLine} actions={actions} />
      <div className="mb-2.5">
        <SearchField label={searchLabel} placeholder="E-Mail oder Domain" value={search} onChange={onSearch} />
      </div>
      <DataList label={title} minWidth={480} className="max-h-72 overflow-y-auto">
        <DataListHead>
          <Th>Nutzer</Th>
          <Th>Rolle</Th>
          <Th className="text-right">Zugang</Th>
        </DataListHead>
        <tbody aria-busy={isLoading}>{children}</tbody>
      </DataList>
      {footer && <p className="mt-1.5 text-[12px] text-muted">{footer}</p>}
    </section>
  );
}

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
  
  // --- WARTUNGSMODUS STATE ---
  const [maintenanceUsers, setMaintenanceUsers] = useState<UserStatus[]>([]);
  const [maintenanceCount, setMaintenanceCount] = useState(0);
  const [isLoadingMaintenance, setIsLoadingMaintenance] = useState(false);
  const [togglingMaintId, setTogglingMaintId] = useState<string | null>(null);
  const [maintSearchTerm, setMaintSearchTerm] = useState('');

  // --- KI-TOOL STATE ---
  const [kiToolUsers, setKiToolUsers] = useState<UserStatus[]>([]);
  const [kiToolDisabledCount, setKiToolDisabledCount] = useState(0);
  const [isLoadingKiTool, setIsLoadingKiTool] = useState(false);
  const [togglingKiId, setTogglingKiId] = useState<string | null>(null);
  const [kiToolSearchTerm, setKiToolSearchTerm] = useState('');

  // --- DATAMAX CHAT STATE (NEU) ---
  const [dataMaxUsers, setDataMaxUsers] = useState<UserStatus[]>([]);
  const [dataMaxDisabledCount, setDataMaxDisabledCount] = useState(0);
  const [isLoadingDataMax, setIsLoadingDataMax] = useState(false);
  const [togglingDataMaxId, setTogglingDataMaxId] = useState<string | null>(null);
  const [dataMaxSearchTerm, setDataMaxSearchTerm] = useState('');

  // --- FETCHERS ---
  const fetchStatus = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/system-status');
      if (res.ok) setStatus(await res.json());
    } catch (e) { console.error(e); } finally { setIsLoading(false); }
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
      else alert((await res.json()).message || 'Fehler');
    } catch (e) { alert('Verbindungsfehler'); } finally { setTogglingMaintId(null); }
  };

  const toggleKiTool = async (userId: string, currentEnabled: boolean) => {
    const user = kiToolUsers.find(u => u.id === userId);
    if (user?.role === 'SUPERADMIN') return alert('Superadmins können nicht gesperrt werden.');
    const newState = currentEnabled === false ? true : false; 
    setTogglingKiId(userId);
    try {
      const res = await fetch('/api/admin/ki-tool-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, isEnabled: newState })
      });
      if (res.ok) await fetchKiToolStatus();
      else alert((await res.json()).message || 'Fehler');
    } catch (e) { alert('Verbindungsfehler'); } finally { setTogglingKiId(null); }
  };

  // NEU: DataMax Toggle
  const toggleDataMax = async (userId: string, currentEnabled?: boolean) => {
    const user = dataMaxUsers.find(u => u.id === userId);
    if (user?.role === 'SUPERADMIN') return alert('Superadmins können nicht gesperrt werden.');
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
      else alert((await res.json()).message || 'Fehler');
    } catch (e) { alert('Verbindungsfehler'); } finally { setTogglingDataMaxId(null); }
  };

  // NEU: Alle KI-Tool sperren (außer SUPERADMIN)
  const bulkDisableKiTool = async () => {
    const nonSuperadmins = kiToolUsers.filter(u => u.role !== 'SUPERADMIN' && u.ki_tool_enabled !== false);
    if (nonSuperadmins.length === 0) return alert('Keine User zum Sperren vorhanden.');
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
    } catch (e) { alert('Fehler beim Sperren'); await fetchKiToolStatus(); }
  };

  // NEU: Alle KI-Tool freigeben
  const bulkEnableKiTool = async () => {
    const disabled = kiToolUsers.filter(u => u.ki_tool_enabled === false);
    if (disabled.length === 0) return alert('Alle User haben bereits Zugriff.');
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
    } catch (e) { alert('Fehler beim Freigeben'); await fetchKiToolStatus(); }
  };

  // NEU: Alle DataMax sperren (außer SUPERADMIN)
  const bulkDisableDataMax = async () => {
    const nonSuperadmins = dataMaxUsers.filter(u => u.role !== 'SUPERADMIN' && u.data_max_enabled !== false);
    if (nonSuperadmins.length === 0) return alert('Keine User zum Sperren vorhanden.');
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
    } catch (e) { alert('Fehler beim Sperren'); await fetchDataMaxStatus(); }
  };

  // NEU: Alle DataMax freigeben
  const bulkEnableDataMax = async () => {
    const disabled = dataMaxUsers.filter(u => u.data_max_enabled === false);
    if (disabled.length === 0) return alert('Alle User haben bereits Zugriff.');
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
    } catch (e) { alert('Fehler beim Freigeben'); await fetchDataMaxStatus(); }
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

  // --- FILTERS ---
  const filteredKiUsers = kiToolUsers.filter(u => 
    u.email.toLowerCase().includes(kiToolSearchTerm.toLowerCase()) || 
    (u.domain && u.domain.toLowerCase().includes(kiToolSearchTerm.toLowerCase()))
  );

  const filteredMaintUsers = maintenanceUsers.filter(u => 
    u.email.toLowerCase().includes(maintSearchTerm.toLowerCase()) || 
    (u.domain && u.domain.toLowerCase().includes(maintSearchTerm.toLowerCase()))
  );

  const filteredDataMaxUsers = dataMaxUsers.filter(u => 
    u.email.toLowerCase().includes(dataMaxSearchTerm.toLowerCase()) || 
    (u.domain && u.domain.toLowerCase().includes(dataMaxSearchTerm.toLowerCase()))
  );

  const userCell = (user: UserStatus) => (
    <PrimaryCell icon={<PersonCircle size={16} />} title={user.email} subtitle={user.domain || undefined} />
  );

  const refreshButton = (onClick: () => void, loading: boolean) => (
    <Button variant="plain" size="sm" onClick={onClick} disabled={loading}>
      <ArrowRepeat className={loading ? 'animate-spin' : ''} size={14} aria-hidden="true" />
      Aktualisieren
    </Button>
  );

  const bulkActions = (onDisable: () => void, onEnable: () => void, loading: boolean, onRefresh: () => void) => (
    <>
      <span className="text-[12px] text-muted">Superadmins ausgenommen</span>
      <Button variant="destructive" size="sm" onClick={onDisable} disabled={loading}>Alle sperren</Button>
      <Button variant="plain" size="sm" onClick={onEnable} disabled={loading}>Alle freigeben</Button>
      {refreshButton(onRefresh, loading)}
    </>
  );

  const header = (
    <PageHeader title="System" subtitle="Dienste, Zugriffe und Systemfunktionen überwachen">
      {status?.aiModel && (
        <StatusPill>KI: {status.aiModel.activeModel || serviceStatus(status.aiModel.status).label}</StatusPill>
      )}
      {maintenanceCount > 0 && <StatusPill tone="danger">{maintenanceCount} gesperrt</StatusPill>}
    </PageHeader>
  );

  if (isLoading) {
    return (
      <PageContainer>
        {header}
        <ListSkeleton rows={5} label="System-Status wird geladen …" />
      </PageContainer>
    );
  }
  if (!status) {
    return (
      <PageContainer>
        {header}
        <p className="text-[13px] text-danger" role="alert">Fehler beim Laden.</p>
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

  return (
    <PageContainer>
      {header}

      <div className="grid grid-cols-1 gap-[22px] xl:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-[22px] xl:col-span-2">
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

          <PermissionSection
            title="Wartungsmodus & Zugangssperre"
            statusLine={maintenanceCount > 0 ? `${maintenanceCount} Benutzer gesperrt.` : 'Alle Benutzer haben freien Zugang.'}
            actions={refreshButton(fetchMaintenanceStatus, isLoadingMaintenance)}
            search={maintSearchTerm}
            onSearch={setMaintSearchTerm}
            searchLabel="Benutzer für Wartung durchsuchen"
            isLoading={isLoadingMaintenance}
          >
            {filteredMaintUsers.length === 0 && <EmptyRow colSpan={3}>Keine Benutzer gefunden</EmptyRow>}
            {filteredMaintUsers.map((user) => (
              <Tr key={user.id}>
                <Td>{userCell(user)}</Td>
                <Td>
                  <span className="flex flex-wrap items-center gap-1.5">
                    <StatusPill>{roleLabel(user.role)}</StatusPill>
                    {user.maintenance_mode && <StatusPill tone="danger">Gesperrt</StatusPill>}
                  </span>
                </Td>
                <Td className="text-right">
                  <Toggle
                    checked={!user.maintenance_mode}
                    onChange={() => toggleMaintenance(user.id, user.maintenance_mode)}
                    label={`Zugang für ${user.email}`}
                    disabled={togglingMaintId === user.id}
                  />
                </Td>
              </Tr>
            ))}
          </PermissionSection>

          <PermissionSection
            title="KI-Tool Berechtigung"
            statusLine={kiToolDisabledCount > 0 ? `${kiToolDisabledCount} User ohne KI-Tool.` : 'Alle User haben KI-Tool Zugriff.'}
            actions={bulkActions(bulkDisableKiTool, bulkEnableKiTool, isLoadingKiTool, fetchKiToolStatus)}
            search={kiToolSearchTerm}
            onSearch={setKiToolSearchTerm}
            searchLabel="Benutzer für KI-Tool durchsuchen"
            isLoading={isLoadingKiTool}
          >
            {filteredKiUsers.length === 0 && <EmptyRow colSpan={3}>Keine Benutzer gefunden</EmptyRow>}
            {filteredKiUsers.map((user) => (
              <Tr key={user.id}>
                <Td>{userCell(user)}</Td>
                <Td><StatusPill>{roleLabel(user.role)}</StatusPill></Td>
                <Td className="text-right">
                  <Toggle
                    checked={user.role === 'SUPERADMIN' || user.ki_tool_enabled !== false}
                    onChange={() => toggleKiTool(user.id, user.ki_tool_enabled !== false)}
                    label={user.role === 'SUPERADMIN' ? `KI-Tool für ${user.email} (geschützt)` : `KI-Tool für ${user.email}`}
                    disabled={togglingKiId === user.id || user.role === 'SUPERADMIN'}
                  />
                </Td>
              </Tr>
            ))}
          </PermissionSection>

          <PermissionSection
            title="DataMax Chat Berechtigung"
            statusLine={dataMaxDisabledCount > 0 ? `${dataMaxDisabledCount} User ohne Chat Zugriff.` : 'Alle User dürfen DataMax nutzen.'}
            actions={bulkActions(bulkDisableDataMax, bulkEnableDataMax, isLoadingDataMax, fetchDataMaxStatus)}
            search={dataMaxSearchTerm}
            onSearch={setDataMaxSearchTerm}
            searchLabel="Benutzer für DataMax durchsuchen"
            isLoading={isLoadingDataMax}
            footer="Standardmäßig haben alle User Zugriff."
          >
            {filteredDataMaxUsers.length === 0 && <EmptyRow colSpan={3}>Keine Benutzer gefunden</EmptyRow>}
            {filteredDataMaxUsers.map((user) => (
              <Tr key={user.id}>
                <Td>{userCell(user)}</Td>
                <Td><StatusPill>{roleLabel(user.role)}</StatusPill></Td>
                <Td className="text-right">
                  <Toggle
                    checked={user.role === 'SUPERADMIN' || user.data_max_enabled !== false}
                    onChange={() => toggleDataMax(user.id, user.data_max_enabled)}
                    label={user.role === 'SUPERADMIN' ? `DataMax für ${user.email} (geschützt)` : `DataMax für ${user.email}`}
                    disabled={togglingDataMaxId === user.id || user.role === 'SUPERADMIN'}
                  />
                </Td>
              </Tr>
            ))}
          </PermissionSection>

          <GroupedSection title="Cache Management" help={cacheNotice ? <span role="status">{cacheNotice}</span> : undefined}>
            <GroupedRow label="Einträge">
              <span className="font-semibold text-heading tabular-nums">{status.cache.count}</span>
              <Button variant="plain" size="sm" onClick={handleScheduleRefresh} disabled={isSchedulingRefresh}>
                <ArrowRepeat className={isSchedulingRefresh ? 'animate-spin' : undefined} size={14} aria-hidden="true" />
                Aktualisierung vormerken
              </Button>
            </GroupedRow>
          </GroupedSection>
        </div>

        <div className="min-w-0 xl:col-span-1">
          <LoginLogbook />
        </div>
      </div>
    </PageContainer>
  );
}
