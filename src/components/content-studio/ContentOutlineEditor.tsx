'use client';

import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import type { ContentOutline, ContentOutlineSection } from '@/lib/content-studio/types';

type Props = {
  outline: ContentOutline;
  onChange: (outline: ContentOutline) => void;
};

function nextId(sections: ContentOutlineSection[]) {
  return `section-${Math.max(0, ...sections.map((section) => Number(section.id.match(/\d+/)?.[0] || 0))) + 1}`;
}

export default function ContentOutlineEditor({ outline, onChange }: Props) {
  const updateSection = (index: number, patch: Partial<ContentOutlineSection>) => {
    onChange({
      ...outline,
      sections: outline.sections.map((section, current) => current === index ? { ...section, ...patch } : section),
    });
  };

  const moveSection = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= outline.sections.length) return;
    const sections = [...outline.sections];
    [sections[index], sections[target]] = [sections[target], sections[index]];
    onChange({ ...outline, sections });
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <section className="rounded-lg bg-surface p-5 shadow-sm">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-heading">Gliederung bearbeiten</h2>
            <p className="mt-1 text-sm text-muted">Struktur freigeben, bevor Text erzeugt wird</p>
          </div>
          <button
            type="button"
            onClick={() => onChange({
              ...outline,
              sections: [...outline.sections, { id: nextId(outline.sections), level: 2, title: 'Neue Sektion', purpose: 'Inhalt und Ziel festlegen' }],
            })}
            className="inline-flex items-center gap-1.5 rounded border border-theme-border-default px-3 py-2 text-xs font-semibold text-heading hover:bg-surface-secondary"
          >
            <Plus size={14} /> Sektion
          </button>
        </div>

        <div className="space-y-2">
          {outline.sections.map((section, index) => (
            <div key={section.id} className="grid grid-cols-[64px_minmax(0,1fr)_auto] gap-2 rounded border border-theme-border-subtle bg-surface-secondary p-3">
              <select
                value={section.level}
                onChange={(event) => updateSection(index, { level: Number(event.target.value) as 2 | 3 })}
                className="h-10 rounded border border-theme-border-default bg-surface px-2 text-sm text-heading"
              >
                <option value={2}>H2</option>
                <option value={3}>H3</option>
              </select>
              <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <input
                  value={section.title}
                  onChange={(event) => updateSection(index, { title: event.target.value })}
                  className="h-10 rounded border border-theme-border-default bg-surface px-3 text-sm font-medium text-heading"
                  aria-label="Überschrift"
                />
                <input
                  value={section.purpose}
                  onChange={(event) => updateSection(index, { purpose: event.target.value })}
                  className="h-10 rounded border border-theme-border-default bg-surface px-3 text-sm text-secondary"
                  aria-label="Zweck der Sektion"
                />
              </div>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => moveSection(index, -1)} disabled={index === 0} title="Nach oben" className="p-2 text-muted hover:text-heading disabled:opacity-25"><ArrowUp size={16} /></button>
                <button type="button" onClick={() => moveSection(index, 1)} disabled={index === outline.sections.length - 1} title="Nach unten" className="p-2 text-muted hover:text-heading disabled:opacity-25"><ArrowDown size={16} /></button>
                <button type="button" onClick={() => onChange({ ...outline, sections: outline.sections.filter((_, current) => current !== index) })} title="Entfernen" className="p-2 text-muted hover:text-rose-500"><Trash2 size={16} /></button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <aside className="space-y-4">
        <section className="rounded-lg bg-surface p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-heading">SEO-Vorschau</h3>
          <label className="mt-4 block text-[10px] font-semibold uppercase text-muted">Meta Title</label>
          <textarea value={outline.metaTitle} onChange={(event) => onChange({ ...outline, metaTitle: event.target.value })} rows={2} className="mt-1 w-full rounded border border-theme-border-default bg-surface-secondary p-2 text-sm text-heading" />
          <div className="mt-1 text-right text-[10px] text-muted">{outline.metaTitle.length}/60</div>
          <label className="mt-3 block text-[10px] font-semibold uppercase text-muted">Meta Description</label>
          <textarea value={outline.metaDescription} onChange={(event) => onChange({ ...outline, metaDescription: event.target.value })} rows={4} className="mt-1 w-full rounded border border-theme-border-default bg-surface-secondary p-2 text-sm text-heading" />
          <div className="mt-1 text-right text-[10px] text-muted">{outline.metaDescription.length}/155</div>
        </section>
        <section className="rounded-lg bg-surface p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-heading">Keyword-Fokus</h3>
          <p className="mt-3 text-sm font-semibold text-[#4285F4]">{outline.primaryKeyword}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {outline.secondaryKeywords.map((keyword) => (
              <span key={keyword} className="rounded border border-theme-border-default px-2 py-1 text-xs text-secondary">{keyword}</span>
            ))}
          </div>
          <p className="mt-4 text-xs text-muted">Suchintention: {outline.searchIntent}</p>
        </section>
      </aside>
    </div>
  );
}
