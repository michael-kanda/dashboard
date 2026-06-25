// src/app/admin/LogoManager.tsx
'use client';

import { useState, useEffect, FormEvent } from 'react';
import useSWR, { mutate } from 'swr';
import { Image as ImageIcon, Trash, Link45deg, ArrowRepeat, CheckCircle, ExclamationTriangleFill } from 'react-bootstrap-icons';

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
    <div className="admin-panel h-fit p-5">
      <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-heading">
        <ImageIcon size={18} className="text-blue-600" /> Mandanten-Logos
      </h2>
      
      {/* Formular zum Hinzufügen/Aktualisieren */}
      <form onSubmit={handleSubmit} className="space-y-4 mb-6 pb-6 border-b">
        <div>
          <label className="block text-sm font-medium text-gray-700">Mandant-ID (Label)</label>
          <input
            type="text"
            value={mandantId}
            onChange={(e) => setMandantId(e.target.value)}
            placeholder="z.B. max-online"
            required
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Logo-URL (https://...)</label>
          <input
            type="url"
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            placeholder="https://beispiel.com/logo.png"
            required
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-wait disabled:opacity-50"
        >
          {isSubmitting ? <ArrowRepeat className="animate-spin" size={18} /> : <CheckCircle size={18} />}
          <span>{isSubmitting ? 'Wird gespeichert...' : 'Logo speichern'}</span>
        </button>
        
        {message.text && (
          <p className={`text-sm p-3 rounded border ${
            message.type === 'error' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-green-700 border-green-200'
          }`}>
            {message.text}
          </p>
        )}
      </form>

      {/* Liste der vorhandenen Logos */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-heading">Vorhandene Logos</h3>
        {isLoading && <p>Lade Logos...</p>}
        {error && <p className="text-red-600">Fehler beim Laden der Logos.</p>}
        {logos && logos.length === 0 && <p className="text-sm text-gray-500 italic">Keine Logos konfiguriert.</p>}
        <div className="max-h-96 space-y-2 overflow-y-auto pr-1 custom-scrollbar">
          {logos?.map(logo => (
            <div key={logo.mandant_id} className="flex items-center justify-between rounded-md bg-surface-secondary p-3">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-indigo-700">{logo.mandant_id}</p>
                <a 
                  href={logo.logo_url} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-xs text-gray-500 hover:underline truncate flex items-center gap-1"
                >
                  <Link45deg /> {logo.logo_url}
                </a>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <img src={logo.logo_url} alt={logo.mandant_id} className="h-8 w-auto bg-gray-100 rounded object-contain" />
                <button
                  onClick={() => handleDelete(logo.mandant_id)}
                  className="bg-red-50 text-red-600 p-2 rounded hover:bg-red-100"
                  title="Logo-Zuweisung löschen"
                >
                  <Trash size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
