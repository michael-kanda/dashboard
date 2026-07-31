'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Database,
  FileText,
  History,
  Loader2,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import ContentContextPanel from './ContentContextPanel';
import ContentDraftPanel from './ContentDraftPanel';
import ContentOutlineEditor from './ContentOutlineEditor';
import type {
  ContentBrief,
  ContentContext,
  ContentOutline,
  ContentType,
  InternalLinkCandidate,
} from '@/lib/content-studio/types';

type Project = {
  id: string;
  email: string;
  domain: string | null;
  mandant_id?: string | null;
};

type SavedVersion = {
  id: number;
  inputs?: {
    contentType?: ContentType;
    targetUrl?: string;
    outline?: ContentOutline;
    internalLinks?: InternalLinkCandidate[];
  };
  contentBrief?: Partial<ContentBrief>;
  resultText?: string;
  dataSources?: string[];
  createdAt: string;
};

type Step = 'setup' | 'data' | 'outline' | 'draft';

const STEPS: Array<{ id: Step; number: string; label: string }> = [
  { id: 'setup', number: '01', label: 'Setup' },
  { id: 'data', number: '02', label: 'Daten' },
  { id: 'outline', number: '03', label: 'Gliederung' },
  { id: 'draft', number: '04', label: 'Entwurf' },
];

const DEFAULT_BRIEF: ContentBrief = {
  projectId: '',
  contentType: 'landingpage',
  mode: 'new',
  targetUrl: '',
  topic: '',
  region: 'Österreich',
  targetAudience: '',
  conversionGoal: '',
  brandMode: 'with-brand',
  tone: 'professional',
  facts: '',
  dateRange: '3m',
};

function GoogleUnderline() {
  return (
    <div className="mt-2 flex h-1.5 w-[220px] overflow-hidden rounded-full" aria-hidden="true">
      <span className="w-1/4 bg-[#4285F4]" />
      <span className="w-1/4 bg-[#EA4335]" />
      <span className="w-1/4 bg-[#FBBC05]" />
      <span className="w-1/4 bg-[#34A853]" />
    </div>
  );
}

function getProjectUrl(domain: string | null) {
  if (!domain) return '';
  return domain.startsWith('http') ? domain : `https://${domain}`;
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function ContentStudio() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [brief, setBrief] = useState<ContentBrief>(DEFAULT_BRIEF);
  const [step, setStep] = useState<Step>('setup');
  const [context, setContext] = useState<ContentContext | null>(null);
  const [selectedLinks, setSelectedLinks] = useState<InternalLinkCandidate[]>([]);
  const [outline, setOutline] = useState<ContentOutline | null>(null);
  const [draft, setDraft] = useState('');
  const [versions, setVersions] = useState<SavedVersion[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingContext, setLoadingContext] = useState(false);
  const [generatingOutline, setGeneratingOutline] = useState(false);
  const [generatingDraft, setGeneratingDraft] = useState(false);
  const [saving, setSaving] = useState(false);

  const currentStepIndex = STEPS.findIndex((item) => item.id === step);
  const selectedProject = useMemo(
    () => projects.find((project) => project.id === brief.projectId) || null,
    [projects, brief.projectId]
  );

  useEffect(() => {
    const loadProjects = async () => {
      try {
        const response = await fetch('/api/projects');
        if (!response.ok) throw new Error('Projekte konnten nicht geladen werden.');
        const data = await response.json();
        setProjects(data.projects || []);
      } catch (error) {
        toast.error(errorMessage(error, 'Projekte konnten nicht geladen werden.'));
      } finally {
        setLoadingProjects(false);
      }
    };
    void loadProjects();
  }, []);

  useEffect(() => {
    if (!brief.projectId) {
      setVersions([]);
      return;
    }
    const loadVersions = async () => {
      try {
        const response = await fetch(`/api/admin/content-studio/save?projectId=${brief.projectId}`);
        if (!response.ok) return;
        const data = await response.json();
        setVersions(data.versions || []);
      } catch (error) {
        console.error('[Content Studio] Versionen:', error);
      }
    };
    void loadVersions();
  }, [brief.projectId]);

  const updateBrief = <K extends keyof ContentBrief>(key: K, value: ContentBrief[K]) => {
    setBrief((current) => ({ ...current, [key]: value }));
    if (key !== 'facts' && key !== 'targetAudience' && key !== 'conversionGoal' && key !== 'tone' && key !== 'brandMode') {
      setContext(null);
      setOutline(null);
      setDraft('');
    }
  };

  const selectProject = (projectId: string) => {
    const project = projects.find((item) => item.id === projectId);
    setBrief((current) => ({
      ...DEFAULT_BRIEF,
      projectId,
      targetUrl: getProjectUrl(project?.domain || null),
      topic: '',
    }));
    setContext(null);
    setOutline(null);
    setDraft('');
    setStep('setup');
  };

  const validateSetup = () => {
    if (!brief.projectId) return 'Bitte ein Projekt auswählen.';
    if (!brief.targetUrl.trim()) return 'Bitte eine bestehende oder geplante Ziel-URL angeben.';
    if (!brief.topic.trim()) return 'Bitte ein Thema angeben.';
    return null;
  };

  const loadContext = async () => {
    const validation = validateSetup();
    if (validation) {
      toast.error(validation);
      return;
    }
    setLoadingContext(true);
    try {
      const params = new URLSearchParams({
        projectId: brief.projectId,
        contentType: brief.contentType,
        mode: brief.mode,
        targetUrl: brief.targetUrl,
        topic: brief.topic,
        dateRange: brief.dateRange,
      });
      const response = await fetch(`/api/admin/content-studio/context?${params}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Datenbriefing konnte nicht erstellt werden.');
      const nextContext = data.context as ContentContext;
      setContext(nextContext);
      setBrief((current) => ({ ...current, targetUrl: nextContext.targetUrl }));
      setSelectedLinks(nextContext.sitemap.internalLinkCandidates.slice(0, 5));
      setOutline(null);
      setDraft('');
      setStep('data');
      toast.success('Datenbriefing erstellt.');
    } catch (error) {
      toast.error(errorMessage(error, 'Datenbriefing fehlgeschlagen.'));
    } finally {
      setLoadingContext(false);
    }
  };

  const generateOutline = async () => {
    if (!context) return;
    setGeneratingOutline(true);
    try {
      const response = await fetch('/api/admin/content-studio/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'outline', brief, context, selectedLinks }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Gliederung konnte nicht erstellt werden.');
      setOutline(data.outline);
      setStep('outline');
      toast.success('Gliederung erstellt. Bitte vor dem Entwurf prüfen.');
    } catch (error) {
      toast.error(errorMessage(error, 'Gliederung fehlgeschlagen.'));
    } finally {
      setGeneratingOutline(false);
    }
  };

  const generateDraft = async () => {
    if (!context || !outline) return;
    if (outline.sections.length < 3) {
      toast.error('Die Gliederung benötigt mindestens drei Sektionen.');
      return;
    }
    setGeneratingDraft(true);
    setDraft('');
    try {
      const response = await fetch('/api/admin/content-studio/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'draft', brief, context, outline, selectedLinks }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || 'Entwurf konnte nicht erstellt werden.');
      }
      if (!response.body) throw new Error('Die KI hat keinen Textstream geliefert.');
      setStep('draft');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let text = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        setDraft(text);
      }
      toast.success('Entwurf erstellt.');
    } catch (error) {
      toast.error(errorMessage(error, 'Entwurf fehlgeschlagen.'));
    } finally {
      setGeneratingDraft(false);
    }
  };

  const saveDraft = async () => {
    if (!outline || !draft.trim() || !context) return;
    setSaving(true);
    try {
      const response = await fetch('/api/admin/content-studio/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: brief.projectId,
          contentType: brief.contentType,
          targetUrl: brief.targetUrl,
          brief,
          outline,
          contentMarkdown: draft,
          metaTitle: outline.metaTitle,
          metaDescription: outline.metaDescription,
          primaryKeyword: outline.primaryKeyword,
          secondaryKeywords: outline.secondaryKeywords,
          internalLinks: selectedLinks,
          dataSources: context.dataSources,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Entwurf konnte nicht gespeichert werden.');
      setVersions((current) => [{
        id: data.version.id,
        inputs: { contentType: brief.contentType, targetUrl: brief.targetUrl, outline, internalLinks: selectedLinks },
        contentBrief: brief,
        resultText: draft,
        dataSources: context.dataSources,
        createdAt: data.version.createdAt,
      }, ...current].slice(0, 20));
      toast.success('Entwurf im Redaktionsplan gespeichert.');
    } catch (error) {
      toast.error(errorMessage(error, 'Speichern fehlgeschlagen.'));
    } finally {
      setSaving(false);
    }
  };

  const openVersion = (version: SavedVersion) => {
    if (!version.inputs?.outline || !version.resultText) return;
    setBrief((current) => ({ ...current, ...version.contentBrief, projectId: current.projectId } as ContentBrief));
    setOutline(version.inputs.outline);
    setSelectedLinks(version.inputs.internalLinks || []);
    setDraft(version.resultText);
    setStep('draft');
  };

  return (
    <div className="min-h-screen bg-surface-secondary px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1540px]">
        <header className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <p className="text-[11px] font-semibold uppercase text-muted">Redaktion</p>
            <h1 className="mt-1 text-2xl font-semibold text-heading">KI Content Studio</h1>
            <GoogleUnderline />
            <p className="mt-3 text-sm text-muted">Landingpages und Artikel aus echten Projekt- und Leistungsdaten erstellen</p>
          </div>
          {selectedProject && (
            <div className="rounded border border-theme-border-default bg-surface px-4 py-2 text-sm text-secondary shadow-sm">
              <span className="font-semibold text-heading">{selectedProject.domain || selectedProject.email}</span>
              {selectedProject.mandant_id && <span className="ml-2 text-xs text-muted">{selectedProject.mandant_id}</span>}
            </div>
          )}
        </header>

        <nav className="mb-6 grid grid-cols-2 overflow-hidden rounded-lg bg-surface shadow-sm sm:grid-cols-4" aria-label="Content-Workflow">
          {STEPS.map((item, index) => {
            const enabled = index <= currentStepIndex || (item.id === 'data' && Boolean(context)) || (item.id === 'outline' && Boolean(outline)) || (item.id === 'draft' && Boolean(draft));
            return (
              <button
                key={item.id}
                type="button"
                disabled={!enabled}
                onClick={() => enabled && setStep(item.id)}
                className={`flex min-h-16 items-center gap-3 border-b-2 px-4 text-left transition-colors sm:border-b-0 sm:border-r-2 ${step === item.id ? 'border-[#4285F4] bg-blue-50 text-[#3367d6] dark:bg-blue-950/20' : 'border-theme-border-subtle text-secondary hover:bg-surface-secondary disabled:cursor-not-allowed disabled:opacity-45'}`}
              >
                <span className="text-[10px] font-bold">{item.number}</span>
                <span className="text-sm font-semibold">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {step === 'setup' && (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
            <section className="rounded-lg bg-surface p-6 shadow-sm">
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-heading">Content-Auftrag</h2>
                <p className="mt-1 text-sm text-muted">DataPeak erstellt danach automatisch das Datenbriefing.</p>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <label className="md:col-span-2">
                  <span className="mb-1.5 block text-xs font-semibold text-secondary">Projekt *</span>
                  <select value={brief.projectId} onChange={(event) => selectProject(event.target.value)} disabled={loadingProjects} className="h-11 w-full rounded border border-theme-border-default bg-surface-secondary px-3 text-sm text-heading">
                    <option value="">{loadingProjects ? 'Projekte werden geladen…' : 'Projekt auswählen'}</option>
                    {projects.map((project) => <option key={project.id} value={project.id}>{project.domain || project.email}</option>)}
                  </select>
                </label>

                <div>
                  <span className="mb-1.5 block text-xs font-semibold text-secondary">Inhaltstyp</span>
                  <div className="grid grid-cols-2 rounded border border-theme-border-default p-1">
                    {([['landingpage', 'Landingpage', FileText], ['article', 'Artikel', BookOpen]] as const).map(([value, label, Icon]) => (
                      <button key={value} type="button" onClick={() => updateBrief('contentType', value)} className={`flex h-9 items-center justify-center gap-2 rounded text-xs font-semibold ${brief.contentType === value ? 'bg-[#4285F4] text-white' : 'text-secondary hover:bg-surface-secondary'}`}><Icon size={15} /> {label}</button>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="mb-1.5 block text-xs font-semibold text-secondary">Auftrag</span>
                  <div className="grid grid-cols-2 rounded border border-theme-border-default p-1">
                    <button type="button" onClick={() => updateBrief('mode', 'new')} className={`h-9 rounded text-xs font-semibold ${brief.mode === 'new' ? 'bg-[#4285F4] text-white' : 'text-secondary hover:bg-surface-secondary'}`}>Neu erstellen</button>
                    <button type="button" onClick={() => updateBrief('mode', 'optimize')} className={`h-9 rounded text-xs font-semibold ${brief.mode === 'optimize' ? 'bg-[#4285F4] text-white' : 'text-secondary hover:bg-surface-secondary'}`}>URL optimieren</button>
                  </div>
                </div>

                <label className="md:col-span-2">
                  <span className="mb-1.5 block text-xs font-semibold text-secondary">{brief.mode === 'optimize' ? 'Bestehende Ziel-URL *' : 'Geplante Ziel-URL oder Pfad *'}</span>
                  <input value={brief.targetUrl} onChange={(event) => updateBrief('targetUrl', event.target.value)} placeholder="https://example.at/thema/ oder /thema/" className="h-11 w-full rounded border border-theme-border-default bg-surface-secondary px-3 text-sm text-heading" />
                </label>

                <label>
                  <span className="mb-1.5 block text-xs font-semibold text-secondary">Thema *</span>
                  <input value={brief.topic} onChange={(event) => updateBrief('topic', event.target.value)} placeholder="z. B. Führerscheinentzug in Österreich" className="h-11 w-full rounded border border-theme-border-default bg-surface-secondary px-3 text-sm text-heading" />
                </label>
                <label>
                  <span className="mb-1.5 block text-xs font-semibold text-secondary">Zeitraum</span>
                  <select value={brief.dateRange} onChange={(event) => updateBrief('dateRange', event.target.value as ContentBrief['dateRange'])} className="h-11 w-full rounded border border-theme-border-default bg-surface-secondary px-3 text-sm text-heading">
                    <option value="30d">Letzte 30 Tage</option>
                    <option value="3m">3 Monate</option>
                    <option value="6m">6 Monate</option>
                  </select>
                </label>
                <label>
                  <span className="mb-1.5 block text-xs font-semibold text-secondary">Region</span>
                  <input value={brief.region} onChange={(event) => updateBrief('region', event.target.value)} className="h-11 w-full rounded border border-theme-border-default bg-surface-secondary px-3 text-sm text-heading" />
                </label>
                <label>
                  <span className="mb-1.5 block text-xs font-semibold text-secondary">Zielgruppe</span>
                  <input value={brief.targetAudience} onChange={(event) => updateBrief('targetAudience', event.target.value)} placeholder="z. B. Privatpersonen mit akutem Beratungsbedarf" className="h-11 w-full rounded border border-theme-border-default bg-surface-secondary px-3 text-sm text-heading" />
                </label>
                <label>
                  <span className="mb-1.5 block text-xs font-semibold text-secondary">Conversion-Ziel</span>
                  <input value={brief.conversionGoal} onChange={(event) => updateBrief('conversionGoal', event.target.value)} placeholder="z. B. Erstberatung anfragen" className="h-11 w-full rounded border border-theme-border-default bg-surface-secondary px-3 text-sm text-heading" />
                </label>
                <label>
                  <span className="mb-1.5 block text-xs font-semibold text-secondary">Tonalität</span>
                  <select value={brief.tone} onChange={(event) => updateBrief('tone', event.target.value as ContentBrief['tone'])} className="h-11 w-full rounded border border-theme-border-default bg-surface-secondary px-3 text-sm text-heading">
                    <option value="professional">Professionell</option>
                    <option value="approachable">Nahbar</option>
                    <option value="technical">Fachlich-technisch</option>
                  </select>
                </label>
                <label className="md:col-span-2">
                  <span className="mb-1.5 block text-xs font-semibold text-secondary">Belegte Fakten, Leistungen und USPs</span>
                  <textarea value={brief.facts} onChange={(event) => updateBrief('facts', event.target.value)} rows={5} placeholder="Nur überprüfbare Angaben. Fehlende Informationen werden nicht erfunden." className="w-full rounded border border-theme-border-default bg-surface-secondary p-3 text-sm text-heading" />
                </label>
                <div className="md:col-span-2 flex flex-wrap gap-4 border-t border-theme-border-subtle pt-4 text-sm text-secondary">
                  <label className="flex items-center gap-2"><input type="radio" checked={brief.brandMode === 'with-brand'} onChange={() => updateBrief('brandMode', 'with-brand')} /> Mit Brand</label>
                  <label className="flex items-center gap-2"><input type="radio" checked={brief.brandMode === 'without-brand'} onChange={() => updateBrief('brandMode', 'without-brand')} /> Ohne direkte Brand-Nennung</label>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button type="button" onClick={loadContext} disabled={loadingContext} className="inline-flex items-center gap-2 rounded bg-[#4285F4] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#3367d6] disabled:opacity-50">
                  {loadingContext ? <Loader2 size={16} className="animate-spin" /> : <Database size={16} />} Datenbriefing erstellen
                </button>
              </div>
            </section>

            <aside className="rounded-lg bg-surface p-5 shadow-sm">
              <div className="flex items-center gap-2"><History size={17} className="text-muted" /><h2 className="text-sm font-semibold text-heading">Versionen</h2></div>
              <p className="mt-1 text-xs text-muted">Gespeicherte Entwürfe dieses Projekts</p>
              <div className="mt-4 max-h-[620px] space-y-2 overflow-auto">
                {versions.length > 0 ? versions.map((version) => (
                  <button key={version.id} type="button" onClick={() => openVersion(version)} className="w-full rounded border border-theme-border-subtle bg-surface-secondary p-3 text-left hover:bg-surface">
                    <div className="truncate text-sm font-semibold text-heading">{version.contentBrief?.topic || version.inputs?.targetUrl || 'Content-Entwurf'}</div>
                    <div className="mt-1 text-[11px] text-muted">{new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(version.createdAt))}</div>
                    <div className="mt-2 line-clamp-2 text-xs text-secondary">{version.resultText?.replace(/^#+\s*/m, '').slice(0, 130)}</div>
                  </button>
                )) : <p className="rounded border border-dashed border-theme-border-default p-4 text-sm text-muted">Noch keine gespeicherten Entwürfe.</p>}
              </div>
            </aside>
          </div>
        )}

        {step === 'data' && context && (
          <>
            <ContentContextPanel context={context} selectedLinks={selectedLinks} onSelectedLinksChange={setSelectedLinks} />
            <div className="mt-5 flex justify-between">
              <button type="button" onClick={() => setStep('setup')} className="inline-flex items-center gap-2 rounded border border-theme-border-default bg-surface px-4 py-2.5 text-sm font-semibold text-heading shadow-sm"><ArrowLeft size={16} /> Setup</button>
              <button type="button" onClick={generateOutline} disabled={generatingOutline} className="inline-flex items-center gap-2 rounded bg-[#4285F4] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#3367d6] disabled:opacity-50">{generatingOutline ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} Gliederung erstellen</button>
            </div>
          </>
        )}

        {step === 'outline' && outline && (
          <>
            <ContentOutlineEditor outline={outline} onChange={setOutline} />
            <div className="mt-5 flex justify-between">
              <button type="button" onClick={() => setStep('data')} className="inline-flex items-center gap-2 rounded border border-theme-border-default bg-surface px-4 py-2.5 text-sm font-semibold text-heading shadow-sm"><ArrowLeft size={16} /> Daten</button>
              <button type="button" onClick={generateDraft} disabled={generatingDraft} className="inline-flex items-center gap-2 rounded bg-[#4285F4] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#3367d6] disabled:opacity-50">{generatingDraft ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />} Entwurf erstellen</button>
            </div>
          </>
        )}

        {step === 'draft' && outline && draft && (
          <>
            <ContentDraftPanel draft={draft} brief={brief} outline={outline} selectedLinks={selectedLinks} saving={saving} onDraftChange={setDraft} onSave={saveDraft} />
            <div className="mt-5 flex flex-wrap justify-between gap-3">
              <button type="button" onClick={() => setStep('outline')} className="inline-flex items-center gap-2 rounded border border-theme-border-default bg-surface px-4 py-2.5 text-sm font-semibold text-heading shadow-sm"><ArrowLeft size={16} /> Gliederung</button>
              {context && <button type="button" onClick={generateDraft} disabled={generatingDraft} className="inline-flex items-center gap-2 rounded border border-theme-border-default bg-surface px-4 py-2.5 text-sm font-semibold text-heading shadow-sm"><RefreshCw size={15} /> Neu generieren</button>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
