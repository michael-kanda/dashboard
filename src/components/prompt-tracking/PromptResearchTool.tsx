// src/components/prompt-tracking/PromptResearchTool.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { WandSparkles, Copy, ClipboardCheck } from 'lucide-react';
import type { ProjectDashboardData, PromptTrackingResult } from '@/lib/dashboard-shared';
import {
  type ResearchOpportunity,
  type ResearchSetupOverrides,
  buildResearchSetup,
  buildResearchDataSummary,
  buildResearchOpportunities,
  normalizePath,
} from '@/lib/prompt-tracking/research';
import GoogleCleanUnderline from '@/components/ui/GoogleCleanUnderline';
import { Spinner } from '@/components/ui/Spinner';
import { errorFields } from '@/lib/errors';

// ════════════════════════════════════════════════════════════════════
// Admin-only Prompt Research Tool
// ════════════════════════════════════════════════════════════════════

export function PromptResearchTool({
  data,
  dashboardData,
  domain,
}: {
  data?: PromptTrackingResult;
  dashboardData?: ProjectDashboardData;
  domain?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [isGeneratingResearch, setIsGeneratingResearch] = useState(false);
  const [researchError, setResearchError] = useState<string | null>(null);
  const [dataMaxOpportunities, setDataMaxOpportunities] = useState<ResearchOpportunity[] | null>(null);
  const baseSetup = useMemo(
    () => buildResearchSetup(data, dashboardData, domain),
    [data, dashboardData, domain]
  );
  const [setupOverrides, setSetupOverrides] = useState<ResearchSetupOverrides>({});

  const setup = useMemo(
    () => ({ ...baseSetup, ...setupOverrides }),
    [baseSetup, setupOverrides]
  );
  // Erst opportunities berechnen — dann summary daraus ableiten.
  // Vorher hat buildResearchDataSummary intern noch einmal buildResearchOpportunities
  // aufgerufen → doppelte Regex-/Score-Pipeline pro setup-Change.
  const opportunities = useMemo(
    () => buildResearchOpportunities(data, dashboardData, setup),
    [data, dashboardData, setup]
  );
  const summary = useMemo(
    () => buildResearchDataSummary(opportunities, data, dashboardData),
    [opportunities, data, dashboardData]
  );
  const displayedOpportunities = dataMaxOpportunities ?? opportunities;

  useEffect(() => {
    setDataMaxOpportunities(null);
  }, [setup]);

  const handleCopy = async () => {
    const text = displayedOpportunities
      .map((item) => `${item.rank}. [${item.intent} | Score ${item.score}] ${item.prompt}`)
      .join('\n');
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const handleGenerateResearch = async () => {
    if (isGeneratingResearch) return;
    setIsGeneratingResearch(true);
    setResearchError(null);
    try {
      const res = await fetch('/api/prompt-tracking/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          setup,
          queries: (data?.queries ?? []).slice(0, 60).map((query) => ({
            query: query.query,
            clicks: query.clicks,
            impressions: query.impressions,
            ctr: query.ctr,
            position: query.position,
            url: query.url,
          })),
          landingPages: (dashboardData?.topConvertingPages ?? []).slice(0, 12).map((page) => ({
            path: page.path,
            conversions: page.conversions ?? 0,
            conversionRate: page.conversionRate ?? 0,
            sessions: page.sessions ?? 0,
          })),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || err?.details || `HTTP ${res.status}`);
      }
      const result = await res.json();
      const ranked = (result.opportunities ?? []).map((item: Omit<ResearchOpportunity, 'rank'>, idx: number) => ({
        ...item,
        rank: idx + 1,
      }));
      setDataMaxOpportunities(ranked);
    } catch (error: unknown) {
      setResearchError(errorFields(error).message || 'DataMax konnte keine Prompts generieren.');
    } finally {
      setIsGeneratingResearch(false);
    }
  };

  return (
    <section className="mt-6 mb-5 dashboard-widget-surface rounded-lg p-6 print:hidden">
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 mb-6">
        <div>
          <div>
            <h3 className="widget-title text-heading">Prompt Research Tool</h3>
            <GoogleCleanUnderline id="google-clean-gradient-prompt-research" />
          </div>
          <div className="widget-meta flex items-center gap-2 flex-wrap mt-3">
            <span className="bg-surface-tertiary text-body px-2 py-0.5 rounded font-semibold">Nur Admins</span>
            <span className="text-faint">•</span>
            <span className="text-muted">GSC + GA4</span>
            <span className="text-faint">•</span>
            <span className="text-muted">Decision-Prompts</span>
          </div>
          <p className="text-xs text-muted mt-2 leading-relaxed">
            Research-Workflow aus Projekt-Setup, GA4/GSC-Signalen, Quick-Wins und gerankten Decision-Prompts.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleGenerateResearch}
            disabled={isGeneratingResearch}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border border-border bg-surface text-body hover:bg-surface-tertiary disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {isGeneratingResearch ? <Spinner size={14} className="" /> : <WandSparkles className="w-3.5 h-3.5" />}
            Mit DataMax generieren
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border border-border bg-surface text-body hover:bg-surface-tertiary transition"
          >
            {copied ? <ClipboardCheck className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Kopiert' : 'Prompts kopieren'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-3 mb-4">
        <ResearchStep
          step="01"
          title="Setup"
          lines={[
            `Domain: ${setup.domainLabel}`,
            `Branche: ${setup.industry}`,
            `Region: ${setup.region}`,
            `Landingpage: ${setup.landingPage || 'nicht gesetzt'}`,
            `Thema: ${setup.topic || 'automatisch pro Query'}`,
            `Brand: ${setup.includeBrand ? 'mit Brand' : 'ohne Brand'}`,
          ]}
        />
        <ResearchStep
          step="02"
          title="Daten"
          lines={[
            `GSC: ${summary.gscQueries} Prompt-Queries, ${summary.gscImpressions} Impr., ${summary.gscClicks} Klicks`,
            `GA4: ${summary.ga4Sessions} Sessions, ${summary.ga4Conversions} Conversions`,
            `KI-Traffic: ${summary.aiSessions} Sessions`,
          ]}
        />
        <ResearchStep
          step="03"
          title="Analyse"
          lines={[
            `${summary.quickWins} Quick-Win-Kandidaten`,
            `${summary.buyIntent} Buy-Intent-Queries`,
            `${summary.optimizationCandidates} Optimierungskandidaten`,
          ]}
        />
        <ResearchStep
          step="04"
          title="Prompts"
          lines={[
            `${displayedOpportunities.length} Decision-Prompts`,
            dataMaxOpportunities ? 'DataMax-generiertes Ranking' : 'Fallback-Ranking nach Datenlogik',
            'Direkt kopierbar für LLM-Tests',
          ]}
        />
      </div>

      {researchError && (
        <div className="mb-4 rounded-md border border-border bg-danger-bg p-3 text-xs text-danger">
          {researchError}
        </div>
      )}

      {/* Setup fields */}
      <div className="rounded-md bg-surface p-3 mb-4">
        <div className="text-xs font-semibold text-heading mb-3">Setup-Felder</div>
        <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr_150px] gap-3 mb-3">
          <SetupField
            label="Landingpage"
            value={setup.landingPage}
            placeholder="/leistungen/scheidung"
            onChange={(value) => setSetupOverrides((current) => ({ ...current, landingPage: value }))}
          />
          <SetupField
            label="Thema"
            value={setup.topic}
            placeholder="Scheidungsanwalt Wien"
            onChange={(value) => setSetupOverrides((current) => ({ ...current, topic: value }))}
          />
          <label className="flex flex-col gap-1 text-xs font-medium text-muted">
            Brand-Modus
            <select
              value={setup.includeBrand ? 'brand' : 'nonbrand'}
              onChange={(event) => setSetupOverrides((current) => ({ ...current, includeBrand: event.target.value === 'brand' }))}
              className="px-3 py-2 text-sm rounded-md border border-border bg-surface text-body"
            >
              <option value="brand">mit Brand</option>
              <option value="nonbrand">ohne Brand</option>
            </select>
          </label>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <SetupField
            label="Branche"
            value={setup.industry}
            placeholder="Rechtsanwalt / Kanzlei"
            onChange={(value) => setSetupOverrides((current) => ({ ...current, industry: value }))}
          />
          <SetupField
            label="Region"
            value={setup.region}
            placeholder="Wien"
            onChange={(value) => setSetupOverrides((current) => ({ ...current, region: value }))}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-4">
        <ResearchInsight
          label="Quick Wins"
          items={displayedOpportunities.filter((item) => item.intent === 'Quick Win').slice(0, 3)}
        />
        <ResearchInsight
          label="Buy-Intent"
          items={displayedOpportunities.filter((item) => item.intent === 'Buy Intent').slice(0, 3)}
        />
        <ResearchInsight
          label="Optimierung"
          items={displayedOpportunities.filter((item) => item.intent === 'Optimierung').slice(0, 3)}
        />
      </div>

      <div className="space-y-2">
        {displayedOpportunities.map((item) => (
          <div key={`${item.rank}-${item.topic}-${item.intent}`} className="grid grid-cols-[44px_1fr] lg:grid-cols-[44px_120px_1fr_110px] gap-3 rounded-md bg-surface p-3">
            <div className="widget-metric-sm text-heading">#{item.rank}</div>
            <div className="hidden lg:block">
              <div className="text-[11px] font-semibold text-muted">{item.intent}</div>
              <div className="text-xs font-medium tabular-nums text-body">Score {item.score}</div>
              <div className="text-[11px] text-muted">{item.source}</div>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1 lg:hidden">
                <span className="text-[11px] font-semibold text-muted">{item.intent}</span>
                <span className="text-xs font-medium tabular-nums text-body">Score {item.score}</span>
                <span className="text-[11px] text-muted">{item.source}</span>
              </div>
              <div className="text-[12px] text-muted mb-1">{item.topic}</div>
              <p className="text-sm leading-relaxed text-body">{item.prompt}</p>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[12px] leading-relaxed text-muted">
                <span>{item.reason}</span>
                {setup.landingPage && normalizePath(setup.landingPage) !== '/' && (
                  <span>· Zielseite: {normalizePath(setup.landingPage)}</span>
                )}
              </div>
            </div>
            <div className="col-span-2 lg:col-span-1 text-[12px] leading-relaxed text-muted lg:text-right">
              {item.action}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ResearchStep({ step, title, lines }: { step: string; title: string; lines: string[] }) {
  return (
    <div className="rounded-md bg-surface p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="widget-eyebrow text-muted tabular-nums">{step}</span>
        <span className="widget-section-title text-heading">{title}</span>
      </div>
      <ul className="space-y-1">
        {lines.map((line) => (
          <li key={line} className="text-xs leading-relaxed text-muted">{line}</li>
        ))}
      </ul>
    </div>
  );
}

function SetupField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-muted">
      {label}
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="px-3 py-2 text-sm rounded-md border border-border bg-surface text-body focus:outline-none focus:ring-2 focus:ring-accent"
      />
    </label>
  );
}

function ResearchInsight({ label, items }: { label: string; items: ResearchOpportunity[] }) {
  return (
    <div className="rounded-md bg-surface p-3">
      <div className="text-xs font-semibold text-heading mb-2">{label}</div>
      {items.length > 0 ? (
        <ul className="space-y-1.5">
          {items.map((item) => (
            <li key={`${item.rank}-${item.topic}`} className="text-xs text-muted leading-snug">
              <span className="font-medium text-body">#{item.rank}</span> {item.topic}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted">Keine klaren Kandidaten im aktuellen Zeitraum.</p>
      )}
    </div>
  );
}
