'use client';

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import type { GoogleGenAiPerformanceData } from '@/lib/dashboard-shared';
import { cn } from '@/lib/utils';

interface GoogleGenAiVisibilityCardProps {
  data?: GoogleGenAiPerformanceData;
  className?: string;
}

function GoogleCleanUnderline({ id }: { id: string }) {
  return (
    <div className="mt-1 h-[12px] max-w-[220px]" aria-hidden="true">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 12" width="100%" height="12">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="0">
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
        <rect width="100%" height="12" rx="6" fill={`url(#${id})`} />
      </svg>
    </div>
  );
}

function formatCompact(value: number) {
  return new Intl.NumberFormat('de-DE', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

function ChangeBadge({ change }: { change?: number }) {
  if (change === undefined || change === null) return null;
  const isPositive = change >= 0;
  return (
    <span className={cn(
      'rounded-md px-2 py-1 text-[11px] font-semibold tabular-nums',
      isPositive
        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
        : 'bg-rose-500/10 text-rose-600 dark:text-rose-300'
    )}>
      {isPositive ? '+' : ''}{change.toFixed(1)}%
    </span>
  );
}

export default function GoogleGenAiVisibilityCard({ data, className }: GoogleGenAiVisibilityCardProps) {
  const chartData = (data?.trend || []).map((point) => ({
    date: point.date,
    impressions: point.impressions,
  }));
  const hasData = data?.status === 'available' && data.totalImpressions > 0;
  const topPages = data?.topPages || [];
  const isManualExport = data?.source === 'gsc-manual-export';

  return (
    <div className={cn('dashboard-widget-surface rounded-lg p-6', className)}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-heading">Google GenAI Sichtbarkeit</h3>
          <GoogleCleanUnderline id="google-clean-gradient-genai-visibility" />
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span className="bg-surface-tertiary text-body px-2 py-0.5 rounded font-semibold">
              Quelle: {isManualExport ? 'GSC Export' : 'Search Console'}
            </span>
            <span className="text-faint">•</span>
            <span className="text-muted">AI Overviews / AI Mode</span>
            {isManualExport && data?.manualSource?.dateRange ? (
              <>
                <span className="text-faint">•</span>
                <span className="text-muted">{data.manualSource.dateRange}</span>
              </>
            ) : null}
            {data?.detectedAppearances?.length ? (
              <>
                <span className="text-faint">•</span>
                <span className="text-muted">{data.detectedAppearances.join(', ')}</span>
              </>
            ) : null}
          </div>
        </div>

        <div className="rounded-lg bg-surface-secondary px-4 py-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">GenAI-Impressions</p>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-semibold text-heading tabular-nums">
                {formatCompact(data?.totalImpressions || 0)}
              </span>
              <ChangeBadge change={data?.impressionsChange} />
            </div>
          </div>
        </div>
      </div>

      {!hasData ? (
        <div className="mt-5 rounded-lg border border-dashed border-border-subtle bg-surface-secondary p-4">
          <div>
            <p className="text-sm font-semibold text-heading">Noch keine offiziellen Google-GenAI-Daten sichtbar</p>
            <p className="mt-1 text-sm text-muted leading-relaxed">
              {data?.message || 'Google rollt den neuen Search-Console-Report schrittweise aus. Sobald die Property freigeschaltet ist oder die API passende Search-Appearance-Daten liefert, wird dieser Block automatisch befuellt.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1.35fr_1fr]">
          <div className="h-[260px] min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 8, right: 10, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="googleGenAiArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4285F4" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#4285F4" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--dp-chart-grid)" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) => format(new Date(value), 'd.MMM', { locale: de })}
                  tick={{ fontSize: 11, fill: 'var(--dp-chart-text)' }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={36}
                />
                <YAxis
                  tickFormatter={(value) => formatCompact(Number(value))}
                  tick={{ fontSize: 11, fill: 'var(--dp-chart-text)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 8,
                    border: '1px solid var(--dp-border)',
                    background: 'var(--dp-surface)',
                    color: 'var(--dp-text)',
                  }}
                  labelFormatter={(value) => format(new Date(value), 'dd. MMMM yyyy', { locale: de })}
                  formatter={(value: any) => [new Intl.NumberFormat('de-DE').format(Number(value)), 'GenAI-Impressions']}
                />
                <Area
                  type="monotone"
                  dataKey="impressions"
                  stroke="#4285F4"
                  strokeWidth={3}
                  fill="url(#googleGenAiArea)"
                  activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff', fill: '#4285F4' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="min-w-0">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-muted">Top-Seiten in Google GenAI</p>
            <div className="space-y-2">
              {topPages.slice(0, 5).map((page) => (
                <div key={page.key} className="flex items-center justify-between gap-3 rounded-md bg-surface-secondary px-3 py-2">
                  <span className="truncate font-mono text-xs text-body" title={page.key}>
                    {page.key}
                  </span>
                  <span className="shrink-0 text-sm font-semibold text-heading tabular-nums">
                    {formatCompact(page.impressions)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <p className="mt-5 text-xs leading-relaxed text-muted">
        {isManualExport
          ? 'Dieser Block nutzt einen manuell gespeicherten Search-Console-Export, weil Google die GenAI-Reportdaten fuer diese Property noch nicht ueber die Search Analytics API ausliefert.'
          : 'Dieser Block misst offizielle Google-Sichtbarkeit in generativen Search-Features. Er ist nicht identisch mit GA4-KI-Traffic und ersetzt nicht das Prompt Research, sondern ordnet es mit belastbareren Search-Console-Daten ein.'}
      </p>
    </div>
  );
}
