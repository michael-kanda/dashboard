'use client';

import { useMemo } from 'react';
import { ExclamationTriangleFill, InfoCircle } from 'react-bootstrap-icons';
import { Line, LineChart, ResponsiveContainer, YAxis } from 'recharts';
import type { ChartPoint } from '@/lib/dashboard-shared';

interface TableauKpiCardProps {
  title: string;
  value: number;
  change?: number;
  isLoading?: boolean;
  data?: ChartPoint[];
  color?: string;
  error?: string | null;
  className?: string;
  comparison?: {
    current: number;
    previous: number;
  };
  formatValue?: (value: number) => string;
  description?: string;
  source: 'GSC' | 'GA4';
}

export default function TableauKpiCard({
  title,
  value,
  change,
  isLoading = false,
  data,
  color = '#3b82f6',
  error = null,
  className = '',
  comparison,
  formatValue = (currentValue) => currentValue.toLocaleString('de-DE'),
  description,
  source,
}: TableauKpiCardProps) {
  const isPositive = change !== undefined && change >= 0;
  const previousValue = comparison ? formatValue(comparison.previous) : null;

  const yDomain = useMemo(() => {
    const values = (data ?? [])
      .map((point) => point.value)
      .filter((pointValue) => Number.isFinite(pointValue));

    if (values.length === 0) return [0, 1];

    const min = Math.min(...values);
    const max = Math.max(...values);
    if (min === max) {
      const padding = Math.max(Math.abs(min) * 0.1, 1);
      return [Math.max(0, min - padding), max + padding];
    }

    const padding = (max - min) * 0.15;
    return [Math.max(0, min - padding), max + padding];
  }, [data]);

  if (isLoading) {
    return (
      <div className={`flex min-h-[184px] flex-col bg-surface p-4 sm:p-5 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-3 w-2/5 rounded bg-surface-tertiary" />
          <div className="h-8 w-3/5 rounded bg-surface-tertiary" />
          <div className="h-10 w-full rounded bg-surface-tertiary" />
          <div className="h-3 w-1/2 rounded bg-surface-tertiary" />
        </div>
      </div>
    );
  }

  return (
    <article className={`relative flex min-h-[184px] flex-col bg-surface p-4 sm:p-5 ${className}`}>
      <div className="flex min-h-6 items-center gap-2 text-xs text-muted">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
        <h4 className="font-medium text-body">{title}</h4>
        {description ? (
          <span className="group/info relative inline-flex items-center">
            <InfoCircle size={13} className="text-faint transition-colors group-hover/info:text-brand" aria-label={`Information zu ${title}`} />
            <span className="pointer-events-none invisible absolute bottom-full left-1/2 z-30 mb-2 w-56 -translate-x-1/2 rounded-md bg-gray-900 p-3 text-center text-xs font-normal leading-snug text-white opacity-0 shadow-xl transition-all group-hover/info:visible group-hover/info:opacity-100">
              {description}
            </span>
          </span>
        ) : null}
      </div>

      {error ? (
        <div className="flex flex-1 flex-col justify-center py-4">
          <div className="mb-1 flex items-center gap-2 text-red-600">
            <ExclamationTriangleFill size={15} />
            <span className="text-sm font-semibold">Daten nicht verfügbar</span>
          </div>
          <p className="text-xs text-muted">{error}</p>
        </div>
      ) : (
        <>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <strong className="text-2xl font-semibold leading-tight text-heading tabular-nums sm:text-[1.7rem]">
              {formatValue(value)}
            </strong>
            {change !== undefined ? (
              <span className={`text-xs font-semibold tabular-nums ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                {isPositive ? '+' : ''}{change.toFixed(1)} %
              </span>
            ) : null}
          </div>

          <div className="mt-3 h-10 min-h-10 opacity-90">
            {data && data.length > 1 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 3, right: 2, bottom: 3, left: 2 }}>
                  <YAxis domain={yDomain} hide allowDataOverflow={false} />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke={color}
                    strokeWidth={2}
                    dot={false}
                    activeDot={false}
                    animationDuration={500}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center" aria-hidden="true">
                <span className="h-px w-full bg-border-subtle" />
              </div>
            )}
          </div>
        </>
      )}

      <div className="mt-auto flex items-center justify-between gap-3 pt-2 text-[11px] text-faint">
        <span className="truncate tabular-nums">
          {previousValue ? `Vorher ${previousValue}` : 'Kein Vergleichswert'}
        </span>
        <span className="shrink-0 font-medium">{source}</span>
      </div>
    </article>
  );
}
