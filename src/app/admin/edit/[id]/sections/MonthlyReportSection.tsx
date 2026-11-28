// src/app/admin/edit/[id]/sections/MonthlyReportSection.tsx
// Monatsbericht per E-Mail: Schalter (speichert sofort), Testversand an die eigene Adresse,
// letzte Versände. Eigene API (/api/projects/[id]/monthly-report), unabhängig vom Formular.
'use client';

import { useEffect, useState } from 'react';
import { Envelope } from 'react-bootstrap-icons';
import { Toggle } from '@/components/ui/Toggle';

interface Run { period: string; status: string; recipient_count: number }

const STATUS_LABEL: Record<string, string> = {
  sent: 'gesendet',
  no_data: 'keine Daten',
  no_recipients: 'alle Empfänger abgemeldet',
  failed: 'fehlgeschlagen',
};

export default function MonthlyReportSection({ projectId }: { projectId: string }) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    fetch(`/api/projects/${projectId}/monthly-report`)
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!active) return;
        if (!response.ok) { setMessage(body.message || 'Status nicht lesbar'); return; }
        setEnabled(body.enabled === true);
        setRuns(Array.isArray(body.runs) ? body.runs : []);
      })
      .catch(() => active && setMessage('Status nicht lesbar'));
    return () => { active = false; };
  }, [projectId]);

  const toggle = async (next: boolean) => {
    setBusy(true);
    setMessage('');
    const response = await fetch(`/api/projects/${projectId}/monthly-report`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: next }),
    }).catch(() => null);
    const body = await response?.json().catch(() => ({}));
    if (response?.ok) setEnabled(body.enabled === true);
    else setMessage(body?.message || 'Speichern fehlgeschlagen');
    setBusy(false);
  };

  const sendTest = async () => {
    setBusy(true);
    setMessage('');
    const response = await fetch(`/api/projects/${projectId}/monthly-report`, { method: 'POST' }).catch(() => null);
    const body = await response?.json().catch(() => ({}));
    setMessage(body?.message || (response?.ok ? 'Testbericht gesendet.' : 'Testversand fehlgeschlagen'));
    setBusy(false);
  };

  return (
    <fieldset className="mt-8">
      <legend className="dp-section-title">
        <Envelope className="text-muted" size={16} />
        Monatsbericht per E-Mail
      </legend>
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm text-muted">
          Am 1. jedes Monats gehen die wichtigsten Kennzahlen der letzten 30 Tage mit einer kurzen Erklärung von DataMax
          an die Login-Adresse des Projekts, die zugewiesenen Betreuer bekommen eine Kopie. Jeder Empfänger kann sich über
          den Link in der E-Mail abmelden.
        </p>
        <Toggle
          checked={enabled === true}
          onChange={toggle}
          label="Monatsbericht per E-Mail"
          disabled={busy || enabled === null}
        />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={sendTest}
          disabled={busy}
          className="rounded-control border border-border px-3 py-1.5 text-sm text-body hover:bg-surface-secondary disabled:opacity-50"
        >
          Testbericht an mich senden
        </button>
        {runs.length > 0 && (
          <span className="text-xs text-muted">
            Zuletzt: {runs.map((run) => `${run.period} ${STATUS_LABEL[run.status] ?? run.status}${run.status === 'sent' ? ` (${run.recipient_count})` : ''}`).join(' · ')}
          </span>
        )}
      </div>
      {message && <p className="mt-2 text-sm text-muted" role="status">{message}</p>}
    </fieldset>
  );
}
