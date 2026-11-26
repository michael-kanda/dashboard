// Lädt die Dashboard-Daten eines Projekts aus Vercel Web Analytics und liefert
// sie in denselben Feldern, die der Datenloader sonst aus GA4 befüllt.

import type { ChartPoint } from '../../types/dashboard';
import type { AiTrafficData } from '../../types/ai-traffic';
import type { ChartEntry, ConvertingPageData } from '../dashboard-shared';
import {
  aggregateEvents,
  aggregateVisits,
  countVisits,
  type AggregateRow,
  type QueryRange,
  type VercelAnalyticsTarget,
} from './client.ts';
import {
  AI_REFERRER_FILTER,
  buildAiTraffic,
  buildChannels,
  buildDimension,
  buildInFilter,
  buildLandingPages,
  countryName,
  deviceName,
  isAiReferrer,
  sumField,
  toDailyPoints,
} from './mapping.ts';
import type { AnalyticsSettings } from './settings.ts';

interface Series { total: number; daily: ChartPoint[] }

export interface VercelAnalyticsDashboard {
  current: { visitors: Series; pageviews: Series; conversions: Series; paidSearch: Series };
  previous: { visitors: number; pageviews: number; conversions: number; paidSearch: number };
  aiTraffic: AiTrafficData;
  channelData: ChartEntry[];
  countryData: ChartEntry[];
  deviceData: ChartEntry[];
  topConvertingPages: ConvertingPageData[];
  conversionsConfigured: boolean;
}

export async function loadVercelAnalyticsDashboard(
  settings: AnalyticsSettings,
  current: QueryRange,
  previous: QueryRange,
): Promise<VercelAnalyticsDashboard> {
  if (!settings.vercelProjectId) throw new Error('Vercel Analytics: invalid argument – kein Vercel-Projekt konfiguriert');
  const target: VercelAnalyticsTarget = { projectId: settings.vercelProjectId, teamId: settings.vercelTeamId };
  const eventFilter = settings.conversionEvents.length > 0
    ? buildInFilter('eventName', settings.conversionEvents)
    : null;

  // Sequenziell: hält die Last auf der API gering und den Fehlerfall eindeutig.
  const totals = await countVisits(target, current);
  const daily = await aggregateVisits(target, current, ['day']);
  // UTM-Dimensionen verlangen Enterprise oder Web Analytics Plus (HTTP 402); Kanäle daher nur aus Referrern.
  const sources = await aggregateVisits(target, current, ['referrerHostname'], { limit: 100 });
  const countries = await aggregateVisits(target, current, ['country'], { limit: 10 });
  const devices = await aggregateVisits(target, current, ['deviceType'], { limit: 5 });
  const pages = await aggregateVisits(target, current, ['requestPath'], { limit: 50 });

  const aiInSources = sources.some((row) => typeof row.referrerHostname === 'string' && isAiReferrer(row.referrerHostname));
  const aiTrend: AggregateRow[] = aiInSources
    ? await aggregateVisits(target, current, ['day'], { filter: AI_REFERRER_FILTER })
    : [];

  let conversionDaily: AggregateRow[] = [];
  let conversionPages: AggregateRow[] = [];
  if (eventFilter) {
    conversionDaily = await aggregateEvents(target, current, ['day'], { filter: eventFilter });
    conversionPages = await aggregateEvents(target, current, ['requestPath'], { filter: eventFilter, limit: 50 });
  }

  const previousTotals = await countVisits(target, previous);
  const previousAi = await countVisits(target, previous, AI_REFERRER_FILTER);
  const previousConversions = eventFilter
    ? sumField(await aggregateEvents(target, previous, ['eventName'], { filter: eventFilter }), 'count')
    : 0;

  return {
    current: {
      visitors: { total: totals.visitors ?? 0, daily: toDailyPoints(daily, 'visitors') },
      pageviews: { total: totals.pageviews ?? 0, daily: toDailyPoints(daily, 'pageviews') },
      conversions: { total: sumField(conversionDaily, 'count'), daily: toDailyPoints(conversionDaily, 'count') },
      paidSearch: { total: 0, daily: [] },
    },
    previous: {
      visitors: previousTotals.visitors ?? 0,
      pageviews: previousTotals.pageviews ?? 0,
      conversions: previousConversions,
      paidSearch: 0,
    },
    aiTraffic: buildAiTraffic(sources, aiTrend, previousAi.visitors ?? 0),
    channelData: buildChannels(sources),
    countryData: buildDimension(countries, 'country', countryName),
    deviceData: buildDimension(devices, 'deviceType', deviceName),
    topConvertingPages: buildLandingPages(pages, conversionPages),
    conversionsConfigured: Boolean(eventFilter),
  };
}

/**
 * Werte in der Form der GA4-Rohdaten des Datenloaders. Besucher stehen dabei
 * auch im Sitzungs-Feld: Vercel kennt keine Sitzungen, und Anteile wie
 * "KI-Traffic an allen Besuchen" bleiben so in derselben Einheit.
 */
export function toLoaderSeries(data: VercelAnalyticsDashboard) {
  const { current, previous } = data;
  const single = (total: number): Series => ({ total, daily: [] });
  return {
    current: {
      sessions: current.visitors,
      totalUsers: current.visitors,
      conversions: current.conversions,
      paidSearch: current.paidSearch,
    },
    previous: {
      sessions: single(previous.visitors),
      totalUsers: single(previous.visitors),
      conversions: single(previous.conversions),
      paidSearch: single(previous.paidSearch),
    },
  };
}
