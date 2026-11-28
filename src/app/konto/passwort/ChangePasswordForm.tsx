// src/app/konto/passwort/ChangePasswordForm.tsx
'use client';

import { useState, type FormEvent } from 'react';
import { signOut } from 'next-auth/react';
import { CheckCircle } from 'react-bootstrap-icons';
import { Button } from '@/components/ui/Button';
import { Field, inputClasses } from '@/components/ui/Field';
import { MIN_PASSWORD_LENGTH, getPasswordError } from '@/lib/password-policy';

const cardClasses = 'max-w-[480px] rounded-container border border-border bg-surface p-6';

export default function ChangePasswordForm({ email }: { email: string }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ keptSession: boolean } | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    const policyError = getPasswordError(newPassword);
    if (policyError) return setError(policyError);
    if (newPassword !== confirmPassword) return setError('Die Wiederholung stimmt nicht mit dem neuen Passwort überein.');

    setBusy(true);
    try {
      const response = await fetch('/api/account/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || `HTTP ${response.status}`);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setDone({ keptSession: result.keptSession !== false });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className={cardClasses} role="status">
        <h2 className="flex items-center gap-2 text-17 font-semibold text-heading">
          <CheckCircle size={18} aria-hidden="true" /> Passwort geändert
        </h2>
        <p className="mt-2 text-14 text-muted">
          {done.keptSession
            ? 'Sie bleiben auf diesem Gerät angemeldet. Alle anderen Geräte werden innerhalb weniger Minuten abgemeldet.'
            : 'Bitte melden Sie sich mit dem neuen Passwort neu an. Alle Geräte werden abgemeldet.'}
        </p>
        {!done.keptSession && (
          <div className="mt-4">
            <Button onClick={() => void signOut({ callbackUrl: '/login' })}>Neu anmelden</Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className={`${cardClasses} flex flex-col gap-4`}>
      {/* Für Passwort-Manager: zu welchem Konto das Passwort gehört. */}
      <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
      <Field label="Aktuelles Passwort" htmlFor="current-password">
        <input
          id="current-password"
          type="password"
          autoComplete="current-password"
          required
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          className={inputClasses}
          disabled={busy}
        />
      </Field>
      <Field label="Neues Passwort" htmlFor="new-password" hint={`Mindestens ${MIN_PASSWORD_LENGTH} Zeichen.`}>
        <input
          id="new-password"
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className={inputClasses}
          disabled={busy}
        />
      </Field>
      <Field label="Neues Passwort wiederholen" htmlFor="confirm-password">
        <input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className={inputClasses}
          disabled={busy}
        />
      </Field>
      {error && <p className="text-13 text-danger" role="alert">{error}</p>}
      <div>
        <Button type="submit" disabled={busy}>{busy ? 'Speichere …' : 'Passwort ändern'}</Button>
      </div>
    </form>
  );
}
