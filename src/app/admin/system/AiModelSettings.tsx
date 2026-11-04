'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { GroupedRow, GroupedSection } from '@/components/ui/GroupedList';
import { Button } from '@/components/ui/Button';
import { inputClasses } from '@/components/ui/Field';
import { Spinner } from '@/components/ui/Spinner';
import { AI_MODEL_SUGGESTIONS, DEFAULT_AI_MODELS } from '@/lib/ai-model-schema';

// Haupt- und Ersatzmodell für KI-Analyse, Chat, Prompt-Tracking und Content Studio.
export default function AiModelSettings({
  primary,
  fallback,
  onSaved,
}: {
  primary: string;
  fallback: string;
  onSaved: () => void;
}) {
  const [saved, setSaved] = useState({ primary, fallback });
  const [draft, setDraft] = useState({ primary, fallback });
  const [isSaving, setIsSaving] = useState(false);

  const isDirty = draft.primary.trim() !== saved.primary || draft.fallback.trim() !== saved.fallback;
  const isDefault = draft.primary === DEFAULT_AI_MODELS.primary && draft.fallback === DEFAULT_AI_MODELS.fallback;

  const save = async () => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/admin/ai-models', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ primary: draft.primary, fallback: draft.fallback }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'KI-Modell konnte nicht gespeichert werden');
      setSaved(data.models);
      setDraft(data.models);
      toast.success('KI-Modell getestet und gespeichert');
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'KI-Modell konnte nicht gespeichert werden');
    } finally {
      setIsSaving(false);
    }
  };

  const field = (key: 'primary' | 'fallback', label: string, description: string) => (
    <GroupedRow label={label} description={description} htmlFor={`ai-model-${key}`}>
      <input
        id={`ai-model-${key}`}
        list="ai-model-suggestions"
        spellCheck={false}
        autoComplete="off"
        value={draft[key]}
        onChange={(e) => setDraft((prev) => ({ ...prev, [key]: e.target.value }))}
        className={`${inputClasses} w-[260px] font-mono text-[13px]`}
      />
    </GroupedRow>
  );

  return (
    <GroupedSection
      title="KI-Modell"
      help="Gemini-ID eingeben oder vorschlagen lassen. Vor dem Speichern wird jedes Modell kurz getestet."
    >
      <datalist id="ai-model-suggestions">
        {AI_MODEL_SUGGESTIONS.map((model) => <option key={model} value={model} />)}
      </datalist>
      {field('primary', 'Hauptmodell', `Für alle KI-Funktionen · Standard: ${DEFAULT_AI_MODELS.primary}`)}
      {field('fallback', 'Ersatzmodell', `Springt ein, wenn das Hauptmodell ausfällt · Standard: ${DEFAULT_AI_MODELS.fallback}`)}
      <GroupedRow label={isDirty ? 'Ungespeicherte Änderung' : 'Aktiv'} description={`${saved.primary} → ${saved.fallback}`}>
        <Button variant="plain" size="sm" onClick={() => setDraft({ ...DEFAULT_AI_MODELS })} disabled={isDefault || isSaving}>
          Standard
        </Button>
        <Button size="sm" onClick={save} disabled={!isDirty || isSaving}>
          {isSaving && <Spinner size={14} className="" />}
          {isSaving ? 'Wird getestet …' : 'Testen und speichern'}
        </Button>
      </GroupedRow>
    </GroupedSection>
  );
}
