'use client';

// Druckbericht (A4 hoch): feste Diagrammgrößen statt ResponsiveContainer, gekürzte Listen, immer hell.
// Das Live-Dashboard lässt sich nicht sauber drucken, weil Recharts vor dem Druck nicht neu misst.
import { useEffect, useMemo } from 'react';
import { CartesianGrid, Cell, Line, LineChart, Pie, PieChart, XAxis, YAxis } from 'recharts';
import { Printer } from 'react-bootstrap-icons';
import type { ChartEntry, ProjectDashboardData } from '@/lib/dashboard-shared';
import type { DashboardWidgetVisibility } from '@/lib/dashboard-widget-visibility';
import type { ProjectIndexingStatus } from '@/lib/indexing-status';
import { buildDashboardViewModel } from '@/components/dashboard/view-model';
import { formatReportingPeriod } from '@/lib/reporting-period';
import { applyComparisonMode, type ComparisonMode } from '@/lib/comparison';
import { Button } from '@/components/ui/Button';

const TOP_QUERIES = 15;
const TOP_PAGES = 10;
const PIE_COLORS = ['#0066CC', '#AF52DE', '#34C759', '#FF9F0A', '#32ADE6', '#FF3B30', '#C7C7CC'];

const number = new Intl.NumberFormat('de-AT');
const decimal = new Intl.NumberFormat('de-AT', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

const formatCount = (value: number) => number.format(Math.round(value));
const formatPercent = (value: number) => `${decimal.format(value)} %`;
const formatTime = (value: number) => `${Math.floor(value / 60)}m ${Math.round(value % 60)}s`;
const formatChange = (value: number) => (value === 0 ? '±0 %' : `${value > 0 ? '+' : '−'}${decimal.format(Math.abs(value))} %`);
const shortDate = (timestamp: number) => new Date(timestamp).toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit' });

export interface ProjectPrintReportProps {
  data: ProjectDashboardData;
  domain: string;
  userRole: string;
  showLandingPages: boolean;
  showGoogleAds: boolean;
  showPromptTracking: boolean;
  widgetVisibility?: Partial<DashboardWidgetVisibility> | null;
  indexingStatus?: ProjectIndexingStatus;
  /** Vergleichsart aus dem Dashboard (?vergleich=). */
  comparisonMode?: ComparisonMode;
  autoPrint?: boolean;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="report-section mt-6">
      <h2 className="mb-2 border-b border-[#d2d2d7] pb-1 text-13 font-semibold uppercase tracking-[0.04em] text-[#1d1d1f]">{title}</h2>
      {children}
    </section>
  );
}

function Breakdown({ title, entries }: { title: string; entries: ChartEntry[] }) {
  const rows = entries.filter((entry) => entry.value > 0).slice(0, 6).map(({ name, value }) => ({ name, value }));
  const total = rows.reduce((sum, entry) => sum + entry.value, 0);
  if (rows.length === 0) return null;
  return (
    <div className="flex min-w-0 flex-col items-center">
      <h3 className="mb-1 text-12 font-semibold text-[#1d1d1f]">{title}</h3>
      <PieChart width={130} height={130}>
        <Pie data={rows} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={34} outerRadius={60} paddingAngle={1} isAnimationActive={false} stroke="#fff">
          {rows.map((entry, index) => <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
        </Pie>
      </PieChart>
      <ul className="mt-1 w-full space-y-0.5 text-11">
        {rows.map((entry, index) => (
          <li key={entry.name} className="flex items-center gap-1.5">
            <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} />
            <span className="min-w-0 flex-1 truncate text-[#3a3a3c]">{entry.name}</span>
            <span className="tabular-nums text-[#1d1d1f]">{Math.round((entry.value / total) * 100)} %</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function ProjectPrintReport({
  data: snapshotData,
  domain,
  userRole,
  showLandingPages,
  showGoogleAds,
  showPromptTracking,
  widgetVisibility,
  indexingStatus,
  comparisonMode = 'vorperiode',
  autoPrint = false,
}: ProjectPrintReportProps) {
  const data = useMemo(() => applyComparisonMode(snapshotData, comparisonMode), [snapshotData, comparisonMode]);
  const model = useMemo(() => buildDashboardViewModel({
    data,
    indexingStatus,
    userRole,
    showLandingPages,
    showGoogleAds,
    showPromptTracking,
    widgetVisibility,
  }), [data, indexingStatus, userRole, showLandingPages, showGoogleAds, showPromptTracking, widgetVisibility]);

  // Bericht immer hell, auch wenn die App gerade dunkel ist; danach zurück.
  useEffect(() => {
    const root = document.documentElement;
    const wasDark = root.classList.contains('dark');
    root.classList.remove('dark');
    return () => {
      if (wasDark) root.classList.add('dark');
    };
  }, []);

  useEffect(() => {
    if (!autoPrint) return;
    let cancelled = false;
    // Schriften laden und Diagramme zeichnen lassen, dann drucken.
    document.fonts.ready.then(() => setTimeout(() => { if (!cancelled) window.print(); }, 400));
    return () => { cancelled = true; };
  }, [autoPrint]);

  const period = formatReportingPeriod(model.reportingPeriod);
  const comparison = model.comparison;
  const isYearOverYear = comparison?.mode === 'vorjahr';
  const comparisonPeriod = formatReportingPeriod(comparison?.period);
  const kpis = model.extendedKpis;

  // Website-Kennzahlen aus GA4 oder Vercel; fehlende Kennzahlen (z. B. bei Vercel) entfallen.
  const web = model.analyticsSource === 'vercel' ? 'Vercel' : 'GA4';
  const kpiRows = kpis ? [
    { label: 'Impressionen', kpi: kpis.impressions, format: formatCount, source: 'GSC' },
    { label: 'Google Klicks', kpi: kpis.clicks, format: formatCount, source: 'GSC' },
    { label: 'Neue Besucher', kpi: kpis.newUsers, format: formatCount, source: web },
    { label: 'Seitenaufrufe', kpi: kpis.pageviews, format: formatCount, source: web },
    { label: 'Besucher', kpi: kpis.totalUsers, format: formatCount, source: web },
    { label: 'Interaktionsrate', kpi: kpis.engagementRate, format: formatPercent, source: web },
    { label: 'Conversions', kpi: kpis.conversions, format: formatCount, source: web },
    { label: 'Ø Verweildauer', kpi: kpis.avgEngagementTime, format: formatTime, source: web },
    { label: 'Absprungrate', kpi: kpis.bounceRate, format: formatPercent, source: web, lowerIsBetter: true },
  ].filter((row): row is typeof row & { kpi: NonNullable<typeof row.kpi> } => Boolean(row.kpi)) : [];

  // Im Vorjahresmodus kommt die Klick-Linie des Vorjahres gestrichelt dazu, sofern vorhanden.
  const yearOverYearClicks = isYearOverYear ? comparison?.chartSeries.clicks : undefined;
  const trend = useMemo(() => {
    const byDate = new Map<number, { date: number; clicks?: number; impressions?: number; clicksYoy?: number }>();
    for (const point of model.allChartData.clicks) byDate.set(point.date, { date: point.date, clicks: point.value });
    for (const point of model.allChartData.impressions) {
      byDate.set(point.date, { ...byDate.get(point.date), date: point.date, impressions: point.value });
    }
    for (const point of yearOverYearClicks ?? []) {
      const existing = byDate.get(point.date);
      if (existing) byDate.set(point.date, { ...existing, clicksYoy: point.value });
    }
    return Array.from(byDate.values()).sort((a, b) => a.date - b.date);
  }, [model.allChartData, yearOverYearClicks]);
  const hasYearOverYearClicks = trend.some((point) => point.clicksYoy !== undefined);

  const topQueries = [...model.modules.gsc.data.topQueries].sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions).slice(0, TOP_QUERIES);
  const topPages = [...model.cleanLandingPages].sort((a, b) => (b.newUsers ?? 0) - (a.newUsers ?? 0)).slice(0, TOP_PAGES);
  const breakdowns = model.modules.ga4.data.breakdowns;
  const showBreakdowns = model.render.trafficBreakdownCount > 0;
  const aiTraffic = model.modules.ga4.data.aiTraffic;

  return (
    <div className="print-report min-h-screen bg-white text-[#1d1d1f]">
      <div className="report-toolbar sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[#e5e5ea] bg-white/95 px-6 py-3 print:hidden">
        <span className="text-14 text-[#636366]">Druckansicht · A4 hoch</span>
        <div className="flex gap-2">
          <Button variant="plain" onClick={() => window.close()}>Schließen</Button>
          <Button onClick={() => window.print()}>
            <Printer size={14} aria-hidden="true" />
            Drucken
          </Button>
        </div>
      </div>

      <div className="report-page mx-auto max-w-[760px] px-6 py-8 print:max-w-none print:p-0">
        <div className="report-head flex items-end justify-between gap-4 border-b-2 border-[#1d1d1f] pb-3">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-[9px] bg-[#0066CC] text-14 font-bold text-white">DP</span>
            <div>
              <h1 className="report-title text-22 font-bold leading-tight">{domain || 'Projekt'}</h1>
              <p className="text-12 text-[#636366]">SEO &amp; Analytics Bericht</p>
            </div>
          </div>
          <div className="text-right text-12 text-[#3a3a3c]">
            {period && <div>Zeitraum: <span className="font-semibold">{period}</span></div>}
            {comparison && (
              <div>Vergleich: <span className="font-semibold">{comparison.label}</span>{comparisonPeriod ? ` (${comparisonPeriod})` : ''}</div>
            )}
            <div>Erstellt am {new Date().toLocaleDateString('de-AT')}</div>
          </div>
        </div>

        {kpiRows.length > 0 && (
          <Section title="Kennzahlen">
            <div className="grid grid-cols-4 gap-px overflow-hidden rounded-[8px] border border-[#d2d2d7] bg-[#d2d2d7]">
              {kpiRows.map(({ label, kpi, format, source, lowerIsBetter }) => {
                // Veränderung und Vergleichswert der gewählten Vergleichsart.
                const change = kpi.comparison ? kpi.comparison.change : kpi.change;
                const previous = kpi.comparison
                  ? kpi.comparison.previous
                  : kpi.previous ?? (kpi.change === -100 ? 0 : kpi.value / (1 + kpi.change / 100));
                const good = change !== null && (lowerIsBetter ? change < 0 : change > 0);
                const tone = change === null || change === 0 ? 'text-[#636366]' : good ? 'text-[#1B7A35]' : 'text-[#C4001A]';
                return (
                  <div key={label} className="bg-white px-3 py-2.5">
                    <div className="flex justify-between text-11 text-[#636366]"><span>{label}</span><span>{source}</span></div>
                    <div className="mt-0.5 text-20 font-semibold tabular-nums">{format(kpi.value)}</div>
                    <div className="text-11 tabular-nums">
                      {change !== null && <span className={`font-semibold ${tone}`}>{formatChange(change)}</span>}
                      {previous !== null && Number.isFinite(previous) ? (
                        <span className="text-[#636366]">{change !== null ? ' · ' : ''}{isYearOverYear ? 'Vorjahr' : 'vorher'} {format(previous)}</span>
                      ) : (
                        <span className="text-[#636366]">{isYearOverYear ? 'kein Vorjahreswert' : 'kein Vergleichswert'}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {comparison && comparison.notices.length > 0 && (
              <div className="mt-2 space-y-0.5 text-11 leading-[1.45] text-[#3a3a3c]">
                {comparison.notices.map((notice) => <p key={notice}>{notice}</p>)}
              </div>
            )}
          </Section>
        )}

        {trend.length > 1 && (
          <Section title="Verlauf: Klicks und Impressionen">
            <LineChart width={680} height={200} data={trend} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="#e5e5ea" vertical={false} />
              <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 10, fill: '#636366' }} tickLine={false} axisLine={false} minTickGap={24} />
              <YAxis yAxisId="clicks" tick={{ fontSize: 10, fill: '#636366' }} tickLine={false} axisLine={false} width={36} />
              <YAxis yAxisId="impressions" orientation="right" tick={{ fontSize: 10, fill: '#636366' }} tickLine={false} axisLine={false} width={44} />
              <Line yAxisId="clicks" dataKey="clicks" name="Klicks" stroke="#0066CC" strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line yAxisId="impressions" dataKey="impressions" name="Impressionen" stroke="#AF52DE" strokeWidth={1.5} dot={false} isAnimationActive={false} />
              {hasYearOverYearClicks && (
                <Line yAxisId="clicks" dataKey="clicksYoy" name="Klicks Vorjahr" stroke="#8e8e93" strokeWidth={1.5} strokeDasharray="4 3" dot={false} isAnimationActive={false} />
              )}
            </LineChart>
            <div className="mt-1 flex gap-4 text-11 text-[#3a3a3c]">
              <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-[#0066CC]" />Klicks (links)</span>
              <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-[#AF52DE]" />Impressionen (rechts)</span>
              {hasYearOverYearClicks && (
                <span className="flex items-center gap-1.5"><span className="h-0 w-4 border-t-2 border-dashed border-[#8e8e93]" />Klicks Vorjahr (links)</span>
              )}
            </div>
          </Section>
        )}

        {showBreakdowns && (
          <Section title="Zugriffe">
            <div className="grid grid-cols-3 gap-6">
              {model.render.trafficBreakdowns.channels && <Breakdown title="Nach Channel" entries={breakdowns.channels} />}
              {model.render.trafficBreakdowns.countries && <Breakdown title="Nach Land" entries={breakdowns.countries} />}
              {model.render.trafficBreakdowns.devices && <Breakdown title="Nach Endgerät" entries={breakdowns.devices} />}
            </div>
          </Section>
        )}

        {model.render.topQueries && topQueries.length > 0 && (
          <Section title={`Top ${topQueries.length} Suchanfragen`}>
            <table className="w-full table-fixed text-11">
              <colgroup><col /><col className="w-[64px]" /><col className="w-[72px]" /><col className="w-[64px]" /><col className="w-[52px]" /></colgroup>
              <thead>
                <tr className="border-b border-[#d2d2d7] text-left text-[#636366]">
                  <th className="py-1 pr-2 font-semibold">Suchanfrage</th>
                  <th className="py-1 pl-2 text-right font-semibold">Klicks</th>
                  <th className="py-1 pl-2 text-right font-semibold">Impr.</th>
                  <th className="py-1 pl-2 text-right font-semibold">CTR</th>
                  <th className="py-1 pl-2 text-right font-semibold">Pos.</th>
                </tr>
              </thead>
              <tbody>
                {topQueries.map((query) => (
                  <tr key={query.query} className="border-b border-[#f2f2f4]">
                    <td className="truncate py-1 pr-2">{query.query}</td>
                    <td className="py-1 pl-2 text-right tabular-nums">{number.format(query.clicks)}</td>
                    <td className="py-1 pl-2 text-right tabular-nums">{number.format(query.impressions)}</td>
                    <td className="py-1 pl-2 text-right tabular-nums">{query.impressions > 0 ? formatPercent((query.clicks / query.impressions) * 100) : '–'}</td>
                    <td className="py-1 pl-2 text-right tabular-nums">{decimal.format(query.position)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        )}

        {model.render.landingPages && topPages.length > 0 && (
          <Section title={`Top ${topPages.length} Landingpages`}>
            <table className="w-full table-fixed text-11">
              <colgroup><col /><col className="w-[88px]" /><col className="w-[80px]" /><col className="w-[88px]" /></colgroup>
              <thead>
                <tr className="border-b border-[#d2d2d7] text-left text-[#636366]">
                  <th className="py-1 pr-2 font-semibold">Seite</th>
                  <th className="py-1 pl-2 text-right font-semibold">Neue Nutzer</th>
                  <th className="py-1 pl-2 text-right font-semibold">Sitzungen</th>
                  <th className="py-1 pl-2 text-right font-semibold">Conversions</th>
                </tr>
              </thead>
              <tbody>
                {topPages.map((page) => (
                  <tr key={page.path} className="border-b border-[#f2f2f4]">
                    <td className="truncate py-1 pr-2">{page.path}</td>
                    <td className="py-1 pl-2 text-right tabular-nums">{number.format(page.newUsers ?? 0)}</td>
                    <td className="py-1 pl-2 text-right tabular-nums">{number.format(page.sessions ?? 0)}</td>
                    <td className="py-1 pl-2 text-right tabular-nums">{number.format(page.conversions)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        )}

        {model.canShow('aiTraffic') && aiTraffic.totalSessions > 0 && (
          <Section title="KI-Traffic">
            <p className="text-12 text-[#3a3a3c]">
              {number.format(aiTraffic.totalSessions)} Sitzungen und {number.format(aiTraffic.totalUsers)} Nutzer kamen über KI-Assistenten
              {typeof aiTraffic.totalUsersChange === 'number' ? ` (${formatChange(aiTraffic.totalUsersChange)} zur Vorperiode)` : ''}.
            </p>
          </Section>
        )}

        <div className="mt-8 border-t border-[#e5e5ea] pt-2 text-10 text-[#8e8e93]">
          Erstellt mit Data Peak · Quellen: Google Search Console und Google Analytics 4
        </div>
      </div>
    </div>
  );
}
