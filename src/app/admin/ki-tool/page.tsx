// src/app/admin/ki-tool/page.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image'; 
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { 
  ChatText, 
  RocketTakeoff, 
  Magic, 
  Grid,
  FileEarmarkBarGraph, 
  Globe,
  Binoculars,
  GraphUpArrow,
  Search,
  GeoAlt,
  PlusCircle,
  CodeSquare,
  Newspaper,
  FileText,
  ArrowRight,
  Robot // NEU: Icon für KI-Sichtbarkeit
} from 'react-bootstrap-icons';
import CtrBooster from '@/components/admin/ki/CtrBooster';
import LandingpageGenerator from '@/components/admin/ki/LandingpageGenerator';
import AiVisibilityChecker from '@/components/admin/ki/AiVisibilityChecker'; // NEU

interface Project {
  id: string;
  email: string;
  domain: string;
  mandant_id?: string;
}

interface Keyword {
  query: string;
  clicks: number;
  position: number;
  impressions: number;
}

interface ContentBrief {
  landingpage: string;
  topic: string;
  region: string;
  targetAudience: string;
  goal: 'research' | 'optimize' | 'generate';
  brandMode: 'with-brand' | 'without-brand';
}

interface ToolRun {
  id: number;
  tool: string;
  dataSources?: string[];
  contentBrief?: Partial<ContentBrief>;
  resultPreview?: string;
  createdAt: string;
}

type Tab = 'questions' | 'ctr' | 'gap' | 'spy' | 'trends' | 'schema' | 'news' | 'landingpage' | 'ai-visibility'; // ERWEITERT
type SuiteView = 'setup' | 'tools';

// Länder-Optionen
const COUNTRIES = [
  { code: 'AT', label: '🇦🇹 Österreich', lang: 'de' },
  { code: 'DE', label: '🇩🇪 Deutschland', lang: 'de' },
  { code: 'CH', label: '🇨🇭 Schweiz', lang: 'de' },
  { code: 'US', label: '🇺🇸 USA', lang: 'en' },
];

export default function KiToolPage() {
  const [suiteView, setSuiteView] = useState<SuiteView>('setup');
  const [activeTab, setActiveTab] = useState<Tab>('questions');
  
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<string>('');
  const [isWaitingForStream, setIsWaitingForStream] = useState(false);
  
  // URL States
  const [analyzeUrl, setAnalyzeUrl] = useState('');     
  const [competitorUrl, setCompetitorUrl] = useState(''); 
  
  // Trend Radar States
  const [trendTopic, setTrendTopic] = useState('');
  const [trendCountry, setTrendCountry] = useState('AT');
  
  // Eigene Keywords Eingabe
  const [customKeywords, setCustomKeywords] = useState('');
  
  // News Crawler Topic State
  const [newsTopic, setNewsTopic] = useState('');

  // Zentraler Content Brief für alle Werkzeuge
  const [contentBrief, setContentBrief] = useState<ContentBrief>({
    landingpage: '',
    topic: '',
    region: 'AT',
    targetAudience: '',
    goal: 'research',
    brandMode: 'with-brand',
  });
  const [toolRuns, setToolRuns] = useState<ToolRun[]>([]);
  const [loadingRuns, setLoadingRuns] = useState(false);

  const outputRef = useRef<HTMLDivElement>(null);

  const workflowSteps = [
    { step: '01', title: 'Setup', text: 'Projekt, Zielseite, Thema, Region und Brand-Modus festlegen.' },
    { step: '02', title: 'Daten', text: 'GSC, GA4, Crawl, News, Trends und bestehende Tool-Läufe bündeln.' },
    { step: '03', title: 'Analyse', text: 'Quick Wins, Buy Intent, Content Gaps und KI-Antwortsignale bewerten.' },
    { step: '04', title: 'Brief', text: 'Eine gemeinsame Content-Grundlage für Struktur, Quellen und Zielgruppe erstellen.' },
    { step: '05', title: 'Output', text: 'Landingpage, Fragen, Schema, CTR-Ideen oder Research-Ergebnisse erzeugen.' },
  ];

  const toolItems: Array<{ id: Tab; label: string; description: string; icon: React.ReactNode }> = [
    { id: 'questions', label: 'Fragen', description: 'Suchintentionen und FAQ-Ideen', icon: <ChatText size={18} /> },
    { id: 'gap', label: 'Gap Analyse', description: 'Fehlende Inhalte aufdecken', icon: <FileEarmarkBarGraph size={18} /> },
    { id: 'spy', label: 'Competitor Spy', description: 'Seiten und Konkurrenz analysieren', icon: <Binoculars size={18} /> },
    { id: 'schema', label: 'Schema Analyzer', description: 'Strukturierte Daten prüfen', icon: <CodeSquare size={18} /> },
    { id: 'news', label: 'News-Crawler', description: 'Aktuelle Quellen recherchieren', icon: <Newspaper size={18} /> },
    { id: 'landingpage', label: 'Landingpage', description: 'SEO-Content aus Brief und Daten', icon: <FileText size={18} /> },
    { id: 'ai-visibility', label: 'KI-Antworttest', description: 'KI-Erwähnungen und Signale prüfen', icon: <Robot size={18} /> },
    { id: 'trends', label: 'Trend Radar', description: 'Themenbewegungen erkennen', icon: <GraphUpArrow size={18} /> },
    { id: 'ctr', label: 'CTR Booster', description: 'Titel und Snippets optimieren', icon: <RocketTakeoff size={18} /> },
  ];

  // --- 1. PROJEKTE LADEN ---
  useEffect(() => {
    async function fetchProjects() {
      try {
        const res = await fetch('/api/projects');
        if (!res.ok) throw new Error('Fehler beim Laden der Projekte');
        const data = await res.json();
        setProjects(data.projects || []);
      } catch (error) {
        console.error(error);
        toast.error('Projekte konnten nicht geladen werden.');
      } finally {
        setLoadingProjects(false);
      }
    }
    fetchProjects();
  }, []);

  // --- 2. DATEN LADEN ---
  useEffect(() => {
    if (!selectedProjectId) {
      setKeywords([]);
      setGeneratedContent('');
      setAnalyzeUrl('');
      setTrendTopic('');
      setCustomKeywords('');
      setNewsTopic('');
      setToolRuns([]);
      return;
    }

    const project = projects.find(p => p.id === selectedProjectId);
    setSelectedProject(project || null);

    if (project) {
        let cleanDomain = project.domain;
        if (!cleanDomain.startsWith('http')) {
            cleanDomain = `https://${cleanDomain}`;
        }
        setAnalyzeUrl(cleanDomain);
        setContentBrief(prev => ({
          ...prev,
          landingpage: prev.landingpage || cleanDomain,
          topic: prev.topic || project.domain,
        }));
    }

    // Keywords nur für 'questions', 'gap' und 'landingpage' laden
    const requiresKeywords = activeTab === 'questions' || activeTab === 'gap' || activeTab === 'landingpage';

    if (requiresKeywords) {
        async function fetchData() {
            setLoadingData(true);
            setKeywords([]);
            try {
                const url = `/api/data?projectId=${selectedProjectId}&dateRange=30d`;
                const res = await fetch(url);
                
                if (!res.ok) {
                if (res.status !== 404) {
                    const errData = await res.json();
                    throw new Error(errData.message || 'Fehler');
                }
                return;
                }

                const data = await res.json();
                
                if (data.topQueries && Array.isArray(data.topQueries)) {
                const topKeywords = data.topQueries.slice(0, 30);
                setKeywords(topKeywords);
                }

            } catch (error) {
                console.error('❌ Fetch Error:', error);
            } finally {
                setLoadingData(false);
            }
        }
        fetchData();
    } else {
        setKeywords([]);
        setLoadingData(false);
    }

  }, [selectedProjectId, projects, activeTab]);

  useEffect(() => {
    if (!selectedProjectId) return;

    async function fetchToolRuns() {
      setLoadingRuns(true);
      try {
        const res = await fetch(`/api/admin/ki-tool-runs?projectId=${selectedProjectId}`);
        if (!res.ok) return;
        const data = await res.json();
        setToolRuns(data.runs || []);
      } catch (error) {
        console.error('KI-Tool-Verlauf konnte nicht geladen werden:', error);
      } finally {
        setLoadingRuns(false);
      }
    }

    fetchToolRuns();
  }, [selectedProjectId]);

  const toggleKeyword = (query: string) => {
    setSelectedKeywords(prev => {
      return prev.includes(query) 
        ? prev.filter(k => k !== query)
        : [...prev, query];
    });
  };

  // Kombiniere ausgewählte Keywords + eigene Keywords
  const getAllKeywords = (): string[] => {
    const selected = [...selectedKeywords];
    
    // Eigene Keywords aus Textfeld parsen (Komma oder Newline getrennt)
    if (customKeywords.trim()) {
      const custom = customKeywords
        .split(/[,\n]+/)
        .map(k => k.trim())
        .filter(k => k.length > 0);
      
      // Duplikate vermeiden
      custom.forEach(k => {
        if (!selected.includes(k)) {
          selected.push(k);
        }
      });
    }
    
    return selected;
  };

  const updateContentBrief = <K extends keyof ContentBrief>(key: K, value: ContentBrief[K]) => {
    setContentBrief(prev => ({ ...prev, [key]: value }));
  };

  const getToolLabel = (tab: Tab) => {
    const labels: Record<Tab, string> = {
      questions: 'Fragen Generator',
      ctr: 'CTR Booster',
      gap: 'Content Gap',
      spy: 'Competitor Spy',
      trends: 'Trend Radar',
      schema: 'Schema Analyzer',
      news: 'News-Crawler',
      landingpage: 'Landingpage Generator',
      'ai-visibility': 'KI-Antworttest',
    };
    return labels[tab];
  };

  const getDataSources = (tab: Tab) => {
    const sources = new Set<string>();
    if (selectedKeywords.length > 0 || keywords.length > 0) sources.add('GSC');
    if (tab === 'news') sources.add('Google Custom Search');
    if (tab === 'trends') sources.add('Google Trends');
    if (tab === 'spy' || tab === 'gap' || tab === 'schema') sources.add('Crawl');
    if (tab === 'questions' || tab === 'gap' || tab === 'schema' || tab === 'spy') sources.add('KI');
    return Array.from(sources);
  };

  const saveToolRun = async (tool: Tab, inputs: Record<string, unknown>, resultText: string) => {
    if (!selectedProjectId || !resultText.trim()) return;

    try {
      const res = await fetch('/api/admin/ki-tool-runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: selectedProjectId,
          tool: getToolLabel(tool),
          inputs,
          dataSources: getDataSources(tool),
          contentBrief,
          resultText,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.run) setToolRuns(prev => [data.run, ...prev].slice(0, 12));
      }
    } catch (error) {
      console.error('KI-Tool-Lauf konnte nicht gespeichert werden:', error);
    }
  };

  // --- GENERIERUNGS-LOGIK ---
  const handleAction = async () => {
    if (!selectedProject) {
        toast.error('Bitte wählen Sie zuerst ein Projekt aus.');
        return;
    }

    const allKeywords = getAllKeywords();

    // Validierungen
    if (activeTab === 'news' && !newsTopic.trim()) {
        toast.error('Bitte geben Sie einen Suchbegriff (Topic) ein.');
        return;
    }
    if (activeTab === 'questions' && allKeywords.length === 0) {
        toast.error('Bitte wählen Sie Keywords aus oder geben Sie eigene ein.');
        return;
    }
    if (activeTab === 'gap' && !analyzeUrl) {
        toast.error('Bitte geben Sie Ihre URL ein.');
        return;
    }
    if (activeTab === 'gap' && allKeywords.length === 0) {
        toast.error('Bitte wählen Sie Keywords aus oder geben Sie eigene ein.');
        return;
    }
    if (activeTab === 'spy' && !analyzeUrl) {
        toast.error('Bitte geben Sie Ihre URL ein.');
        return;
    }
    if (activeTab === 'trends' && !trendTopic.trim()) {
        toast.error('Bitte geben Sie ein Thema oder eine Branche ein.');
        return;
    }
    if (activeTab === 'schema' && !analyzeUrl) {
        toast.error('Bitte geben Sie die zu analysierende URL ein.');
        return;
    }

    setIsGenerating(true);
    setIsWaitingForStream(true); 
    setGeneratedContent('');

    let endpoint = '';
    let body: Record<string, unknown> = {};

    if (activeTab === 'questions') {
        endpoint = '/api/ai/generate-questions';
        body = { keywords: allKeywords, domain: selectedProject.domain };
    } else if (activeTab === 'gap') {
        endpoint = '/api/ai/content-gap';
        body = { keywords: allKeywords, url: analyzeUrl }; 
    } else if (activeTab === 'spy') {
        endpoint = '/api/ai/competitor-spy';
        body = { myUrl: analyzeUrl, competitorUrl: competitorUrl };
    } else if (activeTab === 'trends') {
        endpoint = '/api/ai/trend-radar';
        const selectedCountry = COUNTRIES.find(c => c.code === trendCountry);
        body = { 
          domain: selectedProject.domain, 
          topic: trendTopic.trim(),
          country: trendCountry,
          lang: selectedCountry?.lang || 'de',
        };
    } else if (activeTab === 'schema') {
        endpoint = '/api/ai/schema-analyzer';
        body = { url: analyzeUrl };
    } else if (activeTab === 'news') {
        endpoint = '/api/ai/news-crawler';
        body = { topic: newsTopic.trim() };
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      
      setIsWaitingForStream(false); 

      if (!response.ok) {
          const errorDetail = await response.text();
          throw new Error(errorDetail || response.statusText);
      }
      
      if (!response.body) throw new Error('Kein Stream');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let streamedContent = '';

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        const chunkValue = decoder.decode(value, { stream: true });
        streamedContent += chunkValue;
        setGeneratedContent((prev) => prev + chunkValue);
        
        if (outputRef.current) {
            outputRef.current.scrollTop = outputRef.current.scrollHeight;
        }
      }

      await saveToolRun(activeTab, body, streamedContent);
      toast.success(`${getToolLabel(activeTab)} gespeichert.`);

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';
      console.error('❌ Fehler:', error);
      toast.error(`Fehler: ${errorMessage}`);
      setIsWaitingForStream(false);
    } finally {
      setIsGenerating(false);
    }
  };

  // Berechne Gesamtzahl der Keywords
  const totalKeywordCount = getAllKeywords().length;

  // --- RENDER ---
  return (
    <div className="p-6 w-full space-y-8 relative">
      
      {/* LIGHTBOX */}
      {isWaitingForStream && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface/70 backdrop-blur-md transition-all animate-in fade-in duration-300">
           <div className="bg-surface p-8 rounded-3xl shadow-2xl border border-theme-border-subtle flex flex-col items-center gap-6 max-w-md w-full text-center transform scale-100 animate-in zoom-in-95 duration-300">
              
              <div className="relative w-full flex justify-center">
                 <Image 
                   src="/data-max-arbeitet.webp" 
                   alt="KI arbeitet" 
                   width={400} 
                   height={400}
                   className="h-[200px] w-auto object-contain"
                   priority
                 />
              </div>
              
              <div>
                <h3 className="text-xl font-bold text-strong mb-1">Data Max at work</h3>
                <p className="text-muted text-sm leading-relaxed">
                  {activeTab === 'gap' ? 'Analysiere Webseite...' : 
                   activeTab === 'spy' ? 'Vergleiche mit Konkurrenz...' : 
                   activeTab === 'trends' ? 'Recherchiere Keyword-Trends...' :
                   activeTab === 'schema' ? 'Extrahiere und analysiere Schema-Daten...' : 
                   activeTab === 'news' ? 'Crawle und analysiere Nachrichten...' :
                   'Generiere Inhalte...'}
                </p>
              </div>

              <div className="w-full h-1.5 bg-surface-tertiary rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 w-1/3 rounded-full animate-indeterminate-bar"></div>
              </div>
           </div>
        </div>
      )}

      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-strong tracking-tight flex items-center gap-3">
            <Magic className="text-indigo-600" />
            KI Content Suite
          </h1>
          <p className="text-muted mt-1">Nutzen Sie KI-Tools zur Optimierung Ihrer Inhalte.</p>
        </div>

        <div className="w-full md:w-80">
          <label className="block text-xs font-semibold text-muted mb-1 ml-1 uppercase tracking-wider">Aktives Projekt</label>
          <div className="relative">
            <select
              className="w-full p-3 pl-10 bg-surface border border-theme-border-default rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm appearance-none transition-all font-medium text-body"
              value={selectedProjectId}
              onChange={(e) => {
                setSelectedProjectId(e.target.value);
                setSelectedKeywords([]); 
                setGeneratedContent('');
                setTrendTopic('');
                setCustomKeywords('');
                setNewsTopic('');
                setContentBrief({
                  landingpage: '',
                  topic: '',
                  region: 'AT',
                  targetAudience: '',
                  goal: 'research',
                  brandMode: 'with-brand',
                });
              }}
              disabled={loadingProjects}
            >
              <option value="">-- Projekt wählen --</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.domain}
                </option>
              ))}
            </select>
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-500 pointer-events-none">
              <Grid size={16} />
            </div>
          </div>
        </div>
      </div>

      <div className="dashboard-widget-surface rounded-lg p-2 flex flex-col sm:flex-row gap-2">
        {[
          { id: 'setup' as SuiteView, label: 'Setup', description: '5 Schritte und Content Brief' },
          { id: 'tools' as SuiteView, label: 'Tools', description: 'Generatoren, Analyse und Research' },
        ].map(item => (
          <button
            key={item.id}
            type="button"
            onClick={() => setSuiteView(item.id)}
            className={`flex-1 rounded-md border px-4 py-3 text-left transition-all ${
              suiteView === item.id
                ? 'border-theme-border-default bg-surface-secondary text-strong shadow-sm'
                : 'border-transparent text-muted hover:bg-surface-secondary/70 hover:text-body'
            }`}
          >
            <div className="text-sm font-bold">{item.label}</div>
            <div className="text-xs mt-0.5">{item.description}</div>
          </button>
        ))}
      </div>

      {/* SETUP */}
      {suiteView === 'setup' && (
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
        <div className="xl:col-span-8 dashboard-widget-surface rounded-lg p-5">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-6">
            {workflowSteps.map((item, index) => (
              <div key={item.step} className="rounded-lg bg-surface-secondary/80 border border-theme-border-subtle p-3 min-h-[124px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-muted">{item.step}</span>
                  <span className={`h-2 w-2 rounded-full ${index === 0 ? 'bg-indigo-500' : 'bg-surface-tertiary'}`} />
                </div>
                <h3 className="text-sm font-bold text-heading mt-3">{item.title}</h3>
                <p className="text-xs text-muted leading-relaxed mt-1">{item.text}</p>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="text-base font-bold text-heading">Content Brief</h2>
              <p className="text-xs text-muted">Diese Angaben werden als gemeinsamer Kontext an die Tools übergeben.</p>
            </div>
            <span className="hidden sm:inline-flex text-[11px] font-semibold px-2 py-1 rounded-md bg-surface-secondary text-muted border border-theme-border-subtle">
              Standard
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-muted mb-1 uppercase tracking-wider">Zielseite / Landingpage</label>
              <input
                value={contentBrief.landingpage}
                onChange={(e) => updateContentBrief('landingpage', e.target.value)}
                placeholder="https://domain.at/leistung oder /zielseite"
                className="w-full p-3 bg-surface-secondary border border-theme-border-default rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-body"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted mb-1 uppercase tracking-wider">Thema</label>
              <input
                value={contentBrief.topic}
                onChange={(e) => {
                  updateContentBrief('topic', e.target.value);
                  if (!trendTopic) setTrendTopic(e.target.value);
                  if (!newsTopic) setNewsTopic(e.target.value);
                }}
                placeholder="z.B. Führerscheinentzug Österreich"
                className="w-full p-3 bg-surface-secondary border border-theme-border-default rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-body"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted mb-1 uppercase tracking-wider">Region</label>
              <select
                value={contentBrief.region}
                onChange={(e) => {
                  updateContentBrief('region', e.target.value);
                  setTrendCountry(e.target.value);
                }}
                className="w-full p-3 bg-surface-secondary border border-theme-border-default rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-body"
              >
                {COUNTRIES.map(country => (
                  <option key={country.code} value={country.code}>{country.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted mb-1 uppercase tracking-wider">Zielgruppe</label>
              <input
                value={contentBrief.targetAudience}
                onChange={(e) => updateContentBrief('targetAudience', e.target.value)}
                placeholder="z.B. Entscheider, Mandanten, lokale Kunden"
                className="w-full p-3 bg-surface-secondary border border-theme-border-default rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-body"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 mt-4 pt-4 border-t border-theme-border-subtle">
            <div className="flex rounded-xl border border-theme-border-default overflow-hidden bg-surface-secondary">
              {[
                ['research', 'Recherche'],
                ['optimize', 'Optimieren'],
                ['generate', 'Generieren'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => updateContentBrief('goal', value as ContentBrief['goal'])}
                  className={`px-3 py-2 text-xs font-semibold transition-colors ${contentBrief.goal === value ? 'bg-indigo-600 text-white' : 'text-secondary hover:text-body'}`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex rounded-xl border border-theme-border-default overflow-hidden bg-surface-secondary">
              {[
                ['with-brand', 'Mit Brand'],
                ['without-brand', 'Ohne Brand'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => updateContentBrief('brandMode', value as ContentBrief['brandMode'])}
                  className={`px-3 py-2 text-xs font-semibold transition-colors ${contentBrief.brandMode === value ? 'bg-purple-600 text-white' : 'text-secondary hover:text-body'}`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="text-xs text-muted flex-1 min-w-[240px]">
              Brief wird bei Tool-Läufen mitgespeichert und dient als gemeinsame Arbeitsgrundlage.
            </div>
            <button
              type="button"
              onClick={() => setSuiteView('tools')}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-[#188BDB] px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[#1479BF]"
            >
              Weiter zu Tools
              <ArrowRight size={14} />
            </button>
          </div>
        </div>

        <div className="xl:col-span-4 dashboard-widget-surface rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-bold text-heading">Tool-Verlauf</h2>
              <p className="text-xs text-muted">Gespeicherte Läufe für dieses Projekt</p>
            </div>
            <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full">
              {toolRuns.length}
            </span>
          </div>

          {loadingRuns ? (
            <div className="text-sm text-muted py-8 text-center">Lade Verlauf...</div>
          ) : toolRuns.length > 0 ? (
            <div className="space-y-2 max-h-[260px] overflow-y-auto custom-scrollbar pr-1">
              {toolRuns.map(run => (
                <div key={run.id} className="rounded-xl bg-surface-secondary border border-theme-border-subtle p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-body truncate">{run.tool}</span>
                    <span className="text-[11px] text-faint whitespace-nowrap">
                      {new Date(run.createdAt).toLocaleDateString('de-AT')}
                    </span>
                  </div>
                  {run.contentBrief?.topic && (
                    <div className="text-xs text-indigo-600 mt-1 truncate">{run.contentBrief.topic}</div>
                  )}
                  {run.dataSources && run.dataSources.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {run.dataSources.map(source => (
                        <span key={source} className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-surface text-muted border border-theme-border-subtle">
                          {source}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl bg-surface-secondary border border-dashed border-theme-border-default p-5 text-center">
              <FileText className="text-2xl text-faint mx-auto mb-2" />
              <p className="text-sm text-muted">Noch keine gespeicherten KI-Läufe.</p>
            </div>
          )}
        </div>
      </div>
      )}

      {suiteView === 'tools' && (
      <>
      {/* TOOL AUSWAHL */}
      <div className="dashboard-widget-surface rounded-lg p-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-base font-bold text-heading">Tool-Sammlung</h2>
            <p className="text-xs text-muted">Wähle ein Werkzeug. Der Content Brief aus dem Setup bleibt als Kontext erhalten.</p>
          </div>
          <button
            type="button"
            onClick={() => setSuiteView('setup')}
            className="hidden sm:inline-flex items-center rounded-md border border-theme-border-default bg-surface px-3 py-2 text-xs font-semibold text-body hover:bg-surface-secondary transition-colors"
          >
            Setup bearbeiten
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {toolItems.map(item => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`group rounded-lg border p-4 text-left transition-all ${
                activeTab === item.id
                  ? 'border-theme-border-default bg-surface shadow-sm'
                  : 'border-theme-border-subtle bg-surface-secondary/60 hover:bg-surface-secondary hover:shadow-sm'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${
                  activeTab === item.id ? 'bg-surface-tertiary text-indigo-600 border border-theme-border-default' : 'bg-surface text-muted border border-theme-border-subtle group-hover:text-body'
                }`}>
                  {item.icon}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-heading">{item.label}</div>
                  <div className="text-xs text-muted mt-0.5 leading-relaxed">{item.description}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      {!selectedProjectId ? (
        <div className="text-center py-20 bg-surface-secondary rounded-2xl border border-dashed border-theme-border-default">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-surface shadow-sm mb-4">
            <Magic className="text-faint text-2xl" />
            </div>
            <h3 className="text-lg font-medium text-heading">Kein Projekt ausgewählt</h3>
            <p className="text-muted mt-1">Bitte wählen Sie oben rechts ein Projekt aus.</p>
        </div>
      ) : (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          
          {/* Standard Tools (nicht CTR, nicht Landingpage, nicht AI-Visibility) */}
          {(activeTab !== 'ctr' && activeTab !== 'landingpage' && activeTab !== 'ai-visibility') && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              
              {/* LINKER BEREICH: INPUTS */}
              <div className="lg:col-span-4 space-y-6">
                
                {/* --- URL INPUTS FÜR SPY, GAP & SCHEMA --- */}
                {(activeTab === 'gap' || activeTab === 'spy' || activeTab === 'schema') && (
                  <div className="bg-surface border border-theme-border-subtle shadow-sm rounded-2xl p-6 space-y-4">
                    
                    {/* Input: ZU ANALYSIERENDE URL */}
                    <div>
                        <h2 className="text-sm font-semibold text-body mb-2 flex items-center gap-2">
                            <Globe className="text-indigo-500" /> 
                            {activeTab === 'schema' ? 'Zu analysierende URL' : 'Meine URL'}
                        </h2>
                        <input 
                            type="url" 
                            value={analyzeUrl}
                            onChange={(e) => setAnalyzeUrl(e.target.value)}
                            placeholder="https://meine-seite.de/artikel"
                            className="w-full p-3 bg-surface-secondary border border-theme-border-default rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                        />
                    </div>

                    {/* Input: GEGNER URL (Nur bei Spy - OPTIONAL) */}
                    {activeTab === 'spy' && (
                        <div className="pt-2 border-t border-theme-border-subtle animate-in slide-in-from-top-2">
                            <h2 className="text-sm font-semibold text-body mb-2 flex items-center gap-2">
                                <Binoculars className="text-rose-500" /> Konkurrenz URL 
                                <span className="text-xs font-normal text-faint">(optional)</span>
                            </h2>
                            <input 
                                type="url" 
                                value={competitorUrl}
                                onChange={(e) => setCompetitorUrl(e.target.value)}
                                placeholder="https://konkurrenz.de/besserer-artikel"
                                className="w-full p-3 bg-rose-50 border border-rose-100 rounded-xl text-sm focus:ring-2 focus:ring-rose-500 outline-none transition-all text-body placeholder-rose-300"
                            />
                        </div>
                    )}
                    
                    <p className="text-xs text-faint">
                        {activeTab === 'spy' 
                         ? (competitorUrl 
                            ? 'Vergleich: Wir analysieren beide Seiten.' 
                            : 'Einzelanalyse: Detaillierte Auswertung Ihrer Seite.')
                         : activeTab === 'schema'
                         ? 'Wir crawlen die Seite, extrahieren alle JSON-LD Schemas und prüfen auf fehlende Typen.'
                         : 'Wir prüfen diese Seite auf fehlende Keywords.'}
                    </p>
                  </div>
                )}
                
                {/* --- NEWS CRAWLER: TOPIC EINGABE --- */}
                {activeTab === 'news' && (
                  <div className="bg-surface border border-theme-border-subtle shadow-sm rounded-2xl p-6 space-y-4">
                    <div className="text-center pb-4 border-b border-theme-border-subtle">
                      <div className="w-14 h-14 bg-gradient-to-br from-indigo-100 to-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                        <Newspaper className="text-2xl text-indigo-600" />
                      </div>
                      <h3 className="font-bold text-heading">News-Crawler</h3>
                      <p className="text-xs text-muted mt-1">
                        Findet relevante News für interne Recherche.
                      </p>
                    </div>
                    
                    {/* TOPIC INPUT */}
                    <div>
                      <label className="text-sm font-semibold text-body mb-2 flex items-center gap-2">
                        <Search className="text-indigo-500" /> Suchbegriff / Topic
                      </label>
                      <input 
                        type="text" 
                        value={newsTopic}
                        onChange={(e) => setNewsTopic(e.target.value)}
                        placeholder="z.B. SEO Trends 2026, Grippe Welle News..."
                        className="w-full p-3 bg-surface-secondary border border-theme-border-default rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-body placeholder-faint"
                      />
                    </div>

                    {/* Beispiele */}
                    <div className="pt-3 border-t border-theme-border-subtle">
                      <p className="text-xs text-muted mb-2">Beispiele:</p>
                      <div className="flex flex-wrap gap-2">
                        {['SEO OnPage 2025', 'Google Updates News', 'KI Content Strategien', 'Datenschutz'].map((example) => (
                          <button
                            key={example}
                            onClick={() => setNewsTopic(example)}
                            className="px-2.5 py-1 bg-surface-tertiary hover:bg-indigo-100 text-secondary hover:text-indigo-700 rounded-lg text-xs transition-colors"
                          >
                            {example}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                
                {/* --- TREND RADAR: THEMEN EINGABE --- */}
                {activeTab === 'trends' && (
                  <div className="bg-surface border border-theme-border-subtle shadow-sm rounded-2xl p-6 space-y-4">
                    <div className="text-center pb-4 border-b border-theme-border-subtle">
                      <div className="w-14 h-14 bg-gradient-to-br from-emerald-100 to-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                        <GraphUpArrow className="text-2xl text-indigo-600" />
                      </div>
                      <h3 className="font-bold text-heading">Trend Radar</h3>
                      <p className="text-xs text-muted mt-1">
                        Finde Content-Chancen für <strong className="text-body">{selectedProject?.domain}</strong>
                      </p>
                    </div>
                    
                    {/* THEMEN INPUT */}
                    <div>
                      <label className="text-sm font-semibold text-body mb-2 flex items-center gap-2">
                        <Search className="text-emerald-500" /> Thema / Branche
                      </label>
                      <input 
                        type="text" 
                        value={trendTopic}
                        onChange={(e) => setTrendTopic(e.target.value)}
                        placeholder="z.B. Rechtsanwalt Wien, SEO Agentur..."
                        className="w-full p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-body placeholder-emerald-400"
                      />
                    </div>

                    {/* LÄNDER DROPDOWN */}
                    <div>
                      <label className="text-sm font-semibold text-body mb-2 flex items-center gap-2">
                        <GeoAlt className="text-indigo-500" /> Region
                      </label>
                      <select
                        value={trendCountry}
                        onChange={(e) => setTrendCountry(e.target.value)}
                        className="w-full p-3 bg-surface border border-theme-border-default rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-body"
                      >
                        {COUNTRIES.map((country) => (
                          <option key={country.code} value={country.code}>
                            {country.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Beispiele */}
                    <div className="pt-3 border-t border-theme-border-subtle">
                      <p className="text-xs text-muted mb-2">Beispiele:</p>
                      <div className="flex flex-wrap gap-2">
                        {['Rechtsanwalt Wien', 'SEO Agentur', 'Zahnarzt Linz', 'Nachhilfe Mathematik'].map((example) => (
                          <button
                            key={example}
                            onClick={() => setTrendTopic(example)}
                            className="px-2.5 py-1 bg-surface-tertiary hover:bg-indigo-100 text-secondary hover:text-indigo-700 rounded-lg text-xs transition-colors"
                          >
                            {example}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* --- KEYWORD LISTE (für Fragen & Gap) --- */}
                {(activeTab === 'questions' || activeTab === 'gap') && ( 
                  <>
                    {/* GSC Keywords */}
                    <div className="bg-surface border border-theme-border-subtle shadow-sm rounded-2xl p-6 flex flex-col h-[350px]">
                      <div className="flex justify-between items-center mb-4">
                        <h2 className="font-semibold text-strong">Keywords aus GSC</h2>
                        <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full">
                          {selectedKeywords.length} gewählt
                        </span>
                      </div>
                      
                      {loadingData ? (
                          <div className="flex items-center justify-center flex-1"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div></div>
                      ) : keywords.length > 0 ? (
                        <div className="overflow-y-auto flex-1 space-y-2 pr-2 custom-scrollbar">
                          {keywords.map((kw, idx) => (
                            <div 
                              key={idx}
                              onClick={() => toggleKeyword(kw.query)}
                              className={`
                                cursor-pointer p-2.5 rounded-lg border text-sm flex items-center gap-2 transition-all
                                ${selectedKeywords.includes(kw.query) ? 'bg-indigo-50 border-indigo-200 text-indigo-800' : 'bg-surface border-theme-border-subtle hover:bg-surface-secondary'}
                              `}
                            >
                               <div className={`w-4 h-4 rounded border flex items-center justify-center ${selectedKeywords.includes(kw.query) ? 'bg-indigo-600 border-indigo-600' : 'border-theme-border-default'}`}>
                                  {selectedKeywords.includes(kw.query) && <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                               </div>
                               <span className="truncate flex-1">{kw.query}</span>
                               <span className="text-xs text-faint tabular-nums">{kw.clicks}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                          <div className="text-center text-sm text-faint mt-10">Keine GSC-Daten verfügbar</div>
                      )}
                    </div>

                    {/* EIGENE KEYWORDS EINGABE */}
                    <div className="bg-surface border border-theme-border-subtle shadow-sm rounded-2xl p-6">
                      <div className="flex justify-between items-center mb-3">
                        <h2 className="font-semibold text-strong flex items-center gap-2">
                          <PlusCircle className="text-emerald-500" /> Eigene Keywords
                        </h2>
                        {customKeywords.trim() && (
                          <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                            +{customKeywords.split(/[,\n]+/).filter(k => k.trim()).length}
                          </span>
                        )}
                      </div>
                      
                      <textarea
                        value={customKeywords}
                        onChange={(e) => setCustomKeywords(e.target.value)}
                        placeholder="Keywords eingeben (Komma oder Zeilenumbruch getrennt)&#10;&#10;z.B.:&#10;keyword 1, keyword 2&#10;keyword 3"
                        className="w-full p-3 bg-surface-secondary border border-theme-border-default rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all resize-none h-24"
                      />
                      <p className="text-xs text-faint mt-2">
                        Zusätzliche Keywords die nicht in GSC sind.
                      </p>
                    </div>

                    {/* GESAMT KEYWORDS ANZEIGE */}
                    {totalKeywordCount > 0 && (
                      <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 flex items-center justify-between">
                        <span className="text-sm text-indigo-700">Gesamt Keywords:</span>
                        <span className="font-bold text-indigo-700">{totalKeywordCount}</span>
                      </div>
                    )}
                  </>
                )}

                {/* --- ACTION BUTTON --- */}
                <div className="mt-4">
                    <Button
                      onClick={handleAction}
                      disabled={isGenerating}
                      className="w-full h-auto py-4 text-base gap-2 text-white" 
                    >
                      {isGenerating ? 'Arbeite...' : 
                       activeTab === 'news' ? <>News crawlen & analysieren <Newspaper/></> :
                       activeTab === 'trends' ? <>Trends recherchieren <GraphUpArrow/></> :
                       activeTab === 'spy' ? (competitorUrl ? <>Vergleich starten <Binoculars/></> : <>Seite analysieren <Binoculars/></>) :
                       activeTab === 'schema' ? <>Schema analysieren <CodeSquare/></> : 
                       activeTab === 'gap' ? 'Gap Analyse starten' : 
                       'Fragen generieren'}
                    </Button>
                </div>
              </div>

              {/* RECHTER BEREICH: OUTPUT */}
              <div className="lg:col-span-8">
                  <div className="dashboard-widget-surface rounded-lg p-6 h-full min-h-[600px] flex flex-col relative overflow-hidden">
                     <h2 className="text-lg font-semibold text-strong mb-4 z-10 flex items-center gap-2">
                       {activeTab === 'news' ? 'News-Crawler Report' :
                        activeTab === 'trends' ? 'Keyword Trends' :
                        activeTab === 'spy' ? (competitorUrl ? 'Konkurrenz Vergleich' : 'Webseiten Analyse') : 
                        activeTab === 'schema' ? 'Schema Analyse Report' : 
                        activeTab === 'gap' ? 'Content Gap Report' : 
                        'KI Ergebnis'}
                     </h2>

                     <div 
                       ref={outputRef}
                       className="flex-1 bg-surface-secondary/50 rounded-xl border border-theme-border-default/60 p-4 overflow-y-auto z-10 custom-scrollbar ai-output"
                     >
                       {generatedContent ? (
                         <div 
                           className="ai-content"
                           dangerouslySetInnerHTML={{ __html: generatedContent }} 
                         />
                       ) : (
                         <div className="h-full flex flex-col items-center justify-center text-faint text-center p-8">
                            {activeTab === 'news' ? (
                                <>
                                    <Newspaper className="text-4xl mb-3 text-indigo-200" />
                                    <p className="font-medium text-muted">Interne Weiterbildung</p>
                                    <p className="text-xs mt-2">Geben Sie einen Suchbegriff ein, um aktuelle Artikel zu crawlen und analysieren.</p>
                                </>
                            ) : activeTab === 'trends' ? (
                                <>
                                    <GraphUpArrow className="text-4xl mb-3 text-emerald-200" />
                                    <p className="font-medium text-muted">Keyword-Trends entdecken</p>
                                    <p className="text-xs mt-2">Geben Sie links ein Thema ein und wählen Sie die Region.</p>
                                </>
                            ) : activeTab === 'spy' ? (
                                <>
                                    <Binoculars className="text-4xl mb-3 text-rose-200" />
                                    <p className="font-medium text-muted">Webseiten Analyse</p>
                                    <p className="text-xs mt-2 text-faint">
                                      Nur Ihre URL → Detaillierte Einzelanalyse<br/>
                                      Mit Konkurrenz URL → Vergleichsanalyse
                                    </p>
                                </>
                            ) : activeTab === 'schema' ? (
                                <>
                                    <CodeSquare className="text-4xl mb-3 text-indigo-200" />
                                    <p className="font-medium text-muted">Schema Analyzer</p>
                                    <p className="text-xs mt-2">URL eingeben, um Strukturierte Daten zu analysieren.</p>
                                </>
                            ) : activeTab === 'gap' ? (
                                <>
                                    <FileEarmarkBarGraph className="text-4xl mb-3 text-indigo-200" />
                                    <p className="font-medium text-muted">Content Gap Analyse</p>
                                    <p className="text-xs mt-2">URL eingeben & Keywords wählen oder eigene eingeben.</p>
                                </>
                            ) : (
                                <>
                                    <Magic className="text-4xl mb-3 text-indigo-200" />
                                    <p className="font-medium text-muted">Fragen Generator</p>
                                    <p className="text-xs mt-2">Keywords wählen oder eigene eingeben.</p>
                                </>
                            )}
                         </div>
                       )}
                     </div>
                  </div>
              </div>
            </div>
          )}

          {/* CTR BOOSTER */}
          {activeTab === 'ctr' && (
            <div className="w-full">
              <CtrBooster projectId={selectedProjectId} />
            </div>
          )}

          {/* LANDINGPAGE GENERATOR */}
          {activeTab === 'landingpage' && (
            <LandingpageGenerator
              projectId={selectedProjectId}
              domain={selectedProject?.domain || ''}
              keywords={keywords}
              loadingKeywords={loadingData}
              contentBrief={contentBrief}
            />
          )}

          {/* NEU: AI VISIBILITY CHECKER */}
          {activeTab === 'ai-visibility' && (
            <AiVisibilityChecker
              projectDomain={selectedProject?.domain}
            />
          )}
          
        </div>
      )}

      </>
      )}

      {false && (
      /* --- Alte Modul-Info-Boxen bleiben bewusst deaktiviert, weil die Tool-Karten diese Rolle übernehmen. --- */
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-10 border-t border-theme-border-default animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        {/* Box 1: Fragen */}
        <div className="bg-surface p-6 rounded-2xl border border-theme-border-subtle shadow-sm hover:shadow-md transition-shadow">
           <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center mb-4 text-indigo-600">
              <ChatText size={20} />
           </div>
           <h3 className="font-bold text-heading mb-2">Fragen Generator</h3>
           <div className="text-sm text-secondary space-y-2 leading-relaxed">
              <p><span className="font-semibold text-strong text-xs uppercase tracking-wide">Aktion:</span> Generiert Fragen aus Keywords.</p>
              <p><span className="font-semibold text-strong text-xs uppercase tracking-wide">Ziel:</span> Neue Content-Ideen finden.</p>
              
              <p className="pt-2 text-xs text-muted border-t border-theme-border-subtle mt-2">
                💡 Wichtig für KI wie ChatGPT, Gemini usw. (Suchintention etc.)
              </p>
           </div>
        </div>

        {/* Box 2: Gap Analyse */}
        <div className="bg-surface p-6 rounded-2xl border border-theme-border-subtle shadow-sm hover:shadow-md transition-shadow">
           <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center mb-4 text-indigo-600">
              <FileEarmarkBarGraph size={20} />
           </div>
           <h3 className="font-bold text-heading mb-2">Gap Analyse</h3>
           <div className="text-sm text-secondary space-y-2 leading-relaxed">
              <p><span className="font-semibold text-strong text-xs uppercase tracking-wide">Aktion:</span> Prüft URL auf fehlende Keywords.</p>
              <p><span className="font-semibold text-strong text-xs uppercase tracking-wide">Ziel:</span> Rankings verbessern.</p>
              
              <p className="pt-2 text-xs text-muted border-t border-theme-border-subtle mt-2">
                💡 Deckt inhaltliche Lücken auf für bessere Rankings (Holistic Content).
              </p>
           </div>
        </div>

        {/* Box 3: Competitor Spy */}
        <div className="bg-surface p-6 rounded-2xl border border-theme-border-subtle shadow-sm hover:shadow-md transition-shadow">
           <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center mb-4 text-indigo-600">
              <Binoculars size={20} />
           </div>
           <h3 className="font-bold text-heading mb-2">Competitor Spy</h3>
           <div className="text-sm text-secondary space-y-2 leading-relaxed">
              <p><span className="font-semibold text-strong text-xs uppercase tracking-wide">Aktion:</span> Analysiert eine oder zwei URLs.</p>
              <p><span className="font-semibold text-strong text-xs uppercase tracking-wide">Ziel:</span> Technik, Features & SEO bewerten.</p>
              
              <p className="pt-2 text-xs text-muted border-t border-theme-border-subtle mt-2">
                💡 Einzelanalyse oder Vergleich mit Konkurrenz möglich.
              </p>
           </div>
        </div>

        {/* Box 4: Schema Analyzer */}
        <div className="bg-surface p-6 rounded-2xl border border-theme-border-subtle shadow-sm hover:shadow-md transition-shadow">
           <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center mb-4 text-indigo-600">
              <CodeSquare size={20} />
           </div>
           <h3 className="font-bold text-heading mb-2">Schema Analyzer</h3>
           <div className="text-sm text-secondary space-y-2 leading-relaxed">
              <p><span className="font-semibold text-strong text-xs uppercase tracking-wide">Aktion:</span> Extrahiert & bewertet JSON-LD.</p>
              <p><span className="font-semibold text-strong text-xs uppercase tracking-wide">Ziel:</span> Rich Snippets freischalten.</p>
              
              <p className="pt-2 text-xs text-muted border-t border-theme-border-subtle mt-2">
                💡 Prüft auf fehlende Schemas (z.B. FAQ, LocalBusiness) und generiert Code.
              </p>
           </div>
        </div>

        {/* Box 5: News-Crawler */}
        <div className="bg-surface p-6 rounded-2xl border border-theme-border-subtle shadow-sm hover:shadow-md transition-shadow">
           <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center mb-4 text-indigo-600">
              <Newspaper size={20} />
           </div>
           <h3 className="font-bold text-heading mb-2">News-Crawler</h3>
           <div className="text-sm text-secondary space-y-2 leading-relaxed">
              <p><span className="font-semibold text-strong text-xs uppercase tracking-wide">Aktion:</span> Crawlt & analysiert News zum Topic.</p>
              <p><span className="font-semibold text-strong text-xs uppercase tracking-wide">Ziel:</span> Interne Recherche optimieren.</p>
              
              <p className="pt-2 text-xs text-muted border-t border-theme-border-subtle mt-2">
                💡 Top-Artikel werden gecrawlt, zusammengefasst und Relevanz bewertet.
              </p>
           </div>
        </div>

        {/* Box 6: Landingpage Generator */}
        <div className="bg-surface p-6 rounded-2xl border border-theme-border-subtle shadow-sm hover:shadow-md transition-shadow">
           <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center mb-4 text-purple-600">
              <FileText size={20} />
           </div>
           <h3 className="font-bold text-heading mb-2">Landingpage Generator</h3>
           <div className="text-sm text-secondary space-y-2 leading-relaxed">
              <p><span className="font-semibold text-strong text-xs uppercase tracking-wide">Aktion:</span> Erstellt SEO-Content aus allen Datenquellen.</p>
              <p><span className="font-semibold text-strong text-xs uppercase tracking-wide">Ziel:</span> Schnell rankende Landingpages.</p>
              
              <p className="pt-2 text-xs text-muted border-t border-theme-border-subtle mt-2">
                💡 Kombiniert GSC-Keywords, News und Gap-Analysen zu perfektem Content.
              </p>
           </div>
        </div>

        {/* Box 7: KI-Sichtbarkeit (NEU) */}
        <div className="bg-surface p-6 rounded-2xl border border-theme-border-subtle shadow-sm hover:shadow-md transition-shadow">
           <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center mb-4 text-purple-600">
              <Robot size={20} />
           </div>
           <h3 className="font-bold text-heading mb-2">KI-Sichtbarkeit</h3>
           <div className="text-sm text-secondary space-y-2 leading-relaxed">
              <p><span className="font-semibold text-strong text-xs uppercase tracking-wide">Aktion:</span> Prüft ob Domain in KI-Antworten erwähnt wird.</p>
              <p><span className="font-semibold text-strong text-xs uppercase tracking-wide">Ziel:</span> Sichtbarkeit in ChatGPT, Gemini etc. optimieren.</p>
              
              <p className="pt-2 text-xs text-muted border-t border-theme-border-subtle mt-2">
                💡 Testet live mit Gemini API und analysiert Schema.org & E-E-A-T Signale.
              </p>
           </div>
        </div>
        
        {/* Box 8: Trend Radar */}
        <div className="bg-surface p-6 rounded-2xl border border-theme-border-subtle shadow-sm hover:shadow-md transition-shadow">
           <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center mb-4 text-emerald-600">
              <GraphUpArrow size={20} />
           </div>
           <h3 className="font-bold text-heading mb-2">Trend Radar</h3>
           <div className="text-sm text-secondary space-y-2 leading-relaxed">
              <p><span className="font-semibold text-strong text-xs uppercase tracking-wide">Aktion:</span> Findet Keyword-Trends für ein Thema.</p>
              <p><span className="font-semibold text-strong text-xs uppercase tracking-wide">Ziel:</span> Content-Chancen früh erkennen.</p>
              
              <p className="pt-2 text-xs text-muted border-t border-theme-border-subtle mt-2">
                💡 First-Mover-Vorteil: Ranke für Trends bevor die Konkurrenz reagiert.
              </p>
           </div>
        </div>

        {/* Box 9: CTR Booster */}
        <div className="bg-surface p-6 rounded-2xl border border-theme-border-subtle shadow-sm hover:shadow-md transition-shadow">
           <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center mb-4 text-indigo-600">
              <RocketTakeoff size={20} />
           </div>
           <h3 className="font-bold text-heading mb-2">CTR Booster</h3>
           <div className="text-sm text-secondary space-y-2 leading-relaxed">
              <p><span className="font-semibold text-strong text-xs uppercase tracking-wide">Aktion:</span> Optimiert Titel & Beschreibung.</p>
              <p><span className="font-semibold text-strong text-xs uppercase tracking-wide">Ziel:</span> Klickrate (CTR) erhöhen.</p>
              
              <p className="pt-2 text-xs text-muted border-t border-theme-border-subtle mt-2">
                 💡 Mehr Klicks senden positive Signale an den Google-Algorithmus.
              </p>
           </div>
        </div>

      </div>
      )}
      
      <style jsx global>{`
        @keyframes indeterminate-bar {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
        .animate-indeterminate-bar {
          animation: indeterminate-bar 1.5s infinite linear;
        }
        .animate-spin-slow {
            animation: spin 3s linear infinite;
        }
        
        /* ============================================
           AI OUTPUT STYLES - Überschreibt KI-generiertes HTML
           ============================================ */
        .ai-output {
          font-family: system-ui, -apple-system, sans-serif;
          font-size: 14px;
          line-height: 1.5;
          color: #374151;
        }
        
        .ai-content {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        
        /* Überschriften */
        .ai-content h3 {
          font-size: 15px !important;
          font-weight: 700 !important;
          color: #111827 !important;
          margin: 16px 0 8px 0 !important;
          padding: 0 !important;
          display: flex !important;
          align-items: center !important;
          gap: 8px !important;
        }
        
        .ai-content h3:first-child {
          margin-top: 0 !important;
        }
        
        .ai-content h4 {
          font-size: 15px !important;
          font-weight: 600 !important;
          color: #6b7280 !important;
          text-transform: uppercase !important;
          letter-spacing: 0.05em !important;
          margin: 0 0 8px 0 !important;
          padding: 0 !important;
        }
        
        /* Absätze */
        .ai-content p {
          font-size: 14px !important;
          line-height: 1.6 !important;
          color: #4b5563 !important;
          margin: 0 0 8px 0 !important;
          padding: 0 !important;
        }
        
        .ai-content p:last-child {
          margin-bottom: 0 !important;
        }
        
        /* Listen */
        .ai-content ul, .ai-content ol {
          margin: 0 0 8px 0 !important;
          padding: 0 !important;
          list-style: none !important;
        }
        
        .ai-content li {
          font-size: 14px !important;
          color: #374151 !important;
          padding: 6px 0 !important;
          margin: 0 !important;
          display: flex !important;
          align-items: flex-start !important;
          gap: 8px !important;
          border-bottom: 1px solid #f3f4f6 !important;
        }
        
        .ai-content li:last-child {
          border-bottom: none !important;
        }
        
        /* Cards & Boxen */
        .ai-content > div {
          margin-bottom: 12px !important;
        }
        
        .ai-content [class*="bg-surface"] {
          background: white !important;
          border: 1px solid #e5e7eb !important;
          border-radius: 8px !important;
          padding: 12px !important;
          margin-bottom: 8px !important;
        }
        
        .ai-content [class*="bg-surface-secondary"] {
          background: #f9fafb !important;
          border: 1px solid #e5e7eb !important;
          border-radius: 8px !important;
          padding: 12px !important;
        }
        
        .ai-content [class*="bg-blue-50"],
        .ai-content [class*="bg-indigo-50"] {
          background: #eef2ff !important;
          border: 1px solid #c7d2fe !important;
          border-radius: 8px !important;
          padding: 12px !important;
        }
        
        .ai-content [class*="bg-emerald-50"],
        .ai-content [class*="bg-green-50"] {
          background: #ecfdf5 !important;
          border: 1px solid #a7f3d0 !important;
          border-radius: 8px !important;
          padding: 12px !important;
        }
        
        .ai-content [class*="bg-amber-50"],
        .ai-content [class*="bg-yellow-50"] {
          background: #fffbeb !important;
          border: 1px solid #fcd34d !important;
          border-radius: 8px !important;
          padding: 12px !important;
        }
        
        .ai-content [class*="bg-rose-50"],
        .ai-content [class*="bg-red-50"] {
          background: #fef2f2 !important;
          border: 1px solid #fecaca !important;
          border-radius: 8px !important;
          padding: 12px !important;
        }
        
        .ai-content [class*="bg-indigo-600"],
        .ai-content [class*="bg-purple-600"],
        .ai-content [class*="from-indigo"],
        .ai-content [class*="from-purple"],
        .ai-content [class*="bg-gradient"] {
          background: white !important;
          color: #111827 !important;
          border: 1px solid #e5e7eb !important;
          border-radius: 8px !important;
          padding: 12px !important;
        }
        
        /* Grid */
        .ai-content [class*="grid-cols-2"] {
          display: grid !important;
          grid-template-columns: 1fr 1fr !important;
          gap: 12px !important;
        }
        
        .ai-content [class*="grid-cols-3"] {
          display: grid !important;
          grid-template-columns: 1fr 1fr 1fr !important;
          gap: 12px !important;
        }
        
        .ai-content [class*="grid-cols-4"] {
          display: grid !important;
          grid-template-columns: 1fr 1fr 1fr 1fr !important;
          gap: 8px !important;
        }
        
        /* Badges */
        .ai-content span[class*="bg-"][class*="text-"][class*="px-"] {
          font-size: 14px !important;
          font-weight: 600 !important;
          padding: 3px 8px !important;
          border-radius: 6px !important;
          display: inline-flex !important;
          align-items: center !important;
          gap: 4px !important;
        }
        
        /* Icons */
        .ai-content i[class*="bi-"] {
          font-size: 16px !important;
          line-height: 1 !important;
        }
        
        /* Metric Cards */
        .ai-content [class*="text-center"] [class*="text-xl"],
        .ai-content [class*="text-center"] [class*="text-2xl"],
        .ai-content [class*="text-center"] [class*="text-lg"] {
          font-size: 20px !important;
          font-weight: 700 !important;
          color: #111827 !important;
        }
        
        .ai-content [class*="text-center"] [class*="uppercase"] {
          font-size: 10px !important;
          color: #6b7280 !important;
          margin-top: 2px !important;
        }
        
        /* Flex Layout Fixes */
        .ai-content [class*="flex"][class*="items-center"] {
          display: flex !important;
          align-items: center !important;
        }
        
        .ai-content [class*="flex"][class*="items-start"] {
          display: flex !important;
          align-items: flex-start !important;
        }
        
        .ai-content [class*="flex"][class*="justify-between"] {
          justify-content: space-between !important;
        }
        
        .ai-content [class*="gap-1"] { gap: 4px !important; }
        .ai-content [class*="gap-2"] { gap: 8px !important; }
        .ai-content [class*="gap-3"] { gap: 12px !important; }
        .ai-content [class*="gap-4"] { gap: 16px !important; }
        
        /* Space-y Overrides */
        .ai-content [class*="space-y-1"] > * + * { margin-top: 4px !important; }
        .ai-content [class*="space-y-2"] > * + * { margin-top: 8px !important; }
        .ai-content [class*="space-y-3"] > * + * { margin-top: 12px !important; }
        
        /* Border-Left für Fazit-Boxen */
        .ai-content [class*="border-l-4"] {
          border-left-width: 4px !important;
          border-left-style: solid !important;
          border-radius: 0 8px 8px 0 !important;
        }
        
        /* Text Farben */
        .ai-content [class*="text-emerald-"] { color: #059669 !important; }
        .ai-content [class*="text-rose-"] { color: #e11d48 !important; }
        .ai-content [class*="text-amber-"] { color: #d97706 !important; }
        .ai-content [class*="text-blue-"] { color: #2563eb !important; }
        .ai-content [class*="text-indigo-"] { color: #4f46e5 !important; }
        .ai-content [class*="text-purple-"] { color: #7c3aed !important; }
        .ai-content [class*="text-faint"] { color: #9ca3af !important; }
        .ai-content [class*="text-muted"] { color: #6b7280 !important; }
        .ai-content [class*="text-secondary"] { color: #4b5563 !important; }
        .ai-content [class*="text-body"] { color: #374151 !important; }
        .ai-content [class*="text-strong"] { color: #1f2937 !important; }
        .ai-content [class*="text-heading"] { color: #111827 !important; }
        
        /* Strong/Bold */
        .ai-content strong, .ai-content b {
          font-weight: 600 !important;
          color: #111827 !important;
        }
        
        /* Subpage Items */
        .ai-content [class*="subpage"], 
        .ai-content [class*="border-b"][class*="py-1"] {
          padding: 6px 0 !important;
          font-size: 14px !important;
          border-bottom: 1px solid #f3f4f6 !important;
        }
        
        /* Step Numbers */
        .ai-content [class*="rounded-full"][class*="bg-indigo"] {
          width: 20px !important;
          height: 20px !important;
          font-size: 10px !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          flex-shrink: 0 !important;
        }
      `}</style>
    </div>
  );
}
