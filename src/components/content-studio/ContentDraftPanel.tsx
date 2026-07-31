'use client';

import { useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Braces, CheckCircle2, Clipboard, Code2, Download, Edit3, Eye, Save, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import type { ContentBrief, ContentOutline, ContentQualityCheck, InternalLinkCandidate } from '@/lib/content-studio/types';

type Props = {
  draft: string;
  brief: ContentBrief;
  outline: ContentOutline;
  selectedLinks: InternalLinkCandidate[];
  saving: boolean;
  onDraftChange: (value: string) => void;
  onSave: () => void;
};

function downloadFile(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildQualityChecks(draft: string, outline: ContentOutline, links: InternalLinkCandidate[]): ContentQualityCheck[] {
  const words = draft.trim() ? draft.trim().split(/\s+/).length : 0;
  const h1Count = (draft.match(/^#\s+/gm) || []).length;
  const usedLinks = links.filter((link) => draft.includes(link.url)).length;
  const placeholderCount = (draft.match(/\[[A-ZÄÖÜ0-9 _-]{3,}\]/g) || []).length;
  return [
    { key: 'h1', label: 'Genau eine H1', passed: h1Count === 1, value: `${h1Count} H1` },
    { key: 'words', label: 'Ausreichende Inhaltstiefe', passed: words >= 500, value: `${words} Wörter` },
    { key: 'meta-title', label: 'Meta Title', passed: outline.metaTitle.length >= 30 && outline.metaTitle.length <= 65, value: `${outline.metaTitle.length} Zeichen` },
    { key: 'meta-description', label: 'Meta Description', passed: outline.metaDescription.length >= 100 && outline.metaDescription.length <= 165, value: `${outline.metaDescription.length} Zeichen` },
    { key: 'links', label: 'Interne Links integriert', passed: links.length === 0 || usedLinks > 0, value: `${usedLinks}/${links.length}` },
    { key: 'placeholders', label: 'Keine Platzhalter', passed: placeholderCount === 0, value: `${placeholderCount} gefunden` },
  ];
}

export default function ContentDraftPanel({ draft, brief, outline, selectedLinks, saving, onDraftChange, onSave }: Props) {
  const [view, setView] = useState<'preview' | 'edit'>('preview');
  const previewRef = useRef<HTMLDivElement>(null);
  const checks = useMemo(() => buildQualityChecks(draft, outline, selectedLinks), [draft, outline, selectedLinks]);

  const exportHtml = () => {
    const rendered = previewRef.current?.innerHTML;
    if (!rendered) return;
    const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>${escapeHtml(outline.metaTitle)}</title><meta name="description" content="${escapeHtml(outline.metaDescription)}"></head><body><main>${rendered}</main></body></html>`;
    downloadFile('content-entwurf.html', html, 'text/html;charset=utf-8');
  };

  const exportSchema = () => {
    const schema = brief.contentType === 'article'
      ? {
          '@context': 'https://schema.org',
          '@type': 'Article',
          mainEntityOfPage: brief.targetUrl,
          headline: outline.title,
          description: outline.metaDescription,
          inLanguage: 'de',
        }
      : {
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          url: brief.targetUrl,
          name: outline.title,
          description: outline.metaDescription,
          inLanguage: 'de',
        };
    downloadFile('content-schema.json', JSON.stringify(schema, null, 2), 'application/ld+json;charset=utf-8');
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <section className="rounded-lg bg-surface shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-theme-border-subtle p-4">
          <div className="flex rounded border border-theme-border-default p-0.5">
            <button type="button" onClick={() => setView('preview')} className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-semibold ${view === 'preview' ? 'bg-surface-secondary text-heading' : 'text-muted'}`}><Eye size={14} /> Vorschau</button>
            <button type="button" onClick={() => setView('edit')} className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-semibold ${view === 'edit' ? 'bg-surface-secondary text-heading' : 'text-muted'}`}><Edit3 size={14} /> Bearbeiten</button>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => { navigator.clipboard.writeText(draft); toast.success('Entwurf kopiert.'); }} className="rounded border border-theme-border-default p-2 text-muted hover:text-heading" title="Markdown kopieren"><Clipboard size={16} /></button>
            <button type="button" onClick={() => downloadFile('content-entwurf.md', draft, 'text/markdown;charset=utf-8')} className="inline-flex items-center gap-1.5 rounded border border-theme-border-default px-3 py-2 text-xs font-semibold text-heading"><Download size={14} /> Markdown</button>
            <button type="button" onClick={exportHtml} className="inline-flex items-center gap-1.5 rounded border border-theme-border-default px-3 py-2 text-xs font-semibold text-heading"><Code2 size={14} /> HTML</button>
            <button type="button" onClick={exportSchema} className="inline-flex items-center gap-1.5 rounded border border-theme-border-default px-3 py-2 text-xs font-semibold text-heading"><Braces size={14} /> Schema</button>
          </div>
        </div>
        {view === 'edit' ? (
          <textarea value={draft} onChange={(event) => onDraftChange(event.target.value)} className="min-h-[720px] w-full resize-y bg-surface p-6 font-mono text-sm leading-7 text-heading outline-none" />
        ) : (
          <div ref={previewRef} className="prose prose-slate min-h-[720px] max-w-none p-7 dark:prose-invert prose-headings:font-semibold prose-a:text-[#4285F4]">
            <ReactMarkdown>{draft}</ReactMarkdown>
          </div>
        )}
      </section>

      <aside className="space-y-4">
        <section className="rounded-lg bg-surface p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-heading">Qualitätsprüfung</h3>
          <div className="mt-4 space-y-3">
            {checks.map((check) => (
              <div key={check.key} className="flex items-start gap-2">
                {check.passed ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-500" /> : <XCircle size={16} className="mt-0.5 shrink-0 text-rose-500" />}
                <div>
                  <div className="text-xs font-semibold text-heading">{check.label}</div>
                  <div className="text-[11px] text-muted">{check.value}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="rounded-lg bg-surface p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-heading">Redaktionsplan</h3>
          <p className="mt-2 text-xs leading-5 text-muted">Speichert den aktuellen Entwurf als offene Landingpage beziehungsweise Artikel und legt gleichzeitig eine Version im Content-Verlauf an.</p>
          <button type="button" onClick={onSave} disabled={saving} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded bg-[#4285F4] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#3367d6] disabled:opacity-50">
            <Save size={16} /> {saving ? 'Speichert…' : 'Entwurf speichern'}
          </button>
        </section>
      </aside>
    </div>
  );
}
