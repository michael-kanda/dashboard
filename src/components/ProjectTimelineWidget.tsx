// src/components/ProjectTimelineWidget.tsx
'use client';

import useSWR from 'swr';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import { 
  CalendarWeek, 
  ClockHistory, 
  GraphUpArrow, 
  GraphDownArrow, 
  HourglassSplit,
  ListCheck,
  BoxSeam,
  Trophy,
  ArrowUp,
  ArrowDown, 
  Dash,
  Search,
  Cpu
} from 'react-bootstrap-icons';
import { addMonths, format, differenceInCalendarDays } from 'date-fns';
import { de } from 'date-fns/locale';

interface StatusCounts {
  'Offen': number;
  'In Prüfung': number;
  'Gesperrt': number;
  'Freigegeben': number;
  'Total': number;
}
interface TrendPoint {
  date: string;
  value: number;
}
interface TopMover {
  url: string;
  haupt_keyword: string | null;
  gsc_impressionen: number;
  gsc_impressionen_change: number;
}
interface TimelineData {
  project: {
    startDate: string;
    durationMonths: number;
  };
  progress: {
    counts: StatusCounts;
    percentage: number;
  };
  gscImpressionTrend: TrendPoint[];
  aiTrafficTrend?: TrendPoint[];
  genAiImpressionTrend?: TrendPoint[];
  topMovers?: TopMover[];
}

const fetcher = (url: string) => fetch(url).then((res) => {
  if (!res.ok) {
    return res.json().then(errorData => {
      throw new Error(errorData.message || 'Fehler beim Laden der Timeline-Daten.');
    });
  }
  return res.json();
});

// Berechnet den Trend über den GESAMTEN Zeitraum mittels linearer Regression
function calculateTrendDirection(data: TrendPoint[]): 'up' | 'down' | 'neutral' {
  if (!data || data.length < 2) return 'neutral';

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  const n = data.length;

  for (let i = 0; i < n; i++) {
    const x = i;
    const y = data[i].value;
    
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  }

  const denominator = (n * sumXX - sumX * sumX);
  if (denominator === 0) return 'neutral';

  const slope = (n * sumXY - sumX * sumY) / denominator;

  if (slope > 0.01) return 'up';
  if (slope < -0.01) return 'down';
  
  return 'neutral';
}

// Berechnet die prozentuale Veränderung (Erster vs. Letzter Wert)
function calculatePercentageChange(data: TrendPoint[] | undefined): number {
  if (!data || data.length < 2) return 0;
  const first = data[0].value;
  const last = data[data.length - 1].value;
  
  if (first === 0) return last > 0 ? 100 : 0; // Verhinderung von Division durch Null
  return ((last - first) / first) * 100;
}

interface ProjectTimelineWidgetProps {
  projectId?: string;
  domain?: string | null;
}

export default function ProjectTimelineWidget({ projectId }: ProjectTimelineWidgetProps) {
  const apiUrl = projectId 
    ? `/api/project-timeline?projectId=${projectId}` 
    : '/api/project-timeline';
  
  const { data, error, isLoading } = useSWR<TimelineData>(apiUrl, fetcher);

  if (isLoading) {
    return (
      <div className="dashboard-widget-surface rounded-lg p-8 min-h-[300px] flex items-center justify-center animate-pulse">
        <HourglassSplit size={32} className="text-indigo-300 mb-3" />
      </div>
    );
  }

  if (error || !data || !data.project) return null;

  const { project, progress, gscImpressionTrend, aiTrafficTrend, genAiImpressionTrend, topMovers } = data;
  const { counts, percentage } = progress;
  
  // Projekt-Zeitraum
  const startDate = project?.startDate ? new Date(project.startDate) : new Date();
  const duration = project?.durationMonths || 6;
  const endDate = addMonths(startDate, duration);
  const today = new Date();
  
  // Fortschritt
  const totalProjectDays = Math.max(1, differenceInCalendarDays(endDate, startDate)); 
  const elapsedProjectDays = differenceInCalendarDays(today, startDate);
  const timeElapsedPercentage = Math.max(0, Math.min(100, (elapsedProjectDays / totalProjectDays) * 100));
  
  // Daten zusammenführen (null für fehlende GSC Daten, damit Chart nicht auf 0 fällt)
  const chartDataMap = new Map<string, { date: number; impressions: number | null; aiTraffic: number; genAiImpressions: number }>();
  
  gscImpressionTrend.forEach(d => {
    const timestamp = new Date(d.date).getTime();
    chartDataMap.set(d.date, { date: timestamp, impressions: d.value, aiTraffic: 0, genAiImpressions: 0 });
  });

  if (aiTrafficTrend) {
    aiTrafficTrend.forEach(d => {
      const entry = chartDataMap.get(d.date);
      if (entry) {
        entry.aiTraffic = d.value;
      } else {
        chartDataMap.set(d.date, { 
          date: new Date(d.date).getTime(), 
          impressions: null, 
          aiTraffic: d.value,
          genAiImpressions: 0
        });
      }
    });
  }

  if (genAiImpressionTrend) {
    genAiImpressionTrend.forEach(d => {
      const entry = chartDataMap.get(d.date);
      if (entry) {
        entry.genAiImpressions = d.value;
      } else {
        chartDataMap.set(d.date, {
          date: new Date(d.date).getTime(),
          impressions: null,
          aiTraffic: 0,
          genAiImpressions: d.value
        });
      }
    });
  }

  const chartData = Array.from(chartDataMap.values()).sort((a, b) => a.date - b.date);

  // X-Achsen-Domain aus tatsächlichen Daten berechnen
  const dataMinDate = chartData.length > 0 
    ? Math.min(...chartData.map(d => d.date)) 
    : startDate.getTime();
  const dataMaxDate = chartData.length > 0 
    ? Math.max(...chartData.map(d => d.date)) 
    : endDate.getTime();

  // Trends berechnen
  const gscTrend = calculateTrendDirection(gscImpressionTrend);
  const aiTrend = calculateTrendDirection(aiTrafficTrend || []);
  const genAiTrend = calculateTrendDirection(genAiImpressionTrend || []);
  
  // Summen & Prozentuale Änderung berechnen
  const totalGscImpressions = gscImpressionTrend.reduce((acc, curr) => acc + curr.value, 0);
  const totalAiSessions = aiTrafficTrend?.reduce((acc, curr) => acc + curr.value, 0) || 0;
  const totalGenAiImpressions = genAiImpressionTrend?.reduce((acc, curr) => acc + curr.value, 0) || 0;
  
  const gscChangePercent = calculatePercentageChange(gscImpressionTrend);
  const aiChangePercent = calculatePercentageChange(aiTrafficTrend);
  const genAiChangePercent = calculatePercentageChange(genAiImpressionTrend);

  // Helper Components
  const TrendIcon = ({ direction, colorClass }: { direction: 'up' | 'down' | 'neutral', colorClass: string }) => {
    if (direction === 'up') return <GraphUpArrow className={colorClass} size={16} />; // Etwas größer für die neue Position
    if (direction === 'down') return <GraphDownArrow className={colorClass} size={16} />;
    return <Dash className="text-faint" size={16} />;
  };

  // Das neue Badge-Element (Grün/Rot mit Pfeil, Style wie Top-Performer)
  const ChangeBadge = ({ change }: { change: number }) => {
    if (change === 0) return null;
    const isPositive = change > 0;
    
    const colorClass = isPositive 
      ? 'text-green-600 border-green-100' 
      : 'text-red-600 border-red-100';
    
    const Icon = isPositive ? ArrowUp : ArrowDown;

    return (
      <div className={`flex items-center gap-1 font-bold text-[10px] bg-surface px-1.5 py-0.5 rounded border shadow-sm ${colorClass} mb-1`}>
        <Icon size={9} />
        {Math.abs(change).toFixed(0)}%
      </div>
    );
  };

  return (
    <div className="dashboard-widget-surface rounded-lg p-6 lg:p-8 print-timeline">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 border-b border-theme-border-default/50 pb-4">
        <div>
          <h2 className="text-xl font-bold text-heading flex items-center gap-2">
            <ClockHistory className="text-indigo-600" size={22} />
            Projekt-Status
          </h2>
        </div>
        <div className="mt-2 sm:mt-0">
           <div className="px-3 py-1 bg-indigo-50/80 text-indigo-700 rounded-full text-xs font-semibold border border-indigo-100/50 backdrop-blur-sm">
             Laufzeit: {duration} Monate
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full">
        
        {/* SPALTE 1: Zeit & Status & KPIs */}
        <div className="flex flex-col gap-8 border-b lg:border-b-0 lg:border-r border-theme-border-subtle pb-6 lg:pb-0 lg:pr-6">
          {/* Zeitachse */}
          <div className="space-y-3">
            <div className="flex justify-between items-end mb-2">
              <div className="flex items-center gap-2 text-lg font-semibold text-heading">
                <CalendarWeek className="text-indigo-500" size={20} />
                <h3>Zeitachse</h3>
              </div>
              <span className="text-sm font-medium text-muted">{Math.round(timeElapsedPercentage)}% vergangen</span>
            </div>
            <div className="relative h-10 w-full bg-surface-tertiary/80 rounded-lg border border-theme-border-default/60 overflow-hidden">
              <div className="absolute top-0 left-0 h-full bg-indigo-200 border-r-2 border-indigo-500 transition-all duration-1000" style={{ width: `${timeElapsedPercentage}%` }} />
              <div className="absolute inset-0 flex justify-between items-center px-4 text-xs font-medium text-muted pointer-events-none">
                <div className="flex flex-col items-start z-10"><span className="text-[10px] uppercase tracking-wider text-muted">Start</span><span className="text-strong">{format(startDate, 'dd.MM.yyyy')}</span></div>
                <div className="flex flex-col items-end z-10"><span className="text-[10px] uppercase tracking-wider text-faint">Ende</span><span className="text-muted">{format(endDate, 'dd.MM.yyyy')}</span></div>
              </div>
            </div>
          </div>

          {/* Status */}
          <div className="space-y-3">
            <div className="flex justify-between items-end mb-2">
              <div className="flex items-center gap-2 text-lg font-semibold text-heading">
                <ListCheck className="text-green-600" size={22} />
                <h3>Landingpages Status</h3>
              </div>
              <div className="flex items-baseline gap-1"><span className="text-2xl font-bold text-heading">{Math.round(percentage)}%</span><span className="text-sm text-muted font-medium">fertig</span></div>
            </div>
            <div className="h-6 w-full bg-surface-tertiary/80 rounded-full overflow-hidden flex shadow-inner border border-theme-border-default/60">
              {counts.Total > 0 ? (
                <>
                  <div className="bg-green-500 h-full" style={{ width: `${(counts.Freigegeben / counts.Total) * 100}%` }} />
                  <div className="bg-amber-400 h-full" style={{ width: `${(counts['In Prüfung'] / counts.Total) * 100}%` }} />
                  <div className="bg-red-400 h-full" style={{ width: `${(counts.Gesperrt / counts.Total) * 100}%` }} />
                </>
              ) : (<div className="w-full h-full flex items-center justify-center text-xs text-faint">Keine Daten</div>)}
            </div>
            <div className="flex flex-wrap gap-3 mt-2 text-[11px] text-muted justify-between">
              <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span>Freig.: {counts.Freigegeben}</div>
              <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400"></span>Prüf.: {counts['In Prüfung']}</div>
              <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400"></span>Gesp.: {counts.Gesperrt}</div>
              <div className="flex items-center gap-1 font-medium text-body"><BoxSeam size={10} />Ges: {counts.Total}</div>
            </div>
          </div>

          {/* NEU: KI Trend & GSC Trend Icons mit Zahlen und Change Badge */}
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3 gap-3 pt-2">
            {/* GSC Summary */}
            <div className="bg-blue-50/50 rounded-xl p-3 border border-blue-100 shadow-sm">
               <div className="flex items-center gap-2 mb-2 text-blue-600">
                  <Search size={14} />
                  <span className="text-xs font-bold uppercase tracking-wide opacity-80">GSC Impr.</span>
               </div>
               <div className="flex items-end gap-2">
                  <div className="mb-1"><TrendIcon direction={gscTrend} colorClass="text-blue-600" /></div>
                  <span className="text-xl font-bold text-heading leading-none">
                    {new Intl.NumberFormat('de-DE', { notation: 'compact', maximumFractionDigits: 1 }).format(totalGscImpressions)}
                  </span>
                  <ChangeBadge change={gscChangePercent} />
               </div>
            </div>

            {/* KI Summary */}
            <div className="bg-purple-50/50 rounded-xl p-3 border border-purple-100 shadow-sm">
               <div className="flex items-center gap-2 mb-2 text-purple-600">
                  <Cpu size={14} />
                  <span className="text-xs font-bold uppercase tracking-wide opacity-80">KI Traffic</span>
               </div>
               <div className="flex items-end gap-2">
                  <div className="mb-1"><TrendIcon direction={aiTrend} colorClass="text-purple-600" /></div>
                  <span className="text-xl font-bold text-heading leading-none">
                    {new Intl.NumberFormat('de-DE', { notation: 'compact', maximumFractionDigits: 1 }).format(totalAiSessions)}
                  </span>
                  <ChangeBadge change={aiChangePercent} />
               </div>
            </div>

            <div className="bg-sky-50/50 rounded-xl p-3 border border-sky-100 shadow-sm">
               <div className="flex items-center gap-2 mb-2 text-sky-600">
                  <Cpu size={14} />
                  <span className="text-xs font-bold uppercase tracking-wide opacity-80">Google GenAI</span>
               </div>
               <div className="flex items-end gap-2">
                  <div className="mb-1"><TrendIcon direction={genAiTrend} colorClass="text-sky-600" /></div>
                  <span className="text-xl font-bold text-heading leading-none">
                    {new Intl.NumberFormat('de-DE', { notation: 'compact', maximumFractionDigits: 1 }).format(totalGenAiImpressions)}
                  </span>
                  <ChangeBadge change={genAiChangePercent} />
               </div>
            </div>
          </div>

        </div>

        {/* SPALTE 2: Top Movers */}
        <div className="flex flex-col h-full border-b lg:border-b-0 lg:border-r border-theme-border-subtle pb-6 lg:pb-0 lg:px-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-lg font-semibold text-heading">
              <Trophy className="text-amber-500" size={20} />
              <h3>Top-Performer (GSC)</h3>
            </div>
            <span className="text-[10px] px-2 py-0.5 bg-surface-tertiary text-muted rounded-full">Trend (90T)</span>
          </div>
          {topMovers && topMovers.length > 0 ? (
            <div className="flex-grow overflow-hidden space-y-2">
              {topMovers.map((page, index) => (
                <div key={index} className="bg-surface-secondary/50 rounded-lg border border-theme-border-subtle p-3 hover:shadow-sm transition-all flex items-center justify-between">
                  <div className="min-w-0 flex-1 pr-3">
                    <div className="font-medium text-sm text-heading truncate" title={page.haupt_keyword || page.url}>
                      {page.haupt_keyword || <span className="text-faint italic">Kein Keyword</span>}
                    </div>
                    <div className="text-[10px] text-faint truncate mt-0.5">{new URL(page.url).pathname}</div>
                  </div>
                  <div className="flex items-center gap-1 text-green-600 font-bold text-xs bg-surface px-1.5 py-0.5 rounded border border-green-100 shadow-sm">
                    <ArrowUp size={10} />
                    {page.gsc_impressionen_change > 1000 ? (page.gsc_impressionen_change / 1000).toFixed(1) + 'k' : page.gsc_impressionen_change}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex-grow flex items-center justify-center text-faint text-xs italic border border-dashed border-theme-border-default rounded-lg bg-surface-secondary">Keine Daten</div>
          )}
        </div>

        {/* SPALTE 3: Reichweite Chart */}
        <div className="flex flex-col h-full">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
               {/* Titel */}
               <h3 className="text-lg font-semibold text-heading flex items-center gap-2">
                  <GraphUpArrow className="text-blue-500" size={18} />
                  Reichweite
               </h3>
            </div>
            
            {/* Legende */}
            <div className="flex gap-3 text-[10px]">
               <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500"></span> GSC</div>
               <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-500"></span> KI</div>
               <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-sky-500"></span> GenAI</div>
            </div>
          </div>

          <div className="bg-surface-secondary/50 rounded-xl border border-theme-border-default/60 p-4 h-full min-h-[200px] flex flex-col shadow-inner backdrop-blur-sm">
            <div className="flex-grow w-full relative">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorImpressions" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorAi" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorGenAi" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4285f4" stopOpacity={0.25}/>
                        <stop offset="95%" stopColor="#4285f4" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(t) => format(new Date(t), 'd.MM', { locale: de })}
                      type="number"
                      domain={[dataMinDate, dataMaxDate]}
                      tick={{ fontSize: 9, fill: '#6b7280' }}
                      tickMargin={5}
                      minTickGap={30}
                    />
                    <YAxis 
                      tickFormatter={(v) => new Intl.NumberFormat('de-DE', { notation: 'compact' }).format(v)}
                      tick={{ fontSize: 9, fill: '#6b7280' }}
                      width={35}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip 
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '12px', backgroundColor: 'rgba(255,255,255,0.95)' }}
                      labelFormatter={(v) => format(new Date(v), 'd. MMM yyyy', { locale: de })}
                      formatter={(value: any, name: string) => {
                        if (value === null || value === undefined) return ['Keine Daten (verzögert)', name === 'impressions' ? 'GSC Impressionen' : name === 'genAiImpressions' ? 'Google GenAI Impressionen' : 'KI Sitzungen'];
                        return [
                          new Intl.NumberFormat('de-DE').format(value), 
                          name === 'impressions' ? 'GSC Impressionen' : name === 'genAiImpressions' ? 'Google GenAI Impressionen' : 'KI Sitzungen'
                        ];
                      }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="impressions" 
                      name="impressions" 
                      stroke="#3b82f6" 
                      strokeWidth={2} 
                      fillOpacity={1} 
                      fill="url(#colorImpressions)" 
                      connectNulls={true}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="aiTraffic" 
                      name="aiTraffic" 
                      stroke="#8b5cf6" 
                      strokeWidth={2} 
                      fillOpacity={1} 
                      fill="url(#colorAi)" 
                    />
                    <Area
                      type="monotone"
                      dataKey="genAiImpressions"
                      name="genAiImpressions"
                      stroke="#4285f4"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      fillOpacity={1}
                      fill="url(#colorGenAi)"
                    />
                    {/* Reference Line für HEUTE */}
                    <ReferenceLine 
                      x={today.getTime()} 
                      stroke="#f59e0b" 
                      strokeDasharray="3 3" 
                      label={{ 
                        value: 'Heute', 
                        position: 'top', 
                        fill: '#f59e0b', 
                        fontSize: 10 
                      }} 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-faint">
                  <GraphUpArrow size={24} className="mb-2 opacity-20" />
                  <span className="text-xs">Keine Daten</span>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
