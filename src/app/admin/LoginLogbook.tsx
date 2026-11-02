// src/app/admin/LoginLogbook.tsx
'use client';

import useSWR from 'swr';
import { useState, useMemo } from 'react';
import { PersonCircle } from 'react-bootstrap-icons';
import { roleLabel } from '@/lib/ui-labels';
import { SectionTitle } from '@/components/ui/Page';
import { SearchField } from '@/components/ui/SearchField';
import { DataList, DataListHead, EmptyRow, PrimaryCell, Td, Th, Tr } from '@/components/ui/DataList';
import { StatusPill } from '@/components/ui/Status';

// Interface für die Log-Daten
interface LoginLogEntry {
  id: number;
  user_email: string | null;
  user_role: 'BENUTZER' | 'ADMIN' | 'SUPERADMIN' | null;
  timestamp: string;
}

// Standard-Fetcher-Funktion für SWR
const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function LoginLogbook() {
  // SWR-Hook zum Abrufen der Daten vom neuen API-Endpunkt
  const { data: logs, error, isLoading } = useSWR<LoginLogEntry[]>(
    '/api/admin/login-logs', // Der neue Endpunkt
    fetcher,
    { refreshInterval: 60000 } // Alle 60 Sekunden nach neuen Logs suchen
  );

  const [searchTerm, setSearchTerm] = useState('');

  const filteredLogs = useMemo(() => {
    if (!logs) return [];
    if (!searchTerm.trim()) return logs;
    const term = searchTerm.toLowerCase();
    return logs.filter(log =>
      (log.user_email && log.user_email.toLowerCase().includes(term)) ||
      (log.user_role && log.user_role.toLowerCase().includes(term))
    );
  }, [logs, searchTerm]);

  // Formatiert den Zeitstempel
  const formatTimestamp = (ts: string) => {
    return new Date(ts).toLocaleString('de-AT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <section className="min-w-0">
      <SectionTitle
        title="Login-Protokoll"
        actions={<SearchField label="Login-Protokoll durchsuchen" placeholder="E-Mail oder Rolle" value={searchTerm} onChange={setSearchTerm} />}
      />
      <DataList label="Login-Protokoll" minWidth={520} className="max-h-[420px] overflow-y-auto">
        <DataListHead>
          <Th>Benutzer</Th>
          <Th>Rolle</Th>
          <Th className="text-right">Zeitpunkt</Th>
        </DataListHead>
        <tbody>
          {isLoading && <EmptyRow colSpan={3}>Login-Protokoll wird geladen …</EmptyRow>}
          {error && <EmptyRow colSpan={3}><span className="text-danger">Fehler beim Laden der Logs.</span></EmptyRow>}
          {!isLoading && !error && filteredLogs.length === 0 && (
            <EmptyRow colSpan={3}>{searchTerm ? 'Keine Ergebnisse gefunden' : 'Bisher keine Login-Ereignisse protokolliert'}</EmptyRow>
          )}
          {filteredLogs.map((log) => (
            <Tr key={log.id}>
              <Td><PrimaryCell icon={<PersonCircle size={16} />} title={log.user_email || 'Unbekannt'} /></Td>
              <Td><StatusPill>{log.user_role ? roleLabel(log.user_role) : 'Unbekannt'}</StatusPill></Td>
              <Td className="text-right text-muted tabular-nums">{formatTimestamp(log.timestamp)}</Td>
            </Tr>
          ))}
        </tbody>
      </DataList>
    </section>
  );
}
