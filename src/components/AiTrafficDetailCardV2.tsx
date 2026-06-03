// src/components/AiTrafficDetailCardV2.tsx
'use client';

import React, { useState, useMemo } from 'react';
import { 
  Bot, Filter, ArrowDown, ArrowUp, FileText, Search, XCircle, RefreshCcw,
  TrendingUp, Users, Clock, ChevronDown, ChevronUp, AlertTriangle, Info,
  ArrowRight, Target, BarChart3, Waypoints, MousePointerClick, CheckCircle2,
  Sparkles, LayoutGrid,
  // Intent Icons
  BookOpen, ShoppingCart, Phone, Compass, Building2, Scale, Home, Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, Cell
} from 'recharts';
import { format, subDays, subMonths } from 'date-fns';
import { de } from 'date-fns/locale';
import type { AiTrafficExtendedData, IntentCategory } from '@/lib/ai-traffic-extended-v2';

// ============================================================================
// PROPS & TYPES
// ============================================================================

interface AiTrafficDetailCardV2Props {
  data?: AiTrafficExtendedData;
  isLoading?: boolean;
  dateRange?: string;
  className?: string;
  error?: string;
  onRefresh?: () => void;
}

type ViewTab = 'overview' | 'intent' | 'journey' | 'pages' | 'sources';
type SortField = 'sessions' | 'users' | 'avgEngagementTime' | 'bounceRate' | 'conversions' | 'engagementRate';
type SortDirection = 'asc' | 'desc';

// ============================================================================
// ICON MAPPING
// ============================================================================

function getIntentIcon(iconName: string, size: number = 16): React.ReactNode {
  const icons: Record<string, React.ReactNode> = {
    'book-open': <BookOpen size={size} />,
    'shopping-cart': <ShoppingCart size={size} />,
    'phone': <Phone size={size} />,
    'compass': <Compass size={size} />,
    'building-2': <Building2 size={size} />,
    'scale': <Scale size={size} />,
    'file-text': <FileText size={size} />,
    'home': <Home size={size} />,
  };
  return icons[iconName] || <FileText size={size} />;
}

// ============================================================================
// KONSTANTEN
// ============================================================================

const AI_SOURCE_COLORS: Record<string, string> = {
  'chatgpt.com': '#10a37f',
  'claude.ai': '#d97706',
  'perplexity.ai': '#6366f1',
  'gemini.google.com': '#4285f4',
  'copilot.microsoft.com': '#00a4ef',
  'you.com': '#8b5cf6',
  'poe.com': '#7c3aed',
  'character.ai': '#ec4899',
  'default': '#6b7280'
};

const AI_SOURCE_LABELS: Record<string, string> = {
  'chatgpt.com': 'ChatGPT',
  'claude.ai': 'Claude',
  'perplexity.ai': 'Perplexity',
  'gemini.google.com': 'Gemini',
  'copilot.microsoft.com': 'Copilot',
  'you.com': 'You.com',
  'poe.com': 'Poe',
  'character.ai': 'Character.AI'
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getSourceColor(source: string): string {
  const lowerSource = source.toLowerCase();
  for (const [key, color] of Object.entries(AI_SOURCE_COLORS)) {
    if (lowerSource.includes(key.split('.')[0])) return color;
  }
  return AI_SOURCE_COLORS.default;
}

function getSourceLabel(source: string): string {
  const lowerSource = source.toLowerCase();
  for (const [key, label] of Object.entries(AI_SOURCE_LABELS)) {
    if (lowerSource.includes(key.split('.')[0])) return label;
  }
  return source;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function getDateRangeString(range: string): string {
  const end = new Date();
  let start = subDays(end, 30);
  switch (range) {
    case '7d': start = subDays(end, 7); break;
    case '30d': start = subDays(end, 30); break;
    case '3m': start = subMonths(end, 3); break;
    case '6m': start = subMonths(end, 6); break;
    case '12m': start = subMonths(end, 12); break;
  }
  return `${format(start, 'dd.MM.yyyy', { locale: de })} - ${format(end, 'dd.MM.yyyy', { locale: de })}`;
}

// ============================================================================
// SUB-KOMPONENTEN
// ============================================================================

const TabButton: React.FC<{
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string;
}> = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={cn(
    "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
    active ? "bg-surface-tertiary text-heading shadow-sm" : "text-secondary hover:bg-surface-tertiary"
  )}>
    {icon}{label}
  </button>
);

// Intent Card mit Interaktionsrate
const IntentCard: React.FC<{
  intent: IntentCategory; sessions: number; conversions: number;
  conversionRate: number; avgEngagementTime: number; engagementRate: number;
  percentage: number; topPages: Array<{ path: string; sessions: number }>;
}> = ({ intent, sessions, conversions, conversionRate, avgEngagementTime, engagementRate, percentage, topPages }) => (
  <div className="p-4 rounded-xl border border-border-subtle hover:border-purple-200 hover:shadow-md transition-all bg-surface"
    style={{ borderLeftColor: intent.color, borderLeftWidth: '4px' }}>
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <span style={{ color: intent.color }}>{getIntentIcon(intent.icon, 20)}</span>
        <span className="font-semibold text-heading">{intent.label}</span>
      </div>
      <span className="text-xs px-2 py-0.5 rounded-full font-medium"
        style={{ backgroundColor: `${intent.color}20`, color: intent.color }}>
        {percentage.toFixed(1)}%
      </span>
    </div>
    <div className="grid grid-cols-2 gap-3 mb-3">
      <div><div className="text-xs text-muted">Sessions</div>
        <div className="text-lg font-bold text-heading">{sessions.toLocaleString('de-DE')}</div></div>
      <div><div className="text-xs text-muted">Conversions</div>
        <div className="text-lg font-bold text-heading">{conversions}</div></div>
      <div><div className="text-xs text-muted">Conv. Rate</div>
        <div className={cn("text-lg font-bold", conversionRate > 5 ? "text-green-600" : conversionRate > 2 ? "text-amber-600" : "text-secondary")}>
          {conversionRate.toFixed(1)}%</div></div>
      <div><div className="text-xs text-muted">Interaktionsrate</div>
        <div className={cn("text-lg font-bold", engagementRate > 60 ? "text-green-600" : engagementRate > 40 ? "text-amber-600" : "text-secondary")}>
          {engagementRate.toFixed(1)}%</div></div>
    </div>
    {topPages.length > 0 && (
      <div className="pt-3 border-t border-border-subtle">
        <div className="text-xs font-semibold text-muted mb-2">Top Seiten</div>
        <div className="space-y-1">
          {topPages.slice(0, 3).map((page, i) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <span className="text-secondary truncate max-w-[70%]" title={page.path}>
                {page.path === '/' ? '/ (Startseite)' : page.path}</span>
              <span className="text-faint font-medium">{page.sessions}</span>
            </div>
          ))}
        </div>
      </div>
    )}
  </div>
);

// Journey Card mit Interaktionsrate
const JourneyFlowCard: React.FC<{
  landingPage: string; totalSessions: number; conversionRate: number;
  engagementRate: number; avgSessionDuration: number;
  nextPages: Array<{ path: string; sessions: number; percentage: number }>;
}> = ({ landingPage, totalSessions, conversionRate, engagementRate, avgSessionDuration, nextPages }) => (
  <div className="p-4 rounded-xl border border-border-subtle bg-surface hover:shadow-md transition-all">
    <div className="flex items-start justify-between mb-3">
      <div className="flex-1 min-w-0">
        <div className="text-xs text-muted mb-1">Einstiegsseite</div>
        <div className="font-semibold text-heading truncate" title={landingPage}>
          {landingPage === '/' ? '/ (Startseite)' : landingPage}</div>
      </div>
      <div className="text-right ml-4">
        <div className="text-lg font-bold text-purple-600">{totalSessions}</div>
        <div className="text-xs text-muted">Sessions</div>
      </div>
    </div>
    <div className="flex items-center gap-4 mb-3 text-xs">
      <div className="flex items-center gap-1">
        <CheckCircle2 className="text-green-500" size={12} />
        <span className="text-secondary">Conv: </span>
        <span className="font-semibold">{conversionRate.toFixed(1)}%</span>
      </div>
      <div className="flex items-center gap-1">
        <Activity className="text-purple-500" size={12} />
        <span className="text-secondary">Interaktion: </span>
        <span className="font-semibold">{engagementRate.toFixed(1)}%</span>
      </div>
      <div className="flex items-center gap-1">
        <Clock className="text-blue-500" size={12} />
        <span className="text-secondary">Zeit: </span>
        <span className="font-semibold">{formatDuration(avgSessionDuration)}</span>
      </div>
    </div>
    {nextPages.length > 0 && (
      <div className="pt-3 border-t border-border-subtle">
        <div className="text-xs font-semibold text-muted mb-2 flex items-center gap-1">
          <ArrowRight size={10} />Nächste Seiten</div>
        <div className="space-y-2">
          {nextPages.slice(0, 4).map((page, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="h-1.5 rounded-full bg-purple-500" style={{ width: `${Math.max(page.percentage, 5)}%` }} />
              <span className="text-xs text-secondary truncate flex-1" title={page.path}>
                {page.path === '/' ? 'Startseite' : page.path}</span>
              <span className="text-xs text-faint font-medium">{page.percentage.toFixed(0)}%</span>
            </div>
          ))}
        </div>
      </div>
    )}
  </div>
);

// ============================================================================
// HAUPTKOMPONENTE
// ============================================================================

export default function AiTrafficDetailCardV2({
  data, isLoading = false, dateRange = '30d', className, error, onRefresh
}: AiTrafficDetailCardV2Props) {
  
  const [activeTab, setActiveTab] = useState<ViewTab>('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIntent, setSelectedIntent] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('sessions');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [isExpanded, setIsExpanded] = useState(true);

  const formattedDateRange = getDateRangeString(dateRange);

  const filteredPages = useMemo(() => {
    if (!data?.landingPages) return [];
    let filtered = [...data.landingPages];
    filtered = filtered.filter(p => p.path !== '(not set)' && p.path !== '(not provided)');
    if (searchTerm) filtered = filtered.filter(p => p.path.toLowerCase().includes(searchTerm.toLowerCase()));
    if (selectedIntent) filtered = filtered.filter(p => p.intent.key === selectedIntent);
    filtered.sort((a, b) => {
      let aVal = a[sortField] ?? 0;
      let bVal = b[sortField] ?? 0;
      if (sortField === 'bounceRate') { aVal = 100 - aVal; bVal = 100 - bVal; }
      return sortDirection === 'desc' ? bVal - aVal : aVal - bVal;
    });
    return filtered;
  }, [data?.landingPages, searchTerm, selectedIntent, sortField, sortDirection]);

  const sourceChartData = useMemo(() => {
    if (!data?.sources) return [];
    return data.sources.slice(0, 6).map(s => ({
      name: getSourceLabel(s.source), sessions: s.sessions, users: s.users,
      engagementRate: s.engagementRate, fill: getSourceColor(s.source)
    }));
  }, [data?.sources]);

  const trendData = useMemo(() => {
    if (!data?.trend) return [];
    return data.trend.map(t => ({ ...t, dateFormatted: format(new Date(t.date), 'dd.MM', { locale: de }) }));
  }, [data?.trend]);

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDirection(prev => prev === 'desc' ? 'asc' : 'desc');
    else { setSortField(field); setSortDirection('desc'); }
  };

  // LOADING
  if (isLoading) return (
    <div className={cn("dashboard-widget-surface rounded-lg p-6 overflow-hidden", className)}>
      <div className="p-6 animate-pulse">
        <div className="h-8 bg-surface-tertiary rounded w-1/3 mb-6" />
        <div className="grid grid-cols-6 gap-4 mb-6">{[...Array(6)].map((_, i) => <div key={i} className="h-24 bg-surface-secondary rounded-xl" />)}</div>
        <div className="h-64 bg-surface-secondary rounded-xl" />
      </div>
    </div>
  );

  // ERROR
  if (error) return (
    <div className={cn("dashboard-widget-surface rounded-2xl p-6", className)}>
      <div className="flex flex-col items-center justify-center text-center py-8">
        <AlertTriangle className="text-red-500 w-12 h-12 mb-4" />
        <h3 className="text-lg font-semibold text-heading mb-2">Fehler beim Laden</h3>
        <p className="text-sm text-muted mb-4 max-w-md">{error}</p>
        {onRefresh && <button onClick={onRefresh} className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"><RefreshCcw size={16} />Erneut versuchen</button>}
      </div>
    </div>
  );

  // EMPTY
  if (!data || data.totalSessions === 0) return (
    <div className={cn("dashboard-widget-surface rounded-2xl p-6", className)}>
      <div className="flex flex-col items-center justify-center text-center py-12">
        <div className="w-16 h-16 rounded-2xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center mb-4"><Bot className="text-purple-400" size={32} /></div>
        <h3 className="text-lg font-semibold text-heading mb-2">Keine KI-Traffic Daten</h3>
        <p className="text-sm text-muted max-w-md">Im ausgewählten Zeitraum wurden keine Besuche von KI-Plattformen erfasst.</p>
      </div>
    </div>
  );

  // MAIN RENDER
  return (
    <div className={cn("dashboard-widget-surface rounded-lg p-6 overflow-hidden", className)}>
      
      {/* HEADER */}
      <div className="pb-5 border-b border-border-subtle">
        <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-heading">KI-Traffic Analyse</h3>
            <div className="mt-1 h-[12px] max-w-[220px]" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 12" width="100%" height="12">
                <defs>
                  <linearGradient id="google-clean-gradient-ai-traffic-analysis" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#4285F4" />
                    <stop offset="25%" stopColor="#4285F4" />
                    <stop offset="25%" stopColor="#EA4335" />
                    <stop offset="50%" stopColor="#EA4335" />
                    <stop offset="50%" stopColor="#FBBC05" />
                    <stop offset="75%" stopColor="#FBBC05" />
                    <stop offset="75%" stopColor="#34A853" />
                    <stop offset="100%" stopColor="#34A853" />
                  </linearGradient>
                </defs>
                <rect width="100%" height="12" rx="6" fill="url(#google-clean-gradient-ai-traffic-analysis)" />
              </svg>
            </div>
            <p className="text-xs text-muted mt-2">Intent-Kategorisierung & User-Journey</p>
          </div>
          <button onClick={() => setIsExpanded(!isExpanded)} className="p-2 hover:bg-surface-tertiary rounded-md text-body">
            {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}</button>
        </div>
        <div className="flex items-center gap-3 text-xs flex-wrap">
          <span className="bg-surface-tertiary text-body px-2 py-0.5 rounded text-xs font-semibold">Quelle: GA4</span>
          <span className="text-faint">•</span>
          <span className="text-muted">{formattedDateRange}</span>
          {onRefresh && <><span className="text-faint">•</span>
            <button onClick={onRefresh} className="text-body hover:text-heading font-medium flex items-center gap-1">
              <RefreshCcw size={12} />Aktualisieren</button></>}
        </div>
      </div>

      {isExpanded && (
        <>
          {/* KPI GRID */}
          <div className="py-5">
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4 border border-purple-200/60 dark:border-purple-700/30">
                <div className="flex items-center gap-2 mb-1"><TrendingUp className="text-purple-600" size={16} />
                  <span className="text-xs font-medium text-purple-700 dark:text-purple-300">Sessions</span></div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-purple-900 dark:text-purple-100">{data.totalSessions.toLocaleString('de-DE')}</span>
                  {data.totalSessionsChange !== undefined && <span className={cn("text-xs font-semibold", data.totalSessionsChange >= 0 ? "text-green-600" : "text-red-600")}>
                    {data.totalSessionsChange >= 0 ? '+' : ''}{data.totalSessionsChange.toFixed(1)}%</span>}
                </div>
              </div>
              <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-4 border border-indigo-200/60 dark:border-indigo-700/30">
                <div className="flex items-center gap-2 mb-1"><Users className="text-indigo-600" size={16} />
                  <span className="text-xs font-medium text-indigo-700 dark:text-indigo-300">Nutzer</span></div>
                <span className="text-2xl font-bold text-indigo-900 dark:text-indigo-100">{data.totalUsers.toLocaleString('de-DE')}</span>
              </div>
              <div className="bg-teal-50 dark:bg-teal-900/20 rounded-xl p-4 border border-teal-200/60 dark:border-teal-700/30">
                <div className="flex items-center gap-2 mb-1"><Clock className="text-teal-600" size={16} />
                  <span className="text-xs font-medium text-teal-700 dark:text-teal-300">Ø Verweildauer</span></div>
                <span className="text-2xl font-bold text-teal-900 dark:text-teal-100">{formatDuration(data.avgEngagementTime)}</span>
              </div>
              <div className="bg-rose-50 dark:bg-rose-900/20 rounded-xl p-4 border border-rose-200/60 dark:border-rose-700/30">
                <div className="flex items-center gap-2 mb-1"><Activity className="text-rose-600" size={16} />
                  <span className="text-xs font-medium text-rose-700 dark:text-rose-300">Interaktionsrate</span></div>
                <span className={cn("text-2xl font-bold", data.engagementRate > 60 ? "text-green-600" : data.engagementRate > 40 ? "text-amber-600" : "text-rose-900")}>
                  {data.engagementRate.toFixed(1)}%</span>
              </div>
              <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 border border-amber-200/60 dark:border-amber-700/30">
                <div className="flex items-center gap-2 mb-1"><Target className="text-amber-600" size={16} />
                  <span className="text-xs font-medium text-amber-700 dark:text-amber-300">Conversions</span></div>
                <span className="text-2xl font-bold text-amber-900 dark:text-amber-100">{data.conversions.toLocaleString('de-DE')}</span>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200/60 dark:border-blue-700/30">
                <div className="flex items-center gap-2 mb-1"><BarChart3 className="text-blue-600" size={16} />
                  <span className="text-xs font-medium text-blue-700 dark:text-blue-300">Ø Seiten/Session</span></div>
                <span className="text-2xl font-bold text-blue-900 dark:text-blue-100">{data.userJourney.avgPagesPerSession.toFixed(1)}</span>
              </div>
            </div>
          </div>

          {/* TABS */}
          <div className="py-3 border-b border-border-subtle flex items-center gap-2 overflow-x-auto">
            <TabButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} icon={<BarChart3 size={14} />} label="Übersicht" />
            <TabButton active={activeTab === 'intent'} onClick={() => setActiveTab('intent')} icon={<Target size={14} />} label="Intent-Analyse" />
            <TabButton active={activeTab === 'journey'} onClick={() => setActiveTab('journey')} icon={<Waypoints size={14} />} label="User-Journey" />
            <TabButton active={activeTab === 'pages'} onClick={() => setActiveTab('pages')} icon={<FileText size={14} />} label="Alle Seiten" />
            <TabButton active={activeTab === 'sources'} onClick={() => setActiveTab('sources')} icon={<Bot size={14} />} label="KI-Quellen" />
          </div>

          {/* TAB CONTENT */}
          <div className="py-5">
            
            {/* OVERVIEW TAB */}
            {activeTab === 'overview' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-semibold text-strong mb-3 flex items-center gap-2">
                    <TrendingUp size={14} className="text-purple-500" />Sessions-Trend</h3>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={trendData}>
                        <defs><linearGradient id="aiGradV2" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.05} /></linearGradient></defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--dp-chart-grid)" />
                        <XAxis dataKey="dateFormatted" tick={{ fontSize: 10, fill: 'var(--dp-chart-text)' }} />
                        <YAxis tick={{ fontSize: 10, fill: 'var(--dp-chart-text)' }} width={40} />
                        <Tooltip contentStyle={{ backgroundColor: 'var(--dp-chart-tooltip-bg)', border: '1px solid var(--dp-chart-tooltip-border)', borderRadius: '8px', fontSize: '12px', color: 'var(--dp-chart-tooltip-text)' }} />
                        <Area type="monotone" dataKey="sessions" stroke="#8b5cf6" strokeWidth={2} fill="url(#aiGradV2)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-strong mb-3 flex items-center gap-2">
                    <Bot size={14} className="text-purple-500" />KI-Quellen</h3>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={sourceChartData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--dp-chart-grid)" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--dp-chart-text)' }} />
                        <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: 'var(--dp-chart-text)' }} width={80} />
                        <Tooltip contentStyle={{ backgroundColor: 'var(--dp-chart-tooltip-bg)', color: 'var(--dp-chart-tooltip-text)', borderRadius: '8px', border: '1px solid var(--dp-chart-tooltip-border)' }} />
                        <Bar dataKey="sessions" radius={[0, 4, 4, 0]}>
                          {sourceChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="lg:col-span-2">
                  <h3 className="text-sm font-semibold text-strong mb-3 flex items-center gap-2">
                    <Target size={14} className="text-purple-500" />Intent-Verteilung</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {data.intentBreakdown.map((item, i) => (
                      <div key={i} className="p-3 rounded-lg border border-border-subtle hover:border-purple-200 transition-all cursor-pointer"
                        style={{ borderLeftColor: item.intent.color, borderLeftWidth: '3px' }}
                        onClick={() => { setSelectedIntent(item.intent.key); setActiveTab('pages'); }}>
                        <div className="flex items-center gap-1.5 mb-1">
                          <span style={{ color: item.intent.color }}>{getIntentIcon(item.intent.icon, 14)}</span>
                          <span className="text-xs font-medium text-body truncate">{item.intent.label}</span>
                        </div>
                        <div className="text-lg font-bold text-heading">{item.sessions}</div>
                        <div className="text-xs text-muted">{item.percentage.toFixed(1)}% • {item.engagementRate.toFixed(0)}% Int.</div>
                      </div>
                    ))}
                  </div>
                </div>
                {data.userJourney.interactionEvents.length > 0 && (
                  <div className="lg:col-span-2">
                    <h3 className="text-sm font-semibold text-strong mb-3 flex items-center gap-2">
                      <MousePointerClick size={14} className="text-purple-500" />Interaktionen</h3>
                    <div className="flex flex-wrap gap-2">
                      {data.userJourney.interactionEvents.slice(0, 10).map((event, i) => (
                        <div key={i} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-tertiary text-sm">
                          <span className="font-medium text-body">{event.eventName}</span>
                          <span className="text-xs text-muted bg-surface px-1.5 py-0.5 rounded-full">{event.count.toLocaleString('de-DE')}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* INTENT TAB */}
            {activeTab === 'intent' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.intentBreakdown.map((item, i) => (
                  <IntentCard key={i} intent={item.intent} sessions={item.sessions} conversions={item.conversions}
                    conversionRate={item.conversionRate} avgEngagementTime={item.avgEngagementTime}
                    engagementRate={item.engagementRate} percentage={item.percentage} topPages={item.topPages} />
                ))}
              </div>
            )}

            {/* JOURNEY TAB */}
            {activeTab === 'journey' && (
              <div className="space-y-6">
                {(data.userJourney.scrollDepth.reached25 > 0 || data.userJourney.scrollDepth.reached50 > 0) && (
                  <div>
                    <h3 className="text-sm font-semibold text-strong mb-3">Scroll-Tiefe</h3>
                    <div className="flex items-end gap-4 h-24">
                      {[{ label: '25%', value: data.userJourney.scrollDepth.reached25 },
                        { label: '50%', value: data.userJourney.scrollDepth.reached50 },
                        { label: '75%', value: data.userJourney.scrollDepth.reached75 },
                        { label: '100%', value: data.userJourney.scrollDepth.reached100 }
                      ].map((item, i) => {
                        const max = Math.max(data.userJourney.scrollDepth.reached25, data.userJourney.scrollDepth.reached50,
                          data.userJourney.scrollDepth.reached75, data.userJourney.scrollDepth.reached100);
                        const height = max > 0 ? (item.value / max) * 100 : 0;
                        return (
                          <div key={i} className="flex flex-col items-center gap-1 flex-1">
                            <div className="text-xs font-semibold text-body">{item.value.toLocaleString('de-DE')}</div>
                            <div className="w-full bg-purple-500 rounded-t-sm transition-all" style={{ height: `${Math.max(height, 4)}%` }} />
                            <div className="text-xs text-muted">{item.label}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div>
                  <h3 className="text-sm font-semibold text-strong mb-3">Top Einstiegsseiten & Folgepfade</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {data.userJourney.topJourneys.slice(0, 6).map((journey, i) => (
                      <JourneyFlowCard key={i} landingPage={journey.landingPage} totalSessions={journey.totalSessions}
                        conversionRate={journey.conversionRate} engagementRate={journey.engagementRate}
                        avgSessionDuration={journey.avgSessionDuration} nextPages={journey.nextPages} />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* PAGES TAB */}
            {activeTab === 'pages' && (
              <div>
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <div className="relative flex-1 min-w-[200px] max-w-[300px]">
                    <input type="text" placeholder="Seite suchen..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-8 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500" />
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" size={14} />
                    {searchTerm && <button onClick={() => setSearchTerm('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-faint hover:text-secondary">
                      <XCircle size={16} /></button>}
                  </div>
                  <select value={selectedIntent || ''} onChange={(e) => setSelectedIntent(e.target.value || null)}
                    className="px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20">
                    <option value="">Alle Intents</option>
                    {data.intentBreakdown.map(item => (
                      <option key={item.intent.key} value={item.intent.key}>{item.intent.label} ({item.sessions})</option>
                    ))}
                  </select>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-surface-secondary text-xs text-secondary">
                        <th className="px-4 py-3 text-left font-semibold">Seite</th>
                        <th className="px-4 py-3 text-left font-semibold">Intent</th>
                        <th className="px-4 py-3 text-right font-semibold cursor-pointer hover:text-purple-600" onClick={() => handleSort('sessions')}>
                          Sessions {sortField === 'sessions' && (sortDirection === 'desc' ? <ArrowDown size={12} className="inline"/> : <ArrowUp size={12} className="inline"/>)}</th>
                        <th className="px-4 py-3 text-right font-semibold cursor-pointer hover:text-purple-600" onClick={() => handleSort('engagementRate')}>
                          Interaktion {sortField === 'engagementRate' && (sortDirection === 'desc' ? <ArrowDown size={12} className="inline"/> : <ArrowUp size={12} className="inline"/>)}</th>
                        <th className="px-4 py-3 text-right font-semibold cursor-pointer hover:text-purple-600" onClick={() => handleSort('avgEngagementTime')}>
                          Ø Zeit {sortField === 'avgEngagementTime' && (sortDirection === 'desc' ? <ArrowDown size={12} className="inline"/> : <ArrowUp size={12} className="inline"/>)}</th>
                        <th className="px-4 py-3 text-right font-semibold cursor-pointer hover:text-purple-600" onClick={() => handleSort('conversions')}>
                          Conv. {sortField === 'conversions' && (sortDirection === 'desc' ? <ArrowDown size={12} className="inline"/> : <ArrowUp size={12} className="inline"/>)}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPages.slice(0, 50).map((page, i) => (
                        <tr key={i} className="border-b border-border-subtle hover:bg-surface-tertiary">
                          <td className="px-4 py-3">
                            <div className="text-sm font-medium text-heading truncate max-w-[300px]" title={page.path}>
                              {page.path === '/' ? '/ (Startseite)' : page.path}</div>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {page.sources.slice(0, 2).map((s, j) => (
                                <span key={j} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium"
                                  style={{ backgroundColor: `${getSourceColor(s.source)}15`, color: getSourceColor(s.source) }}>
                                  {getSourceLabel(s.source)}</span>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                              style={{ backgroundColor: `${page.intent.color}15`, color: page.intent.color }}>
                              {getIntentIcon(page.intent.icon, 12)} {page.intent.label}</span>
                          </td>
                          <td className="px-4 py-3 text-right text-sm font-semibold text-heading">{page.sessions.toLocaleString('de-DE')}</td>
                          <td className="px-4 py-3 text-right text-sm">
                            <span className={cn("font-medium", page.engagementRate > 60 ? "text-green-600" : page.engagementRate > 40 ? "text-amber-600" : "text-secondary")}>
                              {page.engagementRate.toFixed(1)}%</span>
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-secondary">{formatDuration(page.avgEngagementTime)}</td>
                          <td className="px-4 py-3 text-right">
                            <span className={cn("inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded text-sm font-semibold",
                              page.conversions > 0 ? "bg-green-100 text-green-700" : "bg-surface-tertiary text-muted")}>{page.conversions}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredPages.length === 0 && <div className="text-center py-8 text-muted text-sm">Keine Ergebnisse gefunden</div>}
                </div>
              </div>
            )}

            {/* SOURCES TAB */}
            {activeTab === 'sources' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-surface-secondary rounded-xl p-5 border border-border-subtle">
                  <h3 className="text-sm font-semibold text-strong mb-4 flex items-center gap-2">
                    <BarChart3 size={14} className="text-purple-500" />Verteilung der KI-Quellen</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={sourceChartData} layout="vertical" margin={{ left: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--dp-chart-grid)" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--dp-chart-text)' }} />
                        <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: 'var(--dp-chart-text)', fontWeight: 500 }} width={100} />
                        <Tooltip cursor={{ fill: 'rgba(128,128,128,0.08)' }} contentStyle={{ backgroundColor: 'var(--dp-chart-tooltip-bg)', color: 'var(--dp-chart-tooltip-text)', borderRadius: '8px', border: '1px solid var(--dp-chart-tooltip-border)', boxShadow: 'var(--dp-shadow-card)' }} />
                        <Bar dataKey="sessions" radius={[0, 4, 4, 0]} barSize={20}>
                          {sourceChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-strong mb-3 flex items-center gap-2">
                    <Sparkles size={14} className="text-amber-500" />Performance nach Plattform</h3>
                  <div className="overflow-hidden rounded-xl border border-border-subtle">
                    <table className="w-full">
                      <thead className="bg-surface-secondary text-xs text-muted">
                        <tr>
                          <th className="px-4 py-2 text-left font-medium">Plattform</th>
                          <th className="px-4 py-2 text-right font-medium">Sessions</th>
                          <th className="px-4 py-2 text-right font-medium">Nutzer</th>
                          <th className="px-4 py-2 text-right font-medium">Interaktionsrate</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-subtle">
                        {sourceChartData.map((source, i) => (
                          <tr key={i} className="hover:bg-surface-tertiary transition-colors">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: source.fill }} />
                                <span className="text-sm font-medium text-heading">{source.name}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right text-sm text-secondary">{source.sessions.toLocaleString('de-DE')}</td>
                            <td className="px-4 py-3 text-right text-sm text-secondary">{source.users.toLocaleString('de-DE')}</td>
                            <td className="px-4 py-3 text-right text-sm">
                              <span className={cn("font-medium", source.engagementRate > 50 ? "text-green-600" : "text-secondary")}>
                                {source.engagementRate.toFixed(1)}%</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* FOOTER */}
          <div className="pt-4 border-t border-border-subtle">
            <div className="flex items-start gap-2 text-xs text-muted">
              <Info size={14} className="text-faint mt-0.5 shrink-0" />
              <p><strong>Intent-Kategorisierung:</strong> Seiten werden automatisch anhand ihrer URL-Struktur kategorisiert.
                Die User-Journey zeigt, welche Seiten nach dem KI-Einstieg besucht werden.</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
