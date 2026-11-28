// src/app/(auth)/login/passwort-vergessen/ForgotPasswordForm.tsx
'use client';

import { useState, type FormEvent } from 'react';
import { Envelope } from 'react-bootstrap-icons';
import { Spinner } from '@/components/ui/Spinner';
import AuthShell, { authButtonClasses, authFieldClasses, authRowClasses } from '../AuthShell';

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sentMessage, setSentMessage] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const response = await fetch('/api/password/forgot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || 'Die Anfrage konnte gerade nicht gesendet werden.');
      setSentMessage(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Die Anfrage konnte gerade nicht gesendet werden.');
    } finally {
      setBusy(false);
    }
  };

  if (sentMessage) {
    return (
      <AuthShell title="E-Mail unterwegs" subtitle="Bitte sehen Sie in Ihr Postfach.">
        <div className="flex flex-col items-center gap-3 rounded-container border border-border bg-surface p-5 text-center" role="status">
          <Envelope size={22} className="text-accent" aria-hidden="true" />
          <p className="text-14 text-heading">{sentMessage}</p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Passwort vergessen?" subtitle="Wir schicken Ihnen einen Link, mit dem Sie ein neues Passwort festlegen.">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="overflow-hidden rounded-container border border-border bg-surface">
          <div className={authRowClasses}>
            <label htmlFor="forgot-email" className="w-[72px] flex-shrink-0 text-14 text-heading">E-Mail</label>
            <input
              id="forgot-email"
              type="email"
              autoComplete="email"
              required
              autoFocus
              value={email}
              onChange={(e) => { if (error) setError(''); setEmail(e.target.value); }}
              className={authFieldClasses}
              placeholder="name@firma.de"
              disabled={busy}
            />
          </div>
        </div>
        {error && <p className="text-13 text-danger" role="alert">{error}</p>}
        <button type="submit" className={authButtonClasses} disabled={busy}>
          {busy && <Spinner size={14} className="" />}
          {busy ? 'Sende …' : 'Link anfordern'}
        </button>
      </form>
    </AuthShell>
  );
}
