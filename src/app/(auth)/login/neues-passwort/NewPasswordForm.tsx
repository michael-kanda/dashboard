// src/app/(auth)/login/neues-passwort/NewPasswordForm.tsx
'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { signOut } from 'next-auth/react';
import { CheckCircle, ExclamationTriangle } from 'react-bootstrap-icons';
import { Spinner } from '@/components/ui/Spinner';
import { MIN_PASSWORD_LENGTH, getPasswordError } from '@/lib/password-policy';
import AuthShell, { authButtonClasses, authFieldClasses, authRowClasses } from '../AuthShell';

type Step = 'checking' | 'invalid' | 'form' | 'done';

async function postReset(body: Record<string, string>) {
  const response = await fetch('/api/password/reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({}));
  return { ok: response.ok, message: typeof result.message === 'string' ? result.message : '' };
}

export default function NewPasswordForm() {
  const [step, setStep] = useState<Step>('checking');
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Der Token steht hinter # und erreicht so nie Server-Logs. Danach aus der Adresszeile entfernen.
  useEffect(() => {
    const value = new URLSearchParams(window.location.hash.slice(1)).get('token') ?? '';
    window.history.replaceState(null, '', window.location.pathname);
    if (!value) {
      setStep('invalid');
      return;
    }
    setToken(value);
    void postReset({ token: value }).then((result) => {
      if (result.ok) setStep('form');
      else {
        setError(result.message);
        setStep('invalid');
      }
    });
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    const policyError = getPasswordError(password);
    if (policyError) return setError(policyError);
    if (password !== confirmPassword) return setError('Die Wiederholung stimmt nicht mit dem neuen Passwort überein.');

    setBusy(true);
    const result = await postReset({ token, password, confirmPassword }).catch(() => ({ ok: false, message: '' }));
    setBusy(false);
    if (!result.ok) {
      setError(result.message || 'Das Passwort konnte gerade nicht gesetzt werden.');
      return;
    }
    // Falls dieser Browser noch angemeldet ist: sofort abmelden. Andere Geräte folgen bei der nächsten Prüfung.
    await signOut({ redirect: false }).catch(() => undefined);
    setStep('done');
  };

  if (step === 'checking') {
    return (
      <AuthShell title="Neues Passwort" subtitle="Der Link wird geprüft.">
        <div className="flex justify-center"><Spinner size={22} /></div>
      </AuthShell>
    );
  }

  if (step === 'invalid') {
    return (
      <AuthShell title="Link ungültig" subtitle="Dieser Link funktioniert nicht mehr.">
        <div className="flex flex-col items-center gap-3 rounded-container border border-border bg-surface p-5 text-center" role="alert">
          <ExclamationTriangle size={22} className="text-warning" aria-hidden="true" />
          <p className="text-14 text-heading">
            {error || 'Der Link ist unvollständig, abgelaufen oder wurde schon benutzt. Links aus der E-Mail gelten 60 Minuten und einmal.'}
          </p>
          <Link href="/login/passwort-vergessen" className="text-14 font-semibold text-accent hover:underline">Neuen Link anfordern</Link>
        </div>
      </AuthShell>
    );
  }

  if (step === 'done') {
    return (
      <AuthShell title="Passwort gesetzt" subtitle="Sie können sich jetzt anmelden.">
        <div className="flex flex-col items-center gap-3 rounded-container border border-border bg-surface p-5 text-center" role="status">
          <CheckCircle size={22} className="text-success" aria-hidden="true" />
          <p className="text-14 text-heading">
            Ihr neues Passwort gilt ab sofort. Alle Geräte werden abgemeldet. Ist die Zwei-Faktor-Anmeldung eingeschaltet, fragt die Anmeldung weiterhin nach dem Code aus Ihrer App.
          </p>
          <Link href="/login" className={`${authButtonClasses} mt-1`}>Zur Anmeldung</Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Neues Passwort" subtitle={`Mindestens ${MIN_PASSWORD_LENGTH} Zeichen.`}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="overflow-hidden rounded-container border border-border bg-surface">
          <div className={authRowClasses}>
            <label htmlFor="reset-password" className="w-[88px] flex-shrink-0 text-14 text-heading">Passwort</label>
            <input
              id="reset-password"
              type="password"
              autoComplete="new-password"
              required
              autoFocus
              minLength={MIN_PASSWORD_LENGTH}
              value={password}
              onChange={(e) => { if (error) setError(''); setPassword(e.target.value); }}
              className={authFieldClasses}
              placeholder="Neues Passwort"
              disabled={busy}
            />
          </div>
          <div className={authRowClasses}>
            <label htmlFor="reset-confirm" className="w-[88px] flex-shrink-0 text-14 text-heading">Wiederholen</label>
            <input
              id="reset-confirm"
              type="password"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => { if (error) setError(''); setConfirmPassword(e.target.value); }}
              className={authFieldClasses}
              placeholder="Noch einmal"
              disabled={busy}
            />
          </div>
        </div>
        {error && <p className="text-13 text-danger" role="alert">{error}</p>}
        <button type="submit" className={authButtonClasses} disabled={busy}>
          {busy && <Spinner size={14} className="" />}
          {busy ? 'Speichere …' : 'Passwort festlegen'}
        </button>
      </form>
    </AuthShell>
  );
}
