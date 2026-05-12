/* src/components/AiAnalysisWidget.tsx */
'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { Lightbulb, ArrowRepeat, ExclamationTriangle, InfoCircle, GraphUpArrow } from 'react-bootstrap-icons';
import { getRangeLabel, DateRangeOption } from '@/components/DateRangeSelector';
import ExportButton from '@/components/ExportButton';

interface Props {
  projectId: string;
  domain?: string; // ✅ NEU: Prop für Domain
  dateRange: DateRangeOption;
  chartRef?: React.RefObject<HTMLDivElement>;
  kpis?: Array<{
    label: string;
    value: string | number;
    change?: number;
    unit?: string;
  }>;
  googleAdsData?: any; // ✅ Google Ads Daten (aus Sheet)
}

export default function AiAnalysisWidget({ 
  projectId, 
  domain, // ✅
  dateRange, 
  chartRef,
  kpis,
  googleAdsData, // ✅ Google Ads Daten
}: Props) {
  // Content States
  const [statusContent, setStatusContent] = useState('');
  const [analysisContent, setAnalysisContent] = useState('');
  
  // UI States
  const [isLoading, setIsLoading] = useState(false);
  const [isStreamComplete, setIsStreamComplete] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isPrefetched, setIsPrefetched] = useState(false);
  
  // Dynamischer Teaser Text
  const [teaserText, setTeaserText] = useState('');

  const abortControllerRef = useRef<AbortController | null>(null);

  const generateTeaser = (rangeLabelText: string) => {
    const teasers = [
      `Der Datensatz für ${rangeLabelText} ist vollständig importiert und wartet auf Sie. Soll ich die Auswertung jetzt starten?`,
      `Wollen wir herausfinden, welche Themengebiete nicht nur Besucher anlocken, sondern sie auch zu Kunden machen?`,
      `Die Zahlen für ${rangeLabelText} sind bereit zur Verknüpfung. Sollen wir die Analyse beginnen, um Ursache und Wirkung zu verstehen?`,
      `Die Performance-Daten für ${rangeLabelText} halten neue Insights bereit. Wollen Sie wissen, welche Maßnahmen am besten gegriffen haben?`,
      `Soll ich prüfen, bei welchen Suchanfragen die Besucher am längsten auf Ihrer Seite verweilen und wirklich lesen?`,
      `Die Daten liegen vor. Soll ich identifizieren, welche Landingpages das Interesse der Google-Nutzer am besten in Handlungen verwandeln?`
    ];
    return teasers[Math.floor(Math.random() * teasers.length)];
  };

  const rangeLabel = getRangeLabel(dateRange).toLowerCase();

  useEffect(() => {
    setStatusContent('');
    setAnalysisContent('');
    setError(null);
    setIsStreamComplete(false);
    setIsPrefetched(false);
    setTeaserText('');

    const prefetchData = async () => {
      if (!projectId) return;
      
      setTeaserText(generateTeaser(getRangeLabel(dateRange)));

      console.log(`[AI Widget] 🚀 Starte Pre-Fetching für Zeitraum: ${dateRange}`);
      try {
        await fetch(`/api/projects/${projectId}?dateRange=${dateRange}`, {
          priority: 'low'
        });
        
        setIsPrefetched(true);
        console.log('[AI Widget] ✅ Pre-Fetching abgeschlossen.');
      } catch (e) {
        console.warn('[AI Widget] Pre-Fetching fehlgeschlagen (nicht kritisch):', e);
      }
    };

    prefetchData();
  }, [projectId, dateRange]);

  const handleAnalyze = async () => {
    setIsLoading(true);
    setIsStreamComplete(false);
    setError(null);
    setStatusContent('');
    setAnalysisContent('');

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      // ✅ Google Ads: Nur Totals + Top-Kampagnen mitsenden (Payload klein halten)
      const adsPayload = googleAdsData?.totals ? {
        totals: googleAdsData.totals,
        campaignRows: (googleAdsData.campaignRows || googleAdsData.rows || []).slice(0, 20),
        source: googleAdsData.source,
      } : undefined;

      const response = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, dateRange, googleAdsData: adsPayload }),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) throw new Error('Verbindung fehlgeschlagen');
      if (!response.body) throw new Error('Kein Stream');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      
      let lastUpdateTime = 0;
      const UPDATE_INTERVAL = 50;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        fullText += chunk;

        const now = Date.now();
        if (now - lastUpdateTime > UPDATE_INTERVAL) {
          parseAndSetContent(fullText);
          lastUpdateTime = now;
        }
      }
      
      parseAndSetContent(fullText);
      setIsStreamComplete(true);

    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error(err);
        setError(err);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const parseAndSetContent = (text: string) => {
    const marker = '[[SPLIT]]';
    if (text.includes(marker)) {
      const [part1, part2] = text.split(marker);
      setStatusContent(part1);
      setAnalysisContent(part2);
    } else {
      setStatusContent(text);
    }
  };

  // UI Renders (gekürzt für Übersichtlichkeit, Logik bleibt gleich)
  if (!statusContent && !isLoading && !error) {
    return (
      <div className="relative group mb-6">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-blue-500 rounded-2xl opacity-5 group-hover:opacity-15 transition duration-700 blur-sm"></div>
        <div className="relative bg-surface rounded-xl p-6 flex flex-col sm:flex-row items-center gap-6 shadow-sm border border-theme-border-subtle">
          <div className="relative shrink-0">
            <div className={`absolute inset-0 rounded-2xl opacity-10 animate-pulse ${isPrefetched ? 'bg-emerald-500' : 'bg-indigo-500'}`}></div>
            <div className={`relative p-1 rounded-2xl border-2 ${isPrefetched ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-indigo-500/10 border-indigo-500/30'}`}>
              <div className="relative w-20 h-20">
                <Image src="/data-max.webp" alt="Data Max AI Analyst" fill className="object-contain drop-shadow-sm" sizes="80px" priority />
              </div>
            </div>
            <span className={`absolute -top-1 -right-1 flex h-3 w-3`}>
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-50 ${isPrefetched ? 'bg-emerald-400' : 'bg-indigo-400'}`}></span>
              <span className={`relative inline-flex rounded-full h-3 w-3 ${isPrefetched ? 'bg-emerald-500' : 'bg-indigo-500'}`}></span>
            </span>
          </div>
          <div className="flex-1 text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-3 mb-2">
              <h3 className="text-xl font-bold text-heading">Data Max</h3>
              <span className="px-2.5 py-0.5 rounded-full text-indigo-400 bg-indigo-500/10 text-[10px] font-bold uppercase tracking-wider border border-indigo-500/20">AI Analyst</span>
            </div>
            <p className="text-base text-secondary leading-relaxed max-w-xl">
              {isPrefetched && teaserText
                ? <span className="text-secondary animate-in fade-in duration-500">{teaserText}</span>
                : <span>Soll ich die Performance der letzten <span className="font-medium text-body">{rangeLabel}</span> analysieren?</span>}
            </p>
          </div>
          <button onClick={handleAnalyze} className="shrink-0 px-6 py-3 bg-[#188BDB] hover:bg-[#1479BF] text-white rounded-lg text-sm font-medium shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex items-center gap-2 group">
            <Lightbulb size={18} className="text-white/90 group-hover:text-yellow-200 transition-colors" />
            <span>Jetzt analysieren</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 items-stretch animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-surface rounded-2xl border border-theme-border-default ring-1 ring-indigo-500/10 flex flex-col h-full shadow-sm">
        <div className="p-5 border-b border-theme-border-subtle rounded-t-2xl flex justify-between items-center">
          <h3 className="font-bold text-heading flex items-center gap-2">
            {isLoading ? <ArrowRepeat className="animate-spin text-indigo-500" /> : <InfoCircle className="text-indigo-500" />}
            Status ({rangeLabel})
          </h3>
        </div>
        <div className="p-5 text-sm text-body leading-relaxed flex-grow [&_strong]:text-strong [&_b]:text-strong [&_h1]:text-heading [&_h2]:text-heading [&_h3]:text-heading [&_h4]:text-heading [&_a]:text-indigo-500 hover:[&_a]:text-indigo-400 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:marker:text-indigo-500/60">
           <div dangerouslySetInnerHTML={{ __html: statusContent }} />
           {isLoading && !analysisContent && (
             <div className="inline-flex items-center gap-2 mt-2 text-emerald-500 font-medium animate-pulse opacity-80">
               <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
               </span>
               <span className="text-xs uppercase tracking-wider">Analysiert...</span>
             </div>
           )}
        </div>
      </div>

      <div className="bg-surface rounded-2xl border border-theme-border-default flex flex-col h-full shadow-sm">
        <div className="p-5 border-b border-theme-border-subtle flex justify-between items-center">
          <h3 className="font-bold text-heading flex items-center gap-2">
            <GraphUpArrow className="text-emerald-500" />
            Analyse & Fazit
          </h3>
          
          {/* PDF EXPORT BUTTON: Hier übergeben wir Domain und PDF-spezifische KPIs */}
          {chartRef && analysisContent && !isLoading && (
             <ExportButton 
               chartRef={chartRef} 
               analysisText={analysisContent} 
               projectId={projectId} 
               domain={domain} // ✅
               dateRange={dateRange}
               kpis={kpis} // ✅ Das sind die "exportKpis" aus ProjectDashboard
             />
          )}
        </div>
        
        <div className="p-5 text-sm text-body leading-relaxed flex-grow [&_strong]:text-strong [&_b]:text-strong [&_h1]:text-heading [&_h2]:text-heading [&_h3]:text-heading [&_h4]:text-heading [&_a]:text-indigo-500 hover:[&_a]:text-indigo-400 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:marker:text-indigo-500/60">
           {analysisContent ? (
             <div dangerouslySetInnerHTML={{ __html: analysisContent }} />
           ) : (
             isLoading && !statusContent ? <p className="text-faint italic">Warte auf Datenverarbeitung...</p> : null
           )}
           {isLoading && analysisContent && (
             <div className="inline-flex items-center gap-2 mt-2 text-emerald-500 font-medium animate-pulse opacity-80">
               <span className="w-1.5 h-3 bg-emerald-500 rounded-sm"></span>
               <span className="text-xs uppercase tracking-wider">Schreibt...</span>
             </div>
           )}
           {error && (
             <div className="mt-4 p-3 bg-rose-500/10 text-rose-400 text-xs rounded border border-rose-500/30 flex gap-2">
               <ExclamationTriangle className="shrink-0 mt-0.5"/>
               <div>
                 <strong className="text-rose-300">Fehler:</strong> {error.message}
                 <button onClick={handleAnalyze} className="underline ml-2 hover:text-rose-300">Wiederholen</button>
               </div>
             </div>
           )}
        </div>
      </div>
    </div>
  );
}
