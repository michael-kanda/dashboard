'use client';

import { useEffect, useState } from 'react';
import { Check2, PencilSquare, X } from 'react-bootstrap-icons';
import { resolveDashboardInfoText } from './dashboard-info-text';

interface DashboardInfoWidgetProps {
  projectId?: string;
  initialText?: string | null;
  isAdmin: boolean;
}

export default function DashboardInfoWidget({
  projectId,
  initialText,
  isAdmin,
}: DashboardInfoWidgetProps) {
  const resolvedInitialText = resolveDashboardInfoText(initialText);
  const [infoText, setInfoText] = useState(resolvedInitialText);
  const [draftText, setDraftText] = useState(resolvedInitialText);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    const nextText = resolveDashboardInfoText(initialText);
    setInfoText(nextText);
    setDraftText(nextText);
    setIsEditing(false);
    setSaveError('');
  }, [initialText, projectId]);

  const save = async () => {
    if (!projectId) return;
    setIsSaving(true);
    setSaveError('');

    try {
      const response = await fetch(`/api/projects/${projectId}/info-box`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: draftText }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message || 'Speichern fehlgeschlagen');
      }
      const payload = await response.json();
      const nextText = resolveDashboardInfoText(payload.text);
      setInfoText(nextText);
      setDraftText(nextText);
      setIsEditing(false);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Speichern fehlgeschlagen');
    } finally {
      setIsSaving(false);
    }
  };

  const cancel = () => {
    setDraftText(infoText);
    setIsEditing(false);
    setSaveError('');
  };

  return (
    <div id="section-data-info" className="mt-8 scroll-mt-20 print:hidden">
      <div className="dashboard-widget-surface rounded-lg p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h3 className="widget-section-title text-heading">Hinweis zur Datenbasis</h3>
            <p className="widget-meta text-muted mt-0.5">Methodik, Datenschutz und Messlogik.</p>
          </div>
          {isAdmin && (
            <div className="flex items-center gap-2 shrink-0">
              {isEditing ? (
                <>
                  <button
                    type="button"
                    onClick={save}
                    disabled={isSaving}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border bg-success-bg px-2.5 py-1.5 text-xs font-medium text-success transition-colors hover:bg-success-bg disabled:opacity-50"
                  >
                    <Check2 size={14} />
                    {isSaving ? 'Speichert...' : 'Speichern'}
                  </button>
                  <button
                    type="button"
                    onClick={cancel}
                    disabled={isSaving}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border-subtle bg-surface px-2.5 py-1.5 text-xs font-medium text-body transition-colors hover:bg-surface-secondary disabled:opacity-50"
                  >
                    <X size={14} />
                    Abbrechen
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border-subtle bg-surface px-2.5 py-1.5 text-xs font-medium text-body transition-colors hover:bg-surface-secondary"
                >
                  <PencilSquare size={14} />
                  Bearbeiten
                </button>
              )}
            </div>
          )}
        </div>

        {isEditing ? (
          <div className="space-y-2">
            <textarea
              value={draftText}
              onChange={(event) => setDraftText(event.target.value)}
              rows={8}
              maxLength={5000}
              className="w-full rounded-lg border border-border-subtle bg-surface px-3 py-2 text-[12.2px] leading-relaxed text-body outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent"
            />
            <div className="flex items-center justify-between text-[12px] text-muted">
              <span>Leer speichern setzt wieder den Standardtext.</span>
              <span>{draftText.length}/5000</span>
            </div>
            {saveError && <p className="text-xs text-danger">{saveError}</p>}
          </div>
        ) : (
          <div className="whitespace-pre-line text-[10.6px] sm:text-[12.2px] leading-relaxed text-muted">
            {infoText}
          </div>
        )}
      </div>
    </div>
  );
}
