// src/components/UserLogbook.tsx
'use client';

import useSWR from 'swr';
import { ClockHistory, PersonCircle, Link45deg } from 'react-bootstrap-icons';

// Dieses Interface beschreibt einen Log-Eintrag, wie er von der API kommt
interface UserLogEntry {
    id: number;
    user_email: string | null; // Wer hat die Aktion ausgeführt
    action: string;
    timestamp: string;
    landingpage_url: string; // Die URL der betroffenen Landingpage
}

// Standard-Fetcher-Funktion für SWR
const fetcher = (url: string) => fetch(url).then((res) => res.json());

// Props für unsere Komponente: Sie benötigt die ID des Benutzers
interface UserLogbookProps {
    userId: string; 
}

export default function UserLogbook({ userId }: UserLogbookProps) {
    // SWR-Hook zum Datenabruf. Er ruft die neue API-Route auf.
    const { data: logs, error, isLoading } = useSWR<UserLogEntry[]>(
        userId ? `/api/users/${userId}/logs` : null, // API-Aufruf mit der User-ID
        fetcher,
        { refreshInterval: 30000 } // Optional: Alle 30 Sek. nach neuen Logs suchen
    );

    // Formatiert den Zeitstempel in ein lesbares deutsches Format
    const formatTimestamp = (ts: string) => {
        return new Date(ts).toLocaleString('de-DE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    // Hilfsfunktion, um die URL zu kürzen (z.B. zeigt nur /unterseite/pfad)
    const formatUrl = (urlStr: string) => {
      try {
        const url = new URL(urlStr);
        return url.pathname;
      } catch (e) {
        return urlStr; // Fallback, falls die URL ungültig ist
      }
    }

    return (
        // Container für das Logbuch
        <div className="bg-surface p-8 rounded-lg">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-strong">
                <ClockHistory size={20} />
                Aktivitäts-Logbuch (Redaktionsplan)
            </h3>
            {/* Container mit Scrollbalken, falls die Liste lang wird */}
            <div className="border rounded-lg max-h-96 overflow-y-auto">
                {isLoading && <p className="p-4 text-sm text-muted">Lade Logs...</p>}
                {error && <p className="p-4 text-sm text-danger">Fehler beim Laden der Logs.</p>}
                {logs && logs.length === 0 && (
                    <p className="p-4 text-sm text-muted italic">
                        Für diesen Benutzer sind noch keine Log-Einträge vorhanden.
                    </p>
                )}
                {/* Wenn Logs vorhanden sind, zeige sie als Liste an */}
                {logs && logs.length > 0 && (
                    <ul className="divide-y divide-border-subtle">
                        {logs.map((log) => (
                            <li key={log.id} className="p-4 space-y-2">
                                {/* Die Aktion, z.B. "Status geändert..." */}
                                <p className="text-sm text-heading">{log.action}</p>
                                {/* Metadaten: Wer, Welche Seite, Wann */}
                                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-muted">
                                    <span className="flex items-center gap-1.5" title={log.user_email || 'System'}>
                                       <PersonCircle size={12}/> {log.user_email || 'System'}
                                    </span>
                                    <span className="flex items-center gap-1.5" title={log.landingpage_url}>
                                       <Link45deg size={14}/> {formatUrl(log.landingpage_url)}
                                    </span>
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
