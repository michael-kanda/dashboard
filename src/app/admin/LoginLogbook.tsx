// src/app/admin/LoginLogbook.tsx
'use client';

import useSWR from 'swr';
import { useState, useMemo } from 'react';
import { ClockHistory, PersonCircle, ShieldLock, Search } from 'react-bootstrap-icons';
import { cn } from '@/lib/utils'; // Importiere cn für bedingte Klassen

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
    return new Date(ts).toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Hilfsfunktion für Rollen-Styling
  const getRoleStyle = (role: LoginLogEntry['user_role']) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-blue-100 text-blue-800';
      case 'BENUTZER':
        return 'bg-green-100 text-green-800';
      case 'SUPERADMIN':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    // Container für das Logbuch
    <div className="bg-white p-6 rounded-lg shadow-md h-fit border border-gray-200 mt-8">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        <ShieldLock size={20} /> Login-Protokoll (Superadmin)
      </h2>
      
      {/* Suchfeld */}
      <div className="mb-3 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
        <input
          type="text"
          placeholder="E-Mail oder Rolle suchen..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* Container mit Scrollbalken */}
      <div className="border rounded-lg max-h-96 overflow-y-auto">
        {isLoading && <p className="p-4 text-sm text-gray-500">Lade Login-Logs...</p>}
        {error && <p className="p-4 text-sm text-red-600">Fehler beim Laden der Logs.</p>}
        {filteredLogs.length === 0 && !isLoading && !error && (
          <p className="p-4 text-sm text-gray-500 italic">
            {searchTerm ? 'Keine Ergebnisse gefunden.' : 'Bisher keine Login-Ereignisse protokolliert.'}
          </p>
        )}
        
        {/* Log-Liste */}
        {filteredLogs.length > 0 && (
          <ul className="divide-y divide-gray-200">
            {filteredLogs.map((log) => (
              <li key={log.id} className="p-3 space-y-2">
                {/* Benutzer und Rolle */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
                    <PersonCircle size={14} /> {log.user_email || 'Unbekannt'}
                  </span>
                  <span className={cn(
                    "text-xs font-semibold px-2 py-0.5 rounded-full",
                    getRoleStyle(log.user_role)
                  )}>
                    {log.user_role || 'N/A'}
                  </span>
                </div>
                {/* Zeitstempel */}
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <ClockHistory size={12} />
                  <span>{formatTimestamp(log.timestamp)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
