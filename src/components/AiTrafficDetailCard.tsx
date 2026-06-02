// src/components/AiTrafficDetailCard.tsx
'use client';

import React, { useState, useMemo } from 'react';
import { 
  Cpu, 
  FunnelFill, 
  SortDown, 
  SortUp,
  FileEarmarkText,
  Search,
  XCircleFill,
  ArrowRepeat,
  GraphUpArrow,
  People,
  Clock,
  ChevronDown,
  ChevronUp,
  ExclamationTriangleFill,
  InfoCircle
} from 'react-bootstrap-icons';
import { cn } from '@/lib/utils';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid,
  BarChart,
  Bar,
  Cell
} from 'recharts';
import { format, subDays, subMonths } from 'date-fns';
import { de } from 'date-fns/locale';

// ============================================================================
// TYPEN
// ============================================================================

export interface AiLandingPageData {
  path: string;
  sessions: number;
  users: number;
  avgEngagementTime: number;
  bounceRate: number;
  conversions: number;
  sources: {
    source: string;
    sessions: number;
    users: number;
  }[];
}

export interface AiSourceData {
  source: string;
  sessions: number;
  users: number;
  percentage: number;
  conversions: number;
  conversionRate: number; // in % (conversions / sessions * 100)
  topLandingPage?: { path: string; sessions: number; conversions: number };
  topPages: {
    path: string;
    sessions: number;
    conversions?: number;
  }[];
}

export interface AiTrafficDetailData {
  totalSessions: number;
  totalUsers: number;
  totalSessionsChange?: number;
  totalUsersChange?: number;
  avgEngagementTime: number;
  bounceRate: number;
  conversions: number;
  sources: AiSourceData[];
  landingPages: AiLandingPageData[];
  trend: { date: string; sessions: number; users: number }[];
}

interface AiTrafficDetailCardProps {
  data?: AiTrafficDetailData;
  isLoading?: boolean;
  dateRange?: string;
  className?: string;
  error?: string;
  onRefresh?: () => void;
}

// ============================================================================
// KONSTANTEN
// ============================================================================

const AI_SOURCE_COLORS: Record<string, string> = {
  'chatgpt.com': '#10a37f',
  'chat.openai.com': '#10a37f',
  'openai.com': '#10a37f',
  'claude.ai': '#d97706',
  'anthropic.com': '#d97706',
  'perplexity.ai': '#6366f1',
  'gemini.google.com': '#4285f4',
  'bard.google.com': '#4285f4',
  'copilot.microsoft.com': '#00a4ef',
  'bing.com': '#00a4ef',
  'you.com': '#8b5cf6',
  'poe.com': '#7c3aed',
  'character.ai': '#ec4899',
  'default': '#6b7280'
};

const AI_SOURCE_LABELS: Record<string, string> = {
  'chatgpt.com': 'ChatGPT',
  'chat.openai.com': 'ChatGPT',
  'openai.com': 'OpenAI',
  'claude.ai': 'Claude',
  'anthropic.com': 'Anthropic',
  'perplexity.ai': 'Perplexity',
  'gemini.google.com': 'Gemini',
  'bard.google.com': 'Google Bard',
  'copilot.microsoft.com': 'Copilot',
  'bing.com': 'Bing Chat',
  'you.com': 'You.com',
  'poe.com': 'Poe',
  'character.ai': 'Character.AI'
};

type SortField = 'sessions' | 'users' | 'avgEngagementTime' | 'bounceRate' | 'conversions';
type SortDirection = 'asc' | 'desc';
type ViewMode = 'pages' | 'sources';

// ============================================================================
// HELPER FUNKTIONEN
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

// KPI Mini-Card
const KpiMini: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string | number;
  change?: number;
  color?: string;
}> = ({ icon, label, value, change, color = 'purple' }) => (
  <div className={`bg-${color}-50 rounded-xl p-4 border border-${color}-100/50`}>
    <div className="flex items-center gap-2 mb-1">
      <span className={`text-${color}-600`}>{icon}</span>
      <span className={`text-xs font-medium text-${color}-700`}>{label}</span>
    </div>
    <div className="flex items-baseline gap-2">
      <span className={`text-2xl font-bold text-${color}-900`}>
        {typeof value === 'number' ? value.toLocaleString('de-DE') : value}
      </span>
      {change !== undefined && (
        <span className={`text-xs font-semibold ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {change >= 0 ? '+' : ''}{change.toFixed(1)}%
        </span>
      )}
    </div>
  </div>
);

// Source Badge
const SourceBadge: React.FC<{ source: string; sessions: number }> = ({ source, sessions }) => (
  <span 
    className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium text-white shadow-sm"
    style={{ backgroundColor: getSourceColor(source) }}
  >
    <span className="w-1.5 h-1.5 rounded-full bg-surface/30" />
    {getSourceLabel(source)}
    <span className="opacity-75">({sessions})</span>
  </span>
);

// Sort Button
const SortButton: React.FC<{
  field: SortField;
  currentField: SortField;
  direction: SortDirection;
  onClick: (field: SortField) => void;
  children: React.ReactNode;
}> = ({ field, currentField, direction, onClick, children }) => (
  <button
    onClick={() => onClick(field)}
    className={cn(
      "flex items-center gap-1 text-xs font-semibold transition-colors",
      currentField === field ? "text-purple-700" : "text-muted hover:text-body"
    )}
  >
    {children}
    {currentField === field && (
      direction === 'desc' ? <SortDown size={12} /> : <SortUp size={12} />
    )}
  </button>
);

// ============================================================================
// HAUPTKOMPONENTE
// ============================================================================

export default function AiTrafficDetailCard({
  data,
  isLoading = false,
  dateRange = '30d',
  className,
  error,
  onRefresh
}: AiTrafficDetailCardProps) {
  
  // State
  const [viewMode, setViewMode] = useState<ViewMode>('pages');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('sessions');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [isExpanded, setIsExpanded] = useState(true);

  // Sortierung Handler
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'desc' ? 'asc' : 'desc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Gefilterte & sortierte Landingpages
  const filteredPages = useMemo(() => {
    if (!data?.landingPages) return [];

    let filtered = [...data.landingPages];

    // (not set) ausfiltern - keine aussagekräftige Information
    filtered = filtered.filter(p => 
      p.path !== '(not set)' && p.path !== '(not provided)'
    );

    // Suchfilter
    if (searchTerm) {
      filtered = filtered.filter(p => 
        p.path.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Source Filter
    if (selectedSource) {
      filtered = filtered.filter(p => 
        p.sources.some(s => s.source.toLowerCase().includes(selectedSource.toLowerCase()))
      );
    }

    // Sortierung
    filtered.sort((a, b) => {
      let aVal = a[sortField] ?? 0;
      let bVal = b[sortField] ?? 0;
      
      // Für bounceRate invertieren wir die Sortierung, da wir Interaktionsrate anzeigen
      // Hohe Interaktion (= niedrige Bounce) soll bei "desc" oben stehen
      if (sortField === 'bounceRate') {
        aVal = 100 - aVal;
        bVal = 100 - bVal;
      }
      
      return sortDirection === 'desc' ? bVal - aVal : aVal - bVal;
    });

    return filtered;
  }, [data?.landingPages, searchTerm, selectedSource, sortField, sortDirection]);

  // Helper: Pfad formatieren (/ = Startseite)
  const formatPath = (path: string): string => {
    if (path === '/') return '/ (Startseite)';
    return path;
  };

  // Chart-Daten für Quellen
  const sourceChartData = useMemo(() => {
    if (!data?.sources) return [];
    return data.sources.slice(0, 6).map(s => ({
      name: getSourceLabel(s.source),
      sessions: s.sessions,
      users: s.users,
      fill: getSourceColor(s.source)
    }));
  }, [data?.sources]);

  // Trend-Daten formatieren
  const trendData = useMemo(() => {
    if (!data?.trend) return [];
    return data.trend.map(t => ({
      ...t,
      dateFormatted: format(new Date(t.date), 'dd.MM', { locale: de })
    }));
  }, [data?.trend]);

  const formattedDateRange = getDateRangeString(dateRange);

  // ========== LOADING STATE ==========
  if (isLoading) {
    return (
      <div className={cn("bg-surface rounded-2xl border border-theme-border-default shadow-sm overflow-hidden", className)}>
        <div className="p-6 animate-pulse">
          <div className="h-8 bg-surface-tertiary rounded w-1/3 mb-6" />
          <div className="grid grid-cols-4 gap-4 mb-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-surface-secondary rounded-xl" />
            ))}
          </div>
          <div className="h-64 bg-surface-secondary rounded-xl" />
        </div>
      </div>
    );
  }

  // ========== ERROR STATE ==========
  if (error) {
    return (
      <div className={cn("bg-surface rounded-2xl border border-theme-border-default shadow-sm p-6", className)}>
        <div className="flex flex-col items-center justify-center text-center py-8">
          <ExclamationTriangleFill className="text-red-500 w-12 h-12 mb-4" />
          <h3 className="text-lg font-semibold text-heading mb-2">Fehler beim Laden</h3>
          <p className="text-sm text-muted mb-4 max-w-md">{error}</p>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <ArrowRepeat size={16} />
              Erneut versuchen
            </button>
          )}
        </div>
      </div>
    );
  }

  // ========== EMPTY STATE ==========
  if (!data || data.totalSessions === 0) {
    return (
      <div className={cn("bg-surface rounded-2xl border border-theme-border-default shadow-sm p-6", className)}>
        <div className="flex flex-col items-center justify-center text-center py-12">
          <div className="w-16 h-16 rounded-2xl bg-purple-50 flex items-center justify-center mb-4">
            <Cpu className="text-purple-400" size={32} />
          </div>
          <h3 className="text-lg font-semibold text-heading mb-2">Keine KI-Traffic Daten</h3>
          <p className="text-sm text-muted max-w-md">
            Im ausgewählten Zeitraum wurden keine Besuche von KI-Plattformen wie ChatGPT, Claude oder Perplexity erfasst.
          </p>
        </div>
      </div>
    );
  }

  // ========== MAIN RENDER ==========
  return (
    <div className={cn(
      "bg-surface rounded-2xl border border-theme-border-default shadow-sm overflow-hidden transition-all duration-300",
      className
    )}>
      
      {/* ===== HEADER ===== */}
      <div className="px-6 pt-6 pb-4 border-b border-theme-border-subtle">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
              <Cpu className="text-white" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-heading">KI-Traffic Analyse</h2>
              <p className="text-sm text-muted">Detaillierte Auswertung nach Quelle & Landingpage</p>
            </div>
          </div>
          
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 hover:bg-surface-tertiary rounded-lg transition-colors"
          >
            {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>
        </div>

        {/* Meta-Info */}
        <div className="flex items-center gap-3 text-xs">
          <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded font-semibold">
            Quelle: GA4
          </span>
          <span className="text-faint">•</span>
          <span className="text-muted">{formattedDateRange}</span>
          {onRefresh && (
            <>
              <span className="text-faint">•</span>
              <button
                onClick={onRefresh}
                className="text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1"
              >
                <ArrowRepeat size={12} />
                Aktualisieren
              </button>
            </>
          )}
        </div>
      </div>

      {isExpanded && (
        <>
          {/* ===== KPI GRID ===== */}
          <div className="px-6 py-5 bg-gradient-to-b from-gray-50/50 to-white">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-purple-50 rounded-xl p-4 border border-purple-100/50">
                <div className="flex items-center gap-2 mb-1">
                  <GraphUpArrow className="text-purple-600" size={16} />
                  <span className="text-xs font-medium text-purple-700">Sitzungen</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-purple-900">
                    {data.totalSessions.toLocaleString('de-DE')}
                  </span>
                  {data.totalSessionsChange !== undefined && (
                    <span className={`text-xs font-semibold ${data.totalSessionsChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {data.totalSessionsChange >= 0 ? '+' : ''}{data.totalSessionsChange.toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>

              <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100/50">
                <div className="flex items-center gap-2 mb-1">
                  <People className="text-indigo-600" size={16} />
                  <span className="text-xs font-medium text-indigo-700">Nutzer</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-indigo-900">
                    {data.totalUsers.toLocaleString('de-DE')}
                  </span>
                  {data.totalUsersChange !== undefined && (
                    <span className={`text-xs font-semibold ${data.totalUsersChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {data.totalUsersChange >= 0 ? '+' : ''}{data.totalUsersChange.toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>

              <div className="bg-teal-50 rounded-xl p-4 border border-teal-100/50">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="text-teal-600" size={16} />
                  <span className="text-xs font-medium text-teal-700">Ø Verweildauer</span>
                </div>
                <span className="text-2xl font-bold text-teal-900">
                  {formatDuration(data.avgEngagementTime)}
                </span>
              </div>

              <div className="bg-amber-50 rounded-xl p-4 border border-amber-100/50">
                <div className="flex items-center gap-2 mb-1">
                  <FunnelFill className="text-amber-600" size={16} />
                  <span className="text-xs font-medium text-amber-700">Conversions</span>
                </div>
                <span className="text-2xl font-bold text-amber-900">
                  {data.conversions.toLocaleString('de-DE')}
                </span>
              </div>
            </div>
          </div>

          {/* ===== CHARTS ROW ===== */}
          <div className="px-6 py-5 grid grid-cols-1 lg:grid-cols-2 gap-6 border-b border-theme-border-subtle">
            
            {/* Trend Chart */}
            <div>
              <h3 className="text-sm font-semibold text-strong mb-3 flex items-center gap-2">
                <GraphUpArrow size={14} className="text-purple-500" />
                Sitzungs-Trend
              </h3>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData}>
                    <defs>
                      <linearGradient id="aiDetailGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="dateFormatted" 
                      tick={{ fontSize: 10, fill: '#6b7280' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis 
                      tick={{ fontSize: 10, fill: '#6b7280' }}
                      tickLine={false}
                      axisLine={false}
                      width={40}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        fontSize: '12px',
                        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
                      }}
                      formatter={(value: number, name: string) => [
                        value.toLocaleString('de-DE'),
                        name === 'sessions' ? 'Sitzungen' : 'Nutzer'
                      ]}
                    />
                    <Area
                      type="monotone"
                      dataKey="sessions"
                      stroke="#8b5cf6"
                      strokeWidth={2}
                      fill="url(#aiDetailGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Sources Bar Chart */}
            <div>
              <h3 className="text-sm font-semibold text-strong mb-3 flex items-center gap-2">
                <Cpu size={14} className="text-purple-500" />
                KI-Quellen Verteilung
              </h3>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sourceChartData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: '#6b7280' }} />
                    <YAxis 
                      dataKey="name" 
                      type="category" 
                      tick={{ fontSize: 11, fill: '#374151' }}
                      width={90}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        fontSize: '12px'
                      }}
                      formatter={(value: number) => [value.toLocaleString('de-DE'), 'Sitzungen']}
                    />
                    <Bar dataKey="sessions" radius={[0, 4, 4, 0]}>
                      {sourceChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* ===== FILTER & VIEW TOGGLE ===== */}
          <div className="px-6 py-4 bg-surface-secondary/50 border-b border-theme-border-subtle">
            <div className="flex flex-wrap items-center justify-between gap-4">
              
              {/* View Mode Toggle */}
              <div className="flex items-center bg-surface rounded-lg border border-theme-border-default p-1">
                <button
                  onClick={() => setViewMode('pages')}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                    viewMode === 'pages' 
                      ? "bg-purple-600 text-white shadow-sm" 
                      : "text-secondary hover:text-heading"
                  )}
                >
                  <FileEarmarkText size={14} className="inline mr-1.5" />
                  Landingpages
                </button>
                <button
                  onClick={() => setViewMode('sources')}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                    viewMode === 'sources' 
                      ? "bg-purple-600 text-white shadow-sm" 
                      : "text-secondary hover:text-heading"
                  )}
                >
                  <Cpu size={14} className="inline mr-1.5" />
                  Nach Quelle
                </button>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-3">
                
                {/* Search */}
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Seite suchen..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 pr-8 py-2 text-sm border border-theme-border-default rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 w-56 bg-surface"
                  />
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" size={14} />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-faint hover:text-secondary"
                    >
                      <XCircleFill size={16} />
                    </button>
                  )}
                </div>

                {/* Source Filter Dropdown */}
                <div className="relative">
                  <select
                    value={selectedSource || ''}
                    onChange={(e) => setSelectedSource(e.target.value || null)}
                    className="pl-9 pr-8 py-2 text-sm border border-theme-border-default rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 bg-surface appearance-none cursor-pointer"
                  >
                    <option value="">Alle Quellen</option>
                    {data.sources.map(s => (
                      <option key={s.source} value={s.source}>
                        {getSourceLabel(s.source)} ({s.sessions})
                      </option>
                    ))}
                  </select>
                  <FunnelFill className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" size={14} />
                </div>
              </div>
            </div>
          </div>

          {/* ===== DATA TABLE ===== */}
          <div className="px-6 py-4 overflow-x-auto">
            
            {viewMode === 'pages' ? (
              <>
                {/* Table Header - Feste Breiten statt Grid */}
                <div className="min-w-[800px]">
                  <div className="flex items-center px-4 py-3 bg-surface-secondary rounded-lg mb-2 text-xs">
                    <div className="flex-1 min-w-[300px] font-semibold text-secondary">Landingpage</div>
                    <div className="w-[90px] text-center">
                      <SortButton field="sessions" currentField={sortField} direction={sortDirection} onClick={handleSort}>
                        Sitzungen
                      </SortButton>
                    </div>
                    <div className="w-[70px] text-center">
                      <SortButton field="users" currentField={sortField} direction={sortDirection} onClick={handleSort}>
                        Nutzer
                      </SortButton>
                    </div>
                    <div className="w-[70px] text-center">
                      <SortButton field="avgEngagementTime" currentField={sortField} direction={sortDirection} onClick={handleSort}>
                        Ø Zeit
                      </SortButton>
                    </div>
                    <div className="w-[90px] text-center">
                      <SortButton field="bounceRate" currentField={sortField} direction={sortDirection} onClick={handleSort}>
                        Interaktion
                      </SortButton>
                    </div>
                    <div className="w-[70px] text-center">
                      <SortButton field="conversions" currentField={sortField} direction={sortDirection} onClick={handleSort}>
                        Conv.
                      </SortButton>
                    </div>
                  </div>

                  {/* Table Body */}
                  <div className="space-y-1 max-h-[400px] overflow-y-auto custom-scrollbar">
                    {filteredPages.length === 0 ? (
                      <div className="text-center py-8 text-muted text-sm">
                        {searchTerm || selectedSource 
                          ? 'Keine Ergebnisse für diese Filter' 
                          : 'Keine Landingpage-Daten verfügbar'}
                      </div>
                    ) : (
                      filteredPages.map((page, i) => (
                        <div 
                          key={i}
                          className="flex items-center px-4 py-3 hover:bg-purple-50/50 rounded-lg transition-colors group"
                        >
                          <div className="flex-1 min-w-[300px] pr-4">
                            <div className="font-medium text-strong text-sm truncate mb-1" title={page.path}>
                              {formatPath(page.path)}
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {page.sources.slice(0, 3).map((s, j) => (
                                <span
                                  key={j}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium"
                                  style={{ 
                                    backgroundColor: `${getSourceColor(s.source)}15`,
                                    color: getSourceColor(s.source)
                                  }}
                                >
                                  {getSourceLabel(s.source)}
                                </span>
                              ))}
                              {page.sources.length > 3 && (
                                <span className="text-[10px] text-faint">
                                  +{page.sources.length - 3}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="w-[90px] text-center">
                            <span className="text-sm font-semibold text-heading">
                              {page.sessions.toLocaleString('de-DE')}
                            </span>
                          </div>
                          <div className="w-[70px] text-center">
                            <span className="text-sm text-secondary">
                              {page.users.toLocaleString('de-DE')}
                            </span>
                          </div>
                          <div className="w-[70px] text-center">
                            <span className="text-sm text-secondary">
                              {formatDuration(page.avgEngagementTime)}
                            </span>
                          </div>
                          <div className="w-[90px] text-center">
                            <span className={cn(
                              "text-sm font-medium",
                              (100 - page.bounceRate) >= 50 ? "text-green-600" : 
                              (100 - page.bounceRate) >= 30 ? "text-amber-600" : "text-red-600"
                            )}>
                              {(100 - page.bounceRate).toFixed(0)}%
                            </span>
                          </div>
                          <div className="w-[70px] text-center">
                            <span className={cn(
                              "inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded text-sm font-semibold",
                              page.conversions > 0 
                                ? "bg-green-100 text-green-700" 
                                : "bg-surface-tertiary text-muted"
                            )}>
                              {page.conversions}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            ) : (
              /* Sources View */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.sources.map((source, i) => {
                  // Filtere (not set) aus den Top-Seiten
                  const cleanTopPages = source.topPages.filter(p => 
                    p.path !== '(not set)' && p.path !== '(not provided)'
                  );
                  
                  return (
                    <div 
                      key={i}
                      className="p-4 rounded-xl border border-theme-border-subtle hover:border-purple-200 hover:shadow-md transition-all bg-surface"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span 
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: getSourceColor(source.source) }}
                          />
                          <span className="font-semibold text-heading">
                            {getSourceLabel(source.source)}
                          </span>
                        </div>
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
                          {source.percentage.toFixed(1)}%
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div>
                          <div className="text-xs text-muted mb-0.5">Sitzungen</div>
                          <div className="text-lg font-bold text-heading">
                            {source.sessions.toLocaleString('de-DE')}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted mb-0.5">Nutzer</div>
                          <div className="text-lg font-bold text-heading">
                            {source.users.toLocaleString('de-DE')}
                          </div>
                        </div>
                      </div>

                      {source.conversions > 0 && (
                        <div className="flex items-center justify-between mb-3 text-xs">
                          <span className="text-muted">Conversions</span>
                          <span className="font-medium text-heading tabular-nums">
                            {source.conversions.toLocaleString('de-DE')}
                            <span className="text-faint mx-1">·</span>
                            <span
                              className={cn(
                                'font-medium',
                                source.conversionRate >= 3 ? 'text-green-600' :
                                source.conversionRate >= 1 ? 'text-amber-600' :
                                'text-muted'
                              )}
                            >
                              {source.conversionRate.toFixed(1)}%
                            </span>
                          </span>
                        </div>
                      )}

                      {cleanTopPages.length > 0 && (
                        <div>
                          <div className="text-xs font-semibold text-muted mb-2">Top Seiten</div>
                          <div className="space-y-1">
                            {cleanTopPages.slice(0, 3).map((page, j) => (
                              <div 
                                key={j}
                                className="flex items-center justify-between text-xs"
                              >
                                <span className="text-secondary truncate max-w-[70%]" title={page.path}>
                                  {formatPath(page.path)}
                                </span>
                                <span className="text-faint font-medium">
                                  {page.sessions}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ===== FOOTER INFO ===== */}
          <div className="px-6 py-4 bg-surface-secondary border-t border-theme-border-subtle">
            <div className="flex items-start gap-2 text-xs text-muted">
              <InfoCircle size={14} className="text-faint mt-0.5 shrink-0" />
              <p>
                <strong>Hinweis:</strong> KI-Traffic umfasst Besuche von ChatGPT, Claude, Perplexity, Gemini und weiteren KI-Assistenten. 
                Die tatsächliche Suchanfrage der Nutzer wird von diesen Plattformen nicht übermittelt – 
                nur die Landingpage und Quelle sind auswertbar.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
