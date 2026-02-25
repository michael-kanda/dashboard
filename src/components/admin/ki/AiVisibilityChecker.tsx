// src/components/admin/ki/AiVisibilityChecker.tsx
'use client';

import React, { useState, useRef } from 'react';
import Image from 'next/image';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { 
  Robot, 
  Globe, 
  Search,
  ArrowRight,
  InfoCircle,
  CheckCircleFill,
  XCircleFill,
  ExclamationTriangleFill
} from 'react-bootstrap-icons';

interface AiVisibilityCheckerProps {
  projectDomain?: string; // Optional: Vorausgefüllte Domain vom Projekt
}

export default function AiVisibilityChecker({ projectDomain }: AiVisibilityCheckerProps) {
  const [domain, setDomain] = useState(projectDomain || '');
  const [branche, setBranche] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [isWaitingForStream, setIsWaitingForStream] = useState(false);
  const [result, setResult] = useState<string>('');
  const [visibilityScore, setVisibilityScore] = useState<number | null>(null);
  
  const outputRef = useRef<HTMLDivElement>(null);

  // Beispiel-Branchen für Quick-Select
  const exampleBranches = [
    'Rechtsanwalt',
    'Zahnarzt', 
    'SEO Agentur',
    'Steuerberater',
    'Immobilienmakler',
    'Handwerker',
  ];

  const handleCheck = async () => {
    if (!domain.trim()) {
      toast.error('Bitte geben Sie eine Domain ein.');
      return;
    }

    setIsChecking(true);
    setIsWaitingForStream(true);
    setResult('');
    setVisibilityScore(null);

    try {
      const response = await fetch('/api/ai/ai-visibility-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          domain: domain.trim(),
          branche: branche.trim() || 'allgemein'
        }),
      });

      setIsWaitingForStream(false);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Fehler beim Check');
      }

      // Score aus Header lesen
      const scoreHeader = response.headers.get('X-Visibility-Score');
      if (scoreHeader) {
        setVisibilityScore(parseInt(scoreHeader, 10));
      }

      if (!response.body) throw new Error('Kein Stream');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        const chunk = decoder.decode(value, { stream: true });
        setResult(prev => prev + chunk);
        
        if (outputRef.current) {
          outputRef.current.scrollTop = outputRef.current.scrollHeight;
        }
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';
      console.error('❌ AI Visibility Check Error:', error);
      toast.error(`Fehler: ${errorMessage}`);
      setIsWaitingForStream(false);
    } finally {
      setIsChecking(false);
    }
  };

  // Score-Badge Komponente
  const ScoreBadge = ({ score }: { score: number }) => {
    let colorClass = 'bg-rose-100 text-rose-700 border-rose-200';
    let icon = <XCircleFill className="text-rose-500" />;
    let label = 'Nicht sichtbar';

    if (score >= 70) {
      colorClass = 'bg-emerald-100 text-emerald-700 border-emerald-200';
      icon = <CheckCircleFill className="text-emerald-500" />;
      label = 'Gut sichtbar';
    } else if (score >= 40) {
      colorClass = 'bg-amber-100 text-amber-700 border-amber-200';
      icon = <ExclamationTriangleFill className="text-amber-500" />;
      label = 'Ausbaufähig';
    }

    return (
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${colorClass}`}>
        {icon}
        <span className="font-semibold">{score}/100</span>
        <span className="text-xs opacity-75">({label})</span>
      </div>
    );
  };

  return (
    <div className="space-y-6">
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
              <h3 className="text-xl font-bold text-strong mb-1">KI-Sichtbarkeit wird geprüft</h3>
              <p className="text-muted text-sm leading-relaxed">
                Analysiere Domain, teste Gemini-Antworten und bewerte KI-Faktoren...
              </p>
            </div>

            <div className="w-full space-y-2">
              <div className="flex items-center gap-2 text-sm text-secondary">
                <div className="w-4 h-4 rounded-full bg-indigo-500 animate-pulse"></div>
                <span>Crawle Website & Schema.org...</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-faint">
                <div className="w-4 h-4 rounded-full bg-surface-tertiary"></div>
                <span>Teste Sichtbarkeit in Gemini...</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-faint">
                <div className="w-4 h-4 rounded-full bg-surface-tertiary"></div>
                <span>Generiere Report...</span>
              </div>
            </div>

            <div className="w-full h-1.5 bg-surface-tertiary rounded-full overflow-hidden">
              <div className="h-full bg-purple-500 w-1/3 rounded-full animate-indeterminate-bar"></div>
            </div>
          </div>
        </div>
      )}

      {/* MAIN GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LINKE SPALTE: INPUTS */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* INFO BOX */}
          <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-100 rounded-2xl p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg">
                <Robot size={24} />
              </div>
              <div>
                <h3 className="font-bold text-heading">KI-Sichtbarkeits-Check</h3>
                <p className="text-xs text-muted mt-0.5">Powered by Gemini</p>
              </div>
            </div>
            
            <p className="text-sm text-secondary leading-relaxed">
              Prüft, ob und wie Ihre Domain von KI-Assistenten wie ChatGPT, Gemini oder Perplexity empfohlen wird.
            </p>
            
            <div className="mt-4 pt-4 border-t border-purple-100 space-y-2">
              <div className="flex items-center gap-2 text-xs text-secondary">
                <CheckCircleFill className="text-purple-500 shrink-0" />
                <span>Live-Test mit Gemini API</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-secondary">
                <CheckCircleFill className="text-purple-500 shrink-0" />
                <span>Schema.org & E-E-A-T Analyse</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-secondary">
                <CheckCircleFill className="text-purple-500 shrink-0" />
                <span>Konkurrenz-Vergleich</span>
              </div>
            </div>
          </div>

          {/* DOMAIN INPUT */}
          <div className="bg-surface border border-theme-border-subtle shadow-sm rounded-2xl p-6 space-y-4">
            <div>
              <label className="text-sm font-semibold text-body mb-2 flex items-center gap-2">
                <Globe className="text-purple-500" /> Domain / URL
              </label>
              <input 
                type="text" 
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="z.B. meine-firma.at oder https://..."
                className="w-full p-3 bg-purple-50 border border-purple-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 outline-none transition-all text-body placeholder-purple-300"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-body mb-2 flex items-center gap-2">
                <Search className="text-purple-500" /> Branche / Thema
                <span className="text-xs font-normal text-faint">(optional)</span>
              </label>
              <input 
                type="text" 
                value={branche}
                onChange={(e) => setBranche(e.target.value)}
                placeholder="z.B. Rechtsanwalt Wien, SEO Agentur..."
                className="w-full p-3 bg-surface-secondary border border-theme-border-default rounded-xl text-sm focus:ring-2 focus:ring-purple-500 outline-none transition-all text-body placeholder-faint"
              />
            </div>

            {/* Quick-Select Branchen */}
            <div>
              <p className="text-xs text-muted mb-2">Schnellauswahl:</p>
              <div className="flex flex-wrap gap-2">
                {exampleBranches.map((b) => (
                  <button
                    key={b}
                    onClick={() => setBranche(b)}
                    className={`px-2.5 py-1 rounded-lg text-xs transition-colors ${
                      branche === b 
                        ? 'bg-purple-500 text-white' 
                        : 'bg-surface-tertiary hover:bg-purple-100 text-secondary hover:text-purple-700'
                    }`}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ACTION BUTTON */}
          <Button
            onClick={handleCheck}
            disabled={isChecking || !domain.trim()}
            className="w-full h-auto py-4 text-base gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-lg"
          >
            {isChecking ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Prüfe Sichtbarkeit...
              </>
            ) : (
              <>
                KI-Sichtbarkeit prüfen
                <ArrowRight />
              </>
            )}
          </Button>

          {/* SCORE PREVIEW */}
          {visibilityScore !== null && (
            <div className="bg-surface border border-theme-border-subtle shadow-sm rounded-2xl p-4 text-center animate-in slide-in-from-bottom-2">
              <p className="text-xs text-muted uppercase tracking-wider mb-2">Ihr Score</p>
              <ScoreBadge score={visibilityScore} />
            </div>
          )}

          {/* HINWEIS */}
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
            <div className="flex items-start gap-2">
              <InfoCircle className="text-amber-500 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-800">
                <p className="font-semibold mb-1">Hinweis zur Genauigkeit</p>
                <p>KI-Antworten variieren. Dieser Check zeigt eine Momentaufnahme der Sichtbarkeit in Gemini. Für ein vollständiges Bild empfehlen wir regelmäßige Checks.</p>
              </div>
            </div>
          </div>
        </div>

        {/* RECHTE SPALTE: OUTPUT */}
        <div className="lg:col-span-8">
          <div className="bg-surface border border-theme-border-subtle shadow-xl rounded-2xl p-8 h-full min-h-[700px] flex flex-col relative overflow-hidden">
            {/* Decorative Background */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-purple-100 rounded-full mix-blend-multiply filter blur-3xl opacity-30"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-100 rounded-full mix-blend-multiply filter blur-3xl opacity-30"></div>

            <h2 className="text-lg font-semibold text-strong mb-4 z-10 flex items-center gap-2">
              <Robot className="text-purple-500" />
              KI-Sichtbarkeits-Report
              {visibilityScore !== null && (
                <span className="ml-auto">
                  <ScoreBadge score={visibilityScore} />
                </span>
              )}
            </h2>

            <div 
              ref={outputRef}
              className="flex-1 bg-surface-secondary/50 rounded-xl border border-theme-border-default/60 p-4 overflow-y-auto z-10 custom-scrollbar ai-output"
            >
              {result ? (
                <div 
                  className="ai-content"
                  dangerouslySetInnerHTML={{ __html: result }} 
                />
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-faint text-center p-8">
                  <div className="w-20 h-20 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-2xl flex items-center justify-center mb-4">
                    <Robot className="text-4xl text-purple-300" />
                  </div>
                  <p className="font-medium text-muted">Bereit für den Check</p>
                  <p className="text-xs mt-2 max-w-xs">
                    Geben Sie links eine Domain ein und starten Sie den KI-Sichtbarkeits-Check. 
                    Wir prüfen, ob und wie die Domain von Gemini empfohlen wird.
                  </p>
                  
                  <div className="mt-6 grid grid-cols-3 gap-4 text-center">
                    <div className="p-3 bg-surface rounded-xl border border-theme-border-subtle">
                      <div className="text-lg font-bold text-purple-600">1</div>
                      <div className="text-[10px] text-muted mt-1">Domain crawlen</div>
                    </div>
                    <div className="p-3 bg-surface rounded-xl border border-theme-border-subtle">
                      <div className="text-lg font-bold text-purple-600">2</div>
                      <div className="text-[10px] text-muted mt-1">Gemini befragen</div>
                    </div>
                    <div className="p-3 bg-surface rounded-xl border border-theme-border-subtle">
                      <div className="text-lg font-bold text-purple-600">3</div>
                      <div className="text-[10px] text-muted mt-1">Report erstellen</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* INLINE STYLES für Animation */}
      <style jsx global>{`
        @keyframes indeterminate-bar {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
        .animate-indeterminate-bar {
          animation: indeterminate-bar 1.5s infinite linear;
        }
      `}</style>
    </div>
  );
}
