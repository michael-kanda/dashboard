// src/app/admin/LogoManager.tsx
'use client';

import { useState, FormEvent } from 'react';
import useSWR, { mutate } from 'swr';
import { ArrowRepeat, Trash } from 'react-bootstrap-icons';
import { GroupedSection } from '@/components/ui/GroupedList';
import { Button, IconButton } from '@/components/ui/Button';
import { Field, inputClasses } from '@/components/ui/Field';

interface MandantLogo {
  mandant_id: string;
  logo_url: string;
  updated_at: string;
}

const fetcher = (url: string) => fetch(url).then(res => {
  if (!res.ok) throw new Error('Daten konnten nicht geladen werden');
  return res.json();
});

export default function LogoManager() {
  const { data: logos, error, isLoading } = useSWR<MandantLogo[]>('/api/admin/logos', fetcher);

  const [mandantId, setMandantId] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage({ type: '', text: '' });

    try {
      const response = await fetch('/api/admin/logos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mandant_id: mandantId, logo_url: logoUrl }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Speichern fehlgeschlagen');
      }

      setMessage({ type: 'success', text: 'Logo erfolgreich gespeichert!' });
      setMandantId('');
      setLogoUrl('');
      mutate('/api/admin/logos'); // SWR-Cache neu laden
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (mandant_id: string) => {
    if (!window.confirm(`Möchten Sie das Logo für "${mandant_id}" wirklich löschen?`)) {
      return;
    }
    
    setMessage({ type: '', text: '' });
    try {
      const response = await fetch('/api/admin/logos', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mandant_id }),
      });
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || 'Löschen fehlgeschlagen');
      }

      setMessage({ type: 'success', text: 'Logo erfolgreich gelöscht!' });
      mutate('/api/admin/logos');
    } catch (err) {
       setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten' });
    }
  };

  return (
    <div className="flex flex-col gap-[22px]">
      <GroupedSection title="Mandanten-Logos" help="Logo je Label für Sidebar und Berichte">
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 px-[18px] py-4">
          <Field label="Mandant-ID (Label)" htmlFor="logo-mandant">
            <input
              id="logo-mandant"
              type="text"
              value={mandantId}
              onChange={(e) => setMandantId(e.target.value)}
              placeholder="z. B. max-online"
              required
              className={inputClasses}
            />
          </Field>
          <Field label="Logo-URL (https://…)" htmlFor="logo-url">
            <input
              id="logo-url"
              type="url"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://beispiel.com/logo.png"
              required
              className={inputClasses}
            />
          </Field>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <ArrowRepeat className="animate-spin" size={14} aria-hidden="true" />}
              {isSubmitting ? 'Wird gespeichert …' : 'Logo speichern'}
            </Button>
            {message.text && (
              <p role="status" className={`text-[13px] ${message.type === 'error' ? 'text-danger' : 'text-success'}`}>
                {message.text}
              </p>
            )}
          </div>
        </form>
      </GroupedSection>

      <GroupedSection title="Vorhandene Logos">
        <div className="max-h-96 overflow-y-auto">
          {isLoading && <p className="px-[18px] py-3 text-[14px] text-muted">Logos werden geladen …</p>}
          {error && <p className="px-[18px] py-3 text-[14px] text-danger">Fehler beim Laden der Logos.</p>}
          {logos && logos.length === 0 && <p className="px-[18px] py-3 text-[14px] text-muted">Keine Logos konfiguriert.</p>}
          {logos?.map(logo => (
            <div key={logo.mandant_id} className="flex min-h-11 items-center justify-between gap-3 border-b border-border-subtle px-[18px] py-2.5 last:border-b-0">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold text-heading">{logo.mandant_id}</p>
                <a href={logo.logo_url} target="_blank" rel="noopener noreferrer" className="block truncate text-[13px] text-accent hover:underline">
                  {logo.logo_url}
                </a>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logo.logo_url} alt={logo.mandant_id} className="h-8 w-auto rounded-md bg-surface-secondary object-contain" />
              <IconButton label={`Logo für ${logo.mandant_id} löschen`} onClick={() => handleDelete(logo.mandant_id)} className="text-danger hover:text-danger">
                <Trash size={16} aria-hidden="true" />
              </IconButton>
            </div>
          ))}
        </div>
      </GroupedSection>
    </div>
  );
}
