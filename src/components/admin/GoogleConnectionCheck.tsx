'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowRepeat } from 'react-bootstrap-icons';
import { Spinner } from '@/components/ui/Spinner';
import { StatusDot } from '@/components/ui/Status';

type Result = { ok: boolean; message: string } | null;

// Prüft GSC-Property und GA4-Property kurz nach der Eingabe live gegen Google.
export default function GoogleConnectionCheck({ gscSiteUrl, ga4PropertyId }: { gscSiteUrl: string; ga4PropertyId: string }) {
  const [results, setResults] = useState<{ gsc: Result; ga4: Result }>({ gsc: null, ga4: null });
  const [isChecking, setIsChecking] = useState(false);
  const requestId = useRef(0);

  const gsc = gscSiteUrl.trim();
  const ga4 = ga4PropertyId.trim();

  const check = async () => {
    if (!gsc && !ga4) {
      setResults({ gsc: null, ga4: null });
      return;
    }
    const id = ++requestId.current;
    setIsChecking(true);
    try {
      const res = await fetch('/api/admin/check-google-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gscSiteUrl: gsc, ga4PropertyId: ga4 }),
      });
      const data = await res.json().catch(() => ({}));
      if (id !== requestId.current) return;
      if (!res.ok) throw new Error(data.message || 'Prüfung nicht möglich');
      setResults({ gsc: data.gsc ?? null, ga4: data.ga4 ?? null });
    } catch (error) {
      if (id !== requestId.current) return;
      const message = error instanceof Error ? error.message : 'Prüfung nicht möglich';
      setResults({ gsc: gsc ? { ok: false, message } : null, ga4: ga4 ? { ok: false, message } : null });
    } finally {
      if (id === requestId.current) setIsChecking(false);
    }
  };

  // Nach kurzer Tipp-Pause automatisch prüfen, auch beim Öffnen eines bestehenden Projekts.
  useEffect(() => {
    const timer = setTimeout(check, 900);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gsc, ga4]);

  if (!gsc && !ga4) return null;

  const row = (label: string, result: Result, hasValue: boolean) => {
    if (!hasValue) return null;
    return (
      <li className="flex items-start gap-2 text-[13px]">
        <span className="w-[112px] flex-shrink-0 whitespace-nowrap font-semibold text-muted">{label}</span>
        {isChecking || !result ? (
          <span className="inline-flex items-center gap-2 text-muted"><Spinner size={13} />Wird geprüft …</span>
        ) : (
          <StatusDot tone={result.ok ? 'success' : 'danger'}>{result.message}</StatusDot>
        )}
      </li>
    );
  };

  return (
    <div className="rounded-control border border-border bg-surface-secondary px-3 py-2.5" aria-live="polite">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-[13px] font-semibold text-heading">Live-Check der Datenquellen</span>
        <button type="button" onClick={check} disabled={isChecking} className="inline-flex items-center gap-1 text-[13px] font-medium text-accent hover:underline disabled:opacity-50">
          <ArrowRepeat size={12} aria-hidden="true" />
          Erneut prüfen
        </button>
      </div>
      <ul className="space-y-1">
        {row('Search Console', results.gsc, Boolean(gsc))}
        {row('GA4', results.ga4, Boolean(ga4))}
      </ul>
    </div>
  );
}
