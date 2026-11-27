// src/components/marketing/AccessRequestButton.tsx
// Knopf „Zugang anfragen“ mit Formular in einer Lightbox (statt mailto-Link).
'use client';

import { useId, useRef, useState } from 'react';
import { CheckCircleFill } from 'react-bootstrap-icons';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { inputClasses, textareaClasses } from '@/components/ui/Field';
import { Spinner } from '@/components/ui/Spinner';
import { accessRequestSchema } from '@/lib/access-request';

type FieldName = 'name' | 'company' | 'email' | 'website' | 'message' | 'consent';
type FieldErrors = Partial<Record<FieldName, string>>;

const EMPTY = { name: '', company: '', email: '', website: '', message: '', consent: false, fax: '' };

export default function AccessRequestButton({ className = '', children = 'Zugang anfragen' }: { className?: string; children?: React.ReactNode }) {
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);
  const openedAt = useRef(0);

  const openDialog = () => {
    openedAt.current = Date.now();
    setOpen(true);
  };

  const close = () => {
    setOpen(false);
    if (sent) {
      setSent(false);
      setValues(EMPTY);
    }
    setErrors({});
    setFormError(null);
  };

  const update = (name: keyof typeof EMPTY, value: string | boolean) => {
    setValues((current) => ({ ...current, [name]: value }));
    if (errors[name as FieldName]) setErrors((current) => ({ ...current, [name]: undefined }));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    const payload = { ...values, openedAt: openedAt.current };
    const check = accessRequestSchema.safeParse(payload);
    if (!check.success) {
      const next: FieldErrors = {};
      for (const issue of check.error.issues) {
        const key = String(issue.path[0]) as FieldName;
        if (!next[key]) next[key] = issue.message;
      }
      setErrors(next);
      return;
    }

    setIsSending(true);
    try {
      const response = await fetch('/api/zugang-anfragen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (data.fieldErrors) setErrors(data.fieldErrors);
        setFormError(data.message || 'Die Anfrage konnte nicht gesendet werden.');
        return;
      }
      setSent(true);
    } catch {
      setFormError('Keine Verbindung. Bitte versuchen Sie es noch einmal.');
    } finally {
      setIsSending(false);
    }
  };

  const fieldId = (name: string) => `${formId}-${name}`;
  const errorText = (name: FieldName) =>
    errors[name] ? <p id={`${fieldId(name)}-error`} className="mt-1 text-13 text-danger">{errors[name]}</p> : null;
  const a11y = (name: FieldName) => ({
    id: fieldId(name),
    'aria-invalid': errors[name] ? true : undefined,
    'aria-describedby': errors[name] ? `${fieldId(name)}-error` : undefined,
  });

  return (
    <>
      <button type="button" onClick={openDialog} className={className}>
        {children}
      </button>

      <Dialog
        open={open}
        onClose={close}
        title={sent ? 'Danke für Ihre Anfrage' : 'Zugang anfragen'}
        footer={
          sent ? (
            <Button onClick={close}>Schließen</Button>
          ) : (
            <>
              <Button variant="plain" onClick={close}>Abbrechen</Button>
              <Button type="submit" form={formId} disabled={isSending}>
                {isSending && <Spinner size={14} className="" />}
                {isSending ? 'Wird gesendet …' : 'Anfrage senden'}
              </Button>
            </>
          )
        }
      >
        {sent ? (
          <div className="flex flex-col items-center py-4 text-center" role="status">
            <CheckCircleFill size={36} className="text-success-bar" aria-hidden="true" />
            <p className="mt-4 text-15 text-body">
              Danke! Wir melden uns umgehend bei{' '}
              <span className="font-semibold text-heading">{values.email}</span>{' '}
              und kümmern uns um das technische Setup.
            </p>
          </div>
        ) : (
          <form id={formId} onSubmit={submit} noValidate className="space-y-4">
            <p className="text-14 text-muted">
              Erzählen Sie uns kurz von Ihrem Projekt. Wir melden uns umgehend und übernehmen das technische Setup für Sie.
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor={fieldId('name')} className="dp-label mb-1.5 text-13">Name</label>
                <input {...a11y('name')} type="text" autoComplete="name" value={values.name} onChange={(e) => update('name', e.target.value)} className={inputClasses} />
                {errorText('name')}
              </div>
              <div>
                <label htmlFor={fieldId('company')} className="dp-label mb-1.5 text-13">Firma <span className="dp-label-optional">· optional</span></label>
                <input {...a11y('company')} type="text" autoComplete="organization" value={values.company} onChange={(e) => update('company', e.target.value)} className={inputClasses} />
                {errorText('company')}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor={fieldId('email')} className="dp-label mb-1.5 text-13">Geschäftliche E-Mail</label>
                <input {...a11y('email')} type="email" autoComplete="email" value={values.email} onChange={(e) => update('email', e.target.value)} className={inputClasses} />
                {errorText('email')}
              </div>
              <div>
                <label htmlFor={fieldId('website')} className="dp-label mb-1.5 text-13">Ihre Website <span className="dp-label-optional">· optional</span></label>
                <input {...a11y('website')} type="text" inputMode="url" autoComplete="url" placeholder="ihre-firma.at" value={values.website} onChange={(e) => update('website', e.target.value)} className={inputClasses} />
                {errorText('website')}
              </div>
            </div>

            <div>
              <label htmlFor={fieldId('message')} className="dp-label mb-1.5 text-13">
                Nachricht <span className="dp-label-optional">· optional</span>
              </label>
              <textarea {...a11y('message')} rows={3} placeholder="Welche Datenquellen nutzen Sie heute?" value={values.message} onChange={(e) => update('message', e.target.value)} className={textareaClasses} />
              {errorText('message')}
            </div>

            {/* Für Menschen unsichtbar; Bots füllen es aus. */}
            <div className="absolute -left-[10000px] h-px w-px overflow-hidden" aria-hidden="true">
              <label htmlFor={fieldId('fax')}>Dieses Feld bitte leer lassen</label>
              <input id={fieldId('fax')} type="text" tabIndex={-1} autoComplete="off" value={values.fax} onChange={(e) => update('fax', e.target.value)} />
            </div>

            <div>
              <label className="flex items-start gap-2.5 text-13 leading-[1.5] text-body">
                <input
                  type="checkbox"
                  checked={values.consent}
                  onChange={(e) => update('consent', e.target.checked)}
                  aria-invalid={errors.consent ? true : undefined}
                  aria-describedby={errors.consent ? `${fieldId('consent')}-error` : undefined}
                  className="mt-0.5 h-4 w-4 flex-shrink-0 accent-[var(--dp-accent-solid)]"
                />
                <span>
                  Ich bin einverstanden, dass meine Angaben zur Bearbeitung der Anfrage verwendet werden. Mehr in der{' '}
                  <a href="/datenschutz" target="_blank" className="text-accent hover:underline">Datenschutzerklärung</a>.
                </span>
              </label>
              {errorText('consent')}
            </div>

            {formError && <p className="text-13 text-danger" role="alert">{formError}</p>}
          </form>
        )}
      </Dialog>
    </>
  );
}
