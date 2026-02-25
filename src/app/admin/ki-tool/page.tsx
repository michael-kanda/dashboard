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

type Tab = 'questions' | 'ctr' | 'gap' | 'spy' | 'trends' | 'schema' | 'news' | 'landingpage' | 'ai-visibility'; // ERWEITERT

// Länder-Optionen
const COUNTRIES = [
  { code: 'AT', label: '🇦🇹 Österreich', lang: 'de' },
  { code: 'DE', label: '🇩🇪 Deutschland', lang: 'de' },
  { code: 'CH', label: '🇨🇭 Schweiz', lang: 'de' },
  { code: 'US', label: '🇺🇸 USA', lang: 'en' },
];

export default function KiToolPage() {
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

  const outputRef = useRef<HTMLDivElement>(null);

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

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        const chunkValue = decoder.decode(value, { stream: true });
        setGeneratedContent((prev) => prev + chunkValue);
        
        if (outputRef.current) {
            outputRef.current.scrollTop = outputRef.current.scrollHeight;
        }
      }

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

      {/* TABS */}
      <div className="border-b border-theme-border-default">
        <nav className="-mb-px flex space-x-8 overflow-x-auto">
          <button
            onClick={() => setActiveTab('questions')}
            className={`
              flex items-center gap-2 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors
              ${activeTab === 'questions' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-muted hover:text-body'}
            `}
          >
            <ChatText size={18} />
            Fragen
          </button>

          <button
            onClick={() => setActiveTab('gap')}
            className={`
              flex items-center gap-2 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors
              ${activeTab === 'gap' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-muted hover:text-body'}
            `}
          >
            <FileEarmarkBarGraph size={18} />
            Gap Analyse
          </button>

          <button
            onClick={() => setActiveTab('spy')}
            className={`
              flex items-center gap-2 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors
              ${activeTab === 'spy' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-muted hover:text-body'}
            `}
          >
            <Binoculars size={18} />
            Competitor Spy
          </button>

          <button
            onClick={() => setActiveTab('schema')}
            className={`
              flex items-center gap-2 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors
              ${activeTab === 'schema' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-muted hover:text-body'}
            `}
          >
            <CodeSquare size={18} />
            Schema Analyzer
          </button>
          
          <button
            onClick={() => setActiveTab('news')} 
            className={`
              flex items-center gap-2 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors
              ${activeTab === 'news' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-muted hover:text-body'}
            `}
          >
            <Newspaper size={18} />
            News-Crawler
          </button>

          {/* Landingpage Generator Tab */}
          <button
            onClick={() => setActiveTab('landingpage')}
            className={`
              flex items-center gap-2 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors
              ${activeTab === 'landingpage' ? 'border-purple-500 text-purple-600' : 'border-transparent text-muted hover:text-body'}
            `}
          >
            <FileText size={18} />
            Landingpage
          </button>

          {/* NEU: AI Visibility Check Tab */}
          <button
            onClick={() => setActiveTab('ai-visibility')}
            className={`
              flex items-center gap-2 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors
              ${activeTab === 'ai-visibility' ? 'border-purple-500 text-purple-600' : 'border-transparent text-muted hover:text-body'}
            `}
          >
            <Robot size={18} />
            KI-Sichtbarkeit
            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-600 text-[10px] font-bold">NEU</span>
          </button>

          <button
            onClick={() => setActiveTab('trends')}
            className={`
              flex items-center gap-2 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors
              ${activeTab === 'trends' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-muted hover:text-body'}
            `}
          >
            <GraphUpArrow size={18} />
            Trend Radar
            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-600 text-[10px] font-bold">BETA</span>
          </button>

          <button
            onClick={() => setActiveTab('ctr')}
            className={`
              flex items-center gap-2 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors
              ${activeTab === 'ctr' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-muted hover:text-body'}
            `}
          >
            <RocketTakeoff size={18} />
            CTR Booster
          </button>
        </nav>
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
                  <div className="bg-surface border border-theme-border-subtle shadow-xl rounded-2xl p-8 h-full min-h-[600px] flex flex-col relative overflow-hidden">
                     <div className="absolute top-0 right-0 w-64 h-64 bg-purple-100 rounded-full mix-blend-multiply filter blur-3xl opacity-30"></div>
                     <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-100 rounded-full mix-blend-multiply filter blur-3xl opacity-30"></div>

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

      {/* --- MODUL INFO-BOXEN (Volle Breite, immer sichtbar) --- */}
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
