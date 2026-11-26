// src/app/konto/zwei-faktor/TwoFactorSetup.tsx
'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { signOut } from 'next-auth/react';
import { ShieldCheck, ShieldExclamation } from 'react-bootstrap-icons';
import { Button } from '@/components/ui/Button';
import { inputClasses } from '@/components/ui/Field';
import { Spinner } from '@/components/ui/Spinner';

interface Status {
  available: boolean;
  enabled: boolean;
  required: boolean;
  email: string;
  recoveryCodesLeft: number;
}

interface SetupData {
  secret: string;
  qrDataUrl: string;
}

type Step = 'loading' | 'overview' | 'scan' | 'codes';

const cardClasses = 'rounded-container border border-border bg-surface p-6';

async function post(body: Record<string, string>) {
  const response = await fetch('/api/account/two-factor', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || `HTTP ${response.status}`);
  return result;
}

export default function TwoFactorSetup({ setupRequired }: { setupRequired: boolean }) {
  const [step, setStep] = useState<Step>('loading');
  const [status, setStatus] = useState<Status | null>(null);
  const [setup, setSetup] = useState<SetupData | null>(null);
  const [code, setCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const loadStatus = useCallback(async () => {
    const response = await fetch('/api/account/two-factor', { cache: 'no-store' });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result) {
      setError(result?.message || 'Status konnte nicht geladen werden.');
      setStep('overview');
      return;
    }
    setStatus(result);
    setStep('overview');
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const run = async (action: () => Promise<void>) => {
    setError('');
    setBusy(true);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
    } finally {
      setBusy(false);
    }
  };

  const startSetup = () => run(async () => {
    const result = await post({ action: 'setup' });
    setSetup({ secret: result.secret, qrDataUrl: result.qrDataUrl });
    setCode('');
    setStep('scan');
  });

  const confirmSetup = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      const result = await post({ action: 'enable', code });
      setRecoveryCodes(result.recoveryCodes);
      setStep('codes');
    });
  };

  const disable = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      await post({ action: 'disable', code });
      setCode('');
      await loadStatus();
    });
  };

  const downloadCodes = () => {
    const text = `DataPeak – Wiederherstellungscodes für ${status?.email ?? ''}\nJeder Code funktioniert einmal.\n\n${recoveryCodes.join('\n')}\n`;
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'datapeak-wiederherstellungscodes.txt';
    link.click();
    URL.revokeObjectURL(url);
  };

  if (step === 'loading') {
    return <div className={cardClasses}><Spinner size={20} /></div>;
  }

  const errorLine = error ? <p className="mt-3 text-[13px] text-danger" role="alert">{error}</p> : null;

  if (step === 'codes') {
    return (
      <div className={cardClasses}>
        <h2 className="flex items-center gap-2 text-[17px] font-semibold text-heading">
          <ShieldCheck size={18} aria-hidden="true" /> Zwei-Faktor-Anmeldung ist aktiv
        </h2>
        <p className="mt-2 text-[14px] text-muted">
          Speichern Sie diese Wiederherstellungscodes an einem sicheren Ort. Jeder Code funktioniert einmal, falls Sie keinen Zugriff auf die App haben. Sie werden nur jetzt angezeigt.
        </p>
        <ul className="mt-4 grid grid-cols-2 gap-2 font-mono text-[15px] text-heading">
          {recoveryCodes.map((item) => <li key={item} className="rounded-control bg-surface-secondary px-3 py-2">{item}</li>)}
        </ul>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={downloadCodes}>Codes herunterladen</Button>
          <Button onClick={() => void signOut({ callbackUrl: '/login' })}>Gesichert, neu anmelden</Button>
        </div>
        <p className="mt-3 text-[13px] text-muted">Zum Abschluss melden Sie sich einmal neu an, dann mit Code aus der App.</p>
      </div>
    );
  }

  if (step === 'scan' && setup) {
    return (
      <form onSubmit={confirmSetup} className={cardClasses}>
        <h2 className="text-[17px] font-semibold text-heading">1. QR-Code scannen</h2>
        <p className="mt-1 text-[14px] text-muted">In der Authenticator-App ein neues Konto hinzufügen und diesen Code scannen.</p>
        {/* eslint-disable-next-line @next/next/no-img-element -- data-URL, kein Bild-Optimizer nötig */}
        <img src={setup.qrDataUrl} alt="QR-Code für die Authenticator-App" width={220} height={220} className="mt-4 rounded-control border border-border bg-white p-2" />
        <p className="mt-3 text-[13px] text-muted">
          Scannen nicht möglich? Diesen Schlüssel eingeben: <code className="select-all break-all font-mono text-heading">{setup.secret}</code>
        </p>
        <h2 className="mt-6 text-[17px] font-semibold text-heading">2. Code bestätigen</h2>
        <label htmlFor="totp-code" className="mt-1 block text-[14px] text-muted">Den 6-stelligen Code aus der App eingeben.</label>
        <input
          id="totp-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9 ]{6,7}"
          required
          value={code}
          onChange={(event) => setCode(event.target.value)}
          className={`${inputClasses} mt-2 max-w-[180px] font-mono tracking-widest`}
          placeholder="123456"
          disabled={busy}
        />
        {errorLine}
        <div className="mt-4 flex gap-2">
          <Button type="submit" disabled={busy}>{busy ? 'Prüfe …' : 'Aktivieren'}</Button>
          <Button variant="secondary" onClick={() => setStep('overview')} disabled={busy}>Abbrechen</Button>
        </div>
      </form>
    );
  }

  if (!status?.available) {
    return (
      <div className={cardClasses}>
        <p className="text-[14px] text-muted">Die Zwei-Faktor-Anmeldung ist auf diesem System noch nicht eingerichtet.</p>
        {errorLine}
      </div>
    );
  }

  if (status.enabled) {
    return (
      <div className={cardClasses}>
        <h2 className="flex items-center gap-2 text-[17px] font-semibold text-heading">
          <ShieldCheck size={18} aria-hidden="true" /> Aktiv für {status.email}
        </h2>
        <p className="mt-2 text-[14px] text-muted">
          Noch {status.recoveryCodesLeft} von 8 Wiederherstellungscodes übrig.
          {status.required ? ' Für Admins ist die Zwei-Faktor-Anmeldung Pflicht. Bei verlorenem Handy setzt ein Superadmin sie zurück.' : ''}
        </p>
        {!status.required && (
          <form onSubmit={disable} className="mt-5">
            <label htmlFor="disable-code" className="block text-[14px] text-muted">Zum Abschalten einen aktuellen Code oder Wiederherstellungscode eingeben.</label>
            <input
              id="disable-code"
              required
              value={code}
              onChange={(event) => setCode(event.target.value)}
              className={`${inputClasses} mt-2 max-w-[220px] font-mono`}
              disabled={busy}
            />
            {errorLine}
            <Button type="submit" variant="destructive" className="mt-3" disabled={busy}>Abschalten</Button>
          </form>
        )}
      </div>
    );
  }

  return (
    <div className={cardClasses}>
      <h2 className="flex items-center gap-2 text-[17px] font-semibold text-heading">
        <ShieldExclamation size={18} aria-hidden="true" /> Noch nicht eingerichtet
      </h2>
      <p className="mt-2 text-[14px] text-muted">
        {setupRequired || status.required
          ? 'Für Admins ist die Zwei-Faktor-Anmeldung Pflicht. Bitte jetzt einrichten, danach geht es weiter.'
          : 'Schützt Ihr Konto zusätzlich, falls jemand Ihr Passwort kennt.'}
      </p>
      {errorLine}
      <Button className="mt-4" onClick={() => void startSetup()} disabled={busy}>
        {busy ? 'Starte …' : 'Jetzt einrichten'}
      </Button>
    </div>
  );
}
