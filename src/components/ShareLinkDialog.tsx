'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { inputClasses } from '@/components/ui/Field';

// Erstellt einen 24 Stunden gültigen Gastlink (nur lesen) und bietet ihn zum Kopieren an.
export default function ShareLinkDialog({
  projectId,
  open,
  onClose,
}: {
  projectId: string;
  open: boolean;
  onClose: () => void;
}) {
  const [link, setLink] = useState<{ url: string; expiresAt: string } | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const request = async (method: 'POST' | 'DELETE') => {
    setIsBusy(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/share-link`, { method });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Aktion fehlgeschlagen');
      return data;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Aktion fehlgeschlagen');
      return null;
    } finally {
      setIsBusy(false);
    }
  };

  const createLink = async () => {
    const data = await request('POST');
    if (data) setLink({ url: `${window.location.origin}${data.path}`, expiresAt: data.expiresAt });
  };

  const copyLink = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.url);
      toast.success('Link kopiert');
    } catch {
      toast.error('Kopieren nicht möglich, bitte den Link markieren und kopieren');
    }
  };

  const revokeAll = async () => {
    const data = await request('DELETE');
    if (data) {
      setLink(null);
      toast.success(data.revoked === 1 ? '1 Link widerrufen' : `${data.revoked} Links widerrufen`);
    }
  };

  const expiresLabel = link
    ? new Date(link.expiresAt).toLocaleString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Gastlink teilen"
      footer={
        <>
          <Button variant="destructive" onClick={revokeAll} disabled={isBusy} className="mr-auto">
            Alle Links widerrufen
          </Button>
          {link ? (
            <Button onClick={copyLink}>Link kopieren</Button>
          ) : (
            <Button onClick={createLink} disabled={isBusy}>{isBusy ? 'Erstellt …' : 'Link erstellen'}</Button>
          )}
        </>
      }
    >
      <div className="space-y-3 text-[15px] text-body">
        <p>
          Wer den Link hat, sieht dieses Projekt 24 Stunden lang ohne Anmeldung, nur zum Lesen.
          Bearbeiten, KI-Analyse und Chat sind gesperrt.
        </p>
        {link && (
          <div className="space-y-1.5">
            <label htmlFor="share-link-url" className="text-[13px] font-semibold text-muted">Gastlink</label>
            <input
              id="share-link-url"
              readOnly
              value={link.url}
              onFocus={(e) => e.currentTarget.select()}
              className={`${inputClasses} font-mono text-[13px]`}
            />
            <p className="text-[13px] text-muted">Gültig bis {expiresLabel} Uhr.</p>
          </div>
        )}
      </div>
    </Dialog>
  );
}
