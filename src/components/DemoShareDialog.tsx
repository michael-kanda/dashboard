'use client';

import { toast } from 'sonner';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { inputClasses } from '@/components/ui/Field';

// Teilen in der öffentlichen Demo: Echte Gastlinks gibt es nur für echte Projekte,
// hier wird die Demo-Adresse angeboten und der Gastlink erklärt.
export default function DemoShareDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const url = typeof window === 'undefined' ? '' : `${window.location.origin}/demo-anwalt`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link kopiert');
    } catch {
      toast.error('Kopieren nicht möglich, bitte den Link markieren und kopieren');
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Gastlink teilen"
      footer={<Button onClick={copyLink}>Link kopieren</Button>}
    >
      <div className="space-y-3 text-[15px] text-body">
        <p>
          In echten Projekten erstellt dieser Knopf einen Gastlink: Wer ihn hat, sieht das Projekt
          24 Stunden lang ohne Anmeldung, nur zum Lesen. Danach läuft er ab, und Sie können ihn
          jederzeit vorher widerrufen.
        </p>
        <p>Die Demo ist ohnehin öffentlich. Teilen Sie dafür einfach diese Adresse:</p>
        <div className="space-y-1.5">
          <label htmlFor="demo-share-url" className="text-[13px] font-semibold text-muted">Demo-Link</label>
          <input
            id="demo-share-url"
            readOnly
            value={url}
            onFocus={(e) => e.currentTarget.select()}
            className={`${inputClasses} font-mono text-[13px]`}
          />
        </div>
      </div>
    </Dialog>
  );
}
