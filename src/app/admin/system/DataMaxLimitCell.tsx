'use client';

// Eigenes DataMax-Tageslimit für einen Benutzer bzw. ein Projekt.
// Leer = Standard nach Rolle; gespeichert wird beim Verlassen des Feldes oder mit Enter.
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { DATAMAX_DAILY_LIMITS, DATAMAX_LIMIT_RANGE } from '@/lib/datamax-quota-limits';

interface DataMaxLimitCellProps {
  userId: string;
  email: string;
  role: string;
  value: number | null | undefined;
  onSaved: (userId: string, dailyLimit: number | null) => void;
}

export default function DataMaxLimitCell({ userId, email, role, value, onSaved }: DataMaxLimitCellProps) {
  const [draft, setDraft] = useState(value ? String(value) : '');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setDraft(value ? String(value) : '');
  }, [value]);

  if (role === 'SUPERADMIN') {
    return <span className="text-[13px] text-muted">unbegrenzt</span>;
  }

  const fallback = role === 'ADMIN' ? DATAMAX_DAILY_LIMITS.ADMIN : DATAMAX_DAILY_LIMITS.BENUTZER;

  const save = async () => {
    const trimmed = draft.trim();
    const next = trimmed === '' ? null : Number(trimmed);
    if ((value ?? null) === next) return;
    if (next !== null && (!Number.isInteger(next) || next < DATAMAX_LIMIT_RANGE.min || next > DATAMAX_LIMIT_RANGE.max)) {
      toast.error(`Bitte eine ganze Zahl von ${DATAMAX_LIMIT_RANGE.min} bis ${DATAMAX_LIMIT_RANGE.max} eingeben oder leer lassen.`);
      setDraft(value ? String(value) : '');
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch('/api/admin/datamax-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, dailyLimit: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Speichern fehlgeschlagen');
      onSaved(userId, next);
      toast.success(next === null ? `${email}: Standard (${fallback} pro Tag)` : `${email}: ${next} Fragen pro Tag`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Speichern fehlgeschlagen');
      setDraft(value ? String(value) : '');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <input
      type="number"
      inputMode="numeric"
      min={DATAMAX_LIMIT_RANGE.min}
      max={DATAMAX_LIMIT_RANGE.max}
      value={draft}
      placeholder={String(fallback)}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => void save()}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur();
        if (event.key === 'Escape') {
          setDraft(value ? String(value) : '');
          event.currentTarget.blur();
        }
      }}
      disabled={isSaving}
      aria-label={`DataMax-Fragen pro Tag für ${email}, leer lassen für Standard ${fallback}`}
      title={`Leer lassen für den Standard (${fallback})`}
      className="dp-field mx-auto h-8 w-20 px-2 text-center text-[13px] tabular-nums"
    />
  );
}
