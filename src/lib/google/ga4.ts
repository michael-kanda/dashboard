import { withGa4ResultCache, isGa4AbortError, getShortGoogleError, ga4RunReport } from './ga4-runtime';
import type { DateRangeData, Ga4ExtendedData } from './types';
import { createAuth } from './client';
import { parseGa4Date } from './dates';
import { google } from 'googleapis';
import { requestBudgetOptions } from '../sync/request-budget';
import { buildAiTrafficDimensionFilter, normalizeSource } from '../ai-sources';
import { ChartEntry } from '@/lib/dashboard-shared';
import type { AiTrafficData } from '@/types/ai-traffic';
import type { FollowUpPath, LandingPageFollowUpData } from '@/types/landing-page';
import { GA4_KEY_EVENTS_METRIC, parseGa4Metric } from '@/lib/ga4-metrics';

export async function getAnalyticsData(
  propertyId: string,
  startDate: string,
  endDate: string
): Promise<Ga4ExtendedData> {
  return withGa4ResultCache(
    `gadv2:${propertyId}:${startDate}:${endDate}`,
    () => getAnalyticsDataUncached(propertyId, startDate, endDate)
  );
}

async function getAnalyticsDataUncached(
  propertyId: string,
  startDate: string,
  endDate: string
): Promise<Ga4ExtendedData> {
  const formattedPropertyId = propertyId.startsWith('properties/')
    ? propertyId
    : `properties/${propertyId}`;
  const auth = createAuth();
  const analytics = google.analyticsdata({ version: 'v1beta', auth, ...requestBudgetOptions() });

  const result: Ga4ExtendedData = {
    sessions: { total: 0, daily: [] },
    totalUsers: { total: 0, daily: [] },
    newUsers: { total: 0, daily: [] },
    conversions: { total: 0, daily: [] },
    bounceRate: { total: 0, daily: [] },
    engagementRate: { total: 0, daily: [] },
    avgEngagementTime: { total: 0, daily: [] },
    clicks: { total: 0, daily: [] },
    impressions: { total: 0, daily: [] },
    paidSearch: { total: 0, daily: [] },
  };

  try {
    const response = await ga4RunReport(analytics, {
      property: formattedPropertyId,
      requestBody: {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'date' }],
        metrics: [
          { name: 'sessions' },
          { name: 'totalUsers' },
          { name: 'newUsers' },
          { name: GA4_KEY_EVENTS_METRIC },
          { name: 'bounceRate' },
          { name: 'engagementRate' },
          { name: 'averageSessionDuration' },
        ],
        metricAggregations: ['TOTAL'],
        orderBys: [{ dimension: { dimensionName: 'date' } }],
      },
    });

    const rows = response.data.rows || [];

    let sessionsTotal = 0;
    let totalUsersTotal = 0;
    let newUsersTotal = 0;
    let conversionsTotal = 0;
    let bounceRateSum = 0;
    let engagementRateSum = 0;
    let avgEngagementTimeSum = 0;
    let count = 0;

    for (const row of rows) {
      const dateStr = row.dimensionValues?.[0]?.value || '';
      const dateTs = parseGa4Date(dateStr);

      const sessions = parseInt(row.metricValues?.[0]?.value || '0', 10);
      const users = parseInt(row.metricValues?.[1]?.value || '0', 10);
      const newUsers = parseInt(row.metricValues?.[2]?.value || '0', 10);
      const conversions = parseGa4Metric(row.metricValues?.[3]?.value);
      const bounceRate = parseFloat(row.metricValues?.[4]?.value || '0');
      const engagementRate = parseFloat(row.metricValues?.[5]?.value || '0');
      const avgEngagementTime = parseFloat(row.metricValues?.[6]?.value || '0');

      result.sessions.daily.push({ date: dateTs, value: sessions });
      result.totalUsers.daily.push({ date: dateTs, value: users });
      result.newUsers.daily.push({ date: dateTs, value: newUsers });
      result.conversions.daily.push({ date: dateTs, value: conversions });
      result.bounceRate.daily.push({ date: dateTs, value: bounceRate });
      result.engagementRate.daily.push({ date: dateTs, value: engagementRate });
      result.avgEngagementTime.daily.push({ date: dateTs, value: avgEngagementTime });

      sessionsTotal += sessions;
      totalUsersTotal += users;
      newUsersTotal += newUsers;
      conversionsTotal += conversions;
      bounceRateSum += bounceRate;
      engagementRateSum += engagementRate;
      avgEngagementTimeSum += avgEngagementTime;
      count++;
    }

    const totals = response.data.totals?.[0]?.metricValues;
    result.sessions.total = totals ? parseGa4Metric(totals[0]?.value) : sessionsTotal;
    result.totalUsers.total = totals ? parseGa4Metric(totals[1]?.value) : totalUsersTotal;
    result.newUsers.total = totals ? parseGa4Metric(totals[2]?.value) : newUsersTotal;
    result.conversions.total = totals ? parseGa4Metric(totals[3]?.value) : conversionsTotal;
    result.bounceRate.total = totals
      ? parseGa4Metric(totals[4]?.value)
      : (count > 0 ? bounceRateSum / count : 0);
    result.engagementRate.total = totals
      ? parseGa4Metric(totals[5]?.value)
      : (count > 0 ? engagementRateSum / count : 0);
    result.avgEngagementTime.total = totals
      ? parseGa4Metric(totals[6]?.value)
      : (count > 0 ? avgEngagementTimeSum / count : 0);

    return result;
  } catch (error) {
    const summary = getShortGoogleError(error);
    if (isGa4AbortError(error)) {
      console.warn(`[GA4] Basisdaten-Report abgebrochen/Timeout (${startDate}–${endDate}): ${summary}`);
    } else {
      console.error('[GA4] Basisdaten-Report fehlgeschlagen:', summary);
    }
    throw error;
  }
}

export async function getPaidSearchData(
  propertyId: string,
  startDate: string,
  endDate: string,
): Promise<DateRangeData> {
  return withGa4ResultCache(
    `paidv2:${propertyId}:${startDate}:${endDate}`,
    () => getPaidSearchDataUncached(propertyId, startDate, endDate),
  );
}

async function getPaidSearchDataUncached(
  propertyId: string,
  startDate: string,
  endDate: string,
): Promise<DateRangeData> {
  const formattedPropertyId = propertyId.startsWith('properties/')
    ? propertyId
    : `properties/${propertyId}`;
  const auth = createAuth();
  const analytics = google.analyticsdata({ version: 'v1beta', auth, ...requestBudgetOptions() });
  const response = await ga4RunReport(analytics, {
    property: formattedPropertyId,
    requestBody: {
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'date' }],
      metrics: [{ name: 'sessions' }],
      metricAggregations: ['TOTAL'],
      dimensionFilter: {
        filter: {
          fieldName: 'sessionDefaultChannelGroup',
          stringFilter: { matchType: 'EXACT', value: 'Paid Search' },
        },
      },
      orderBys: [{ dimension: { dimensionName: 'date' } }],
    },
  });

  const daily = (response.data.rows || []).map((row) => ({
    date: parseGa4Date(row.dimensionValues?.[0]?.value || ''),
    value: parseGa4Metric(row.metricValues?.[0]?.value),
  }));

  const aggregatedTotal = parseGa4Metric(
    response.data.totals?.[0]?.metricValues?.[0]?.value,
  );
  return {
    total: aggregatedTotal || daily.reduce((sum, point) => sum + point.value, 0),
    daily,
  };
}

export async function getAiTrafficData(
  propertyId: string,
  startDate: string,
  endDate: string
): Promise<AiTrafficData> {
  return withGa4ResultCache(
    `ait:${propertyId}:${startDate}:${endDate}`,
    () => getAiTrafficDataUncached(propertyId, startDate, endDate)
  );
}

async function getAiTrafficDataUncached(
  propertyId: string,
  startDate: string,
  endDate: string
): Promise<AiTrafficData> {
  const formattedPropertyId = propertyId.startsWith('properties/')
    ? propertyId
    : `properties/${propertyId}`;
  const auth = createAuth();
  const analytics = google.analyticsdata({ version: 'v1beta', auth, ...requestBudgetOptions() });

  try {
    // Gesamtwerte ohne Dimensionen abrufen. Insbesondere totalUsers darf nicht
    // über Tage oder Quellen summiert werden, weil derselbe Nutzer sonst
    // mehrfach gezählt wird.
    const totalsResponse = await ga4RunReport(analytics, {
      property: formattedPropertyId,
      requestBody: {
        dateRanges: [{ startDate, endDate }],
        metrics: [{ name: 'sessions' }, { name: 'totalUsers' }],
        dimensionFilter: buildAiTrafficDimensionFilter(),
      },
    });

    const response = await ga4RunReport(analytics, {
      property: formattedPropertyId,
      requestBody: {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'sessionSource' }, { name: 'date' }],
        metrics: [{ name: 'sessions' }, { name: 'totalUsers' }],
        dimensionFilter: buildAiTrafficDimensionFilter(),
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: '1000',
      },
    });

    const rows = response.data.rows || [];
    const totalsRow = totalsResponse.data.rows?.[0];

    const totalSessions = parseInt(totalsRow?.metricValues?.[0]?.value || '0', 10);
    const totalUsers = parseInt(totalsRow?.metricValues?.[1]?.value || '0', 10);
    const sessionsBySource: { [key: string]: number } = {};
    const usersBySource: { [key: string]: number } = {};
    const trendMap = new Map<number, number>();

    for (const row of rows) {
      const source = normalizeSource(row.dimensionValues?.[0]?.value || 'unknown');
      const dateStr = row.dimensionValues?.[1]?.value || '';
      const sessions = parseInt(row.metricValues?.[0]?.value || '0', 10);
      const users = parseInt(row.metricValues?.[1]?.value || '0', 10);

      sessionsBySource[source] = (sessionsBySource[source] || 0) + sessions;
      usersBySource[source] = (usersBySource[source] || 0) + users;

      if (dateStr) {
        const dateTs = parseGa4Date(dateStr);
        trendMap.set(dateTs, (trendMap.get(dateTs) || 0) + sessions);
      }
    }

    const topAiSources = Object.entries(sessionsBySource)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([source, sessions]) => ({
        source,
        sessions,
        users: usersBySource[source] || 0,
        percentage: totalSessions > 0 ? (sessions / totalSessions) * 100 : 0,
      }));

    const trend = Array.from(trendMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([date, sessions]) => ({ date, sessions }));

    return {
      totalSessions,
      totalUsers,
      sessionsBySource,
      topAiSources,
      trend,
    };
  } catch (error) {
    console.error('Error fetching AI traffic data:', error);
    return {
      totalSessions: 0,
      totalUsers: 0,
      sessionsBySource: {},
      topAiSources: [],
      trend: [],
    };
  }
}

export async function getGa4DimensionReport(
  propertyId: string,
  startDate: string,
  endDate: string,
  dimensionName: string
): Promise<ChartEntry[]> {
  return withGa4ResultCache(
    `dimv3:${propertyId}:${startDate}:${endDate}:${dimensionName}`,
    () => getGa4DimensionReportUncached(propertyId, startDate, endDate, dimensionName)
  );
}

async function getGa4DimensionReportUncached(
  propertyId: string,
  startDate: string,
  endDate: string,
  dimensionName: string
): Promise<ChartEntry[]> {
  const formattedPropertyId = propertyId.startsWith('properties/')
    ? propertyId
    : `properties/${propertyId}`;
  const auth = createAuth();
  const analytics = google.analyticsdata({ version: 'v1beta', auth, ...requestBudgetOptions() });

  try {
    const response = await ga4RunReport(analytics, {
      property: formattedPropertyId,
      requestBody: {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: dimensionName }],
        metrics: [
          { name: 'sessions' },
          { name: 'engagementRate' },
          { name: GA4_KEY_EVENTS_METRIC },
          { name: 'newUsers' },
        ],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: '10',
      },
    });

    const rows = response.data.rows || [];
    const results: ChartEntry[] = [];

    for (const row of rows) {
      const name = row.dimensionValues?.[0]?.value || 'Unknown';
      const sessions = parseInt(row.metricValues?.[0]?.value || '0', 10);
      const rate = parseFloat(row.metricValues?.[1]?.value || '0');
      const conversions = parseGa4Metric(row.metricValues?.[2]?.value);
      const newUsers = parseInt(row.metricValues?.[3]?.value || '0', 10);

      results.push({
        name,
        value: sessions,
        newUsers,
        subValue: `${(rate * 100).toFixed(1)}%`,
        subLabel: 'Interaktionsrate',
        subValue2: conversions,
        subLabel2: 'Conversions',
      });
    }

    if (results.length > 6) {
      const top5 = results.slice(0, 5);
      const otherSessions = results.slice(5).reduce((acc, curr) => acc + curr.value, 0);
      const otherConversions = results
        .slice(5)
        .reduce((acc, curr) => acc + (curr.subValue2 || 0), 0);

      if (otherSessions > 0) {
        return [
          ...top5,
          {
            name: 'Sonstige',
            value: otherSessions,
            subValue: '-',
            subLabel: 'Interaktionsrate',
            subValue2: otherConversions,
            subLabel2: 'Conversions',
          },
        ];
      }
      return top5;
    }
    return results;
  } catch (error) {
    console.error(`GA4 Dimension Report Error (${dimensionName}):`, error);
    return [];
  }
}

export interface ConvertingPageData {
  path: string;
  conversions: number;
  sessions: number;
  newUsers?: number;
  engagementRate?: number;
  conversionRate: string;
}

export async function getTopConvertingPages(
  propertyId: string,
  startDate: string,
  endDate: string
): Promise<ConvertingPageData[]> {
  return withGa4ResultCache(
    `tcpv2:${propertyId}:${startDate}:${endDate}`,
    () => getTopConvertingPagesUncached(propertyId, startDate, endDate)
  );
}

export async function getLandingPageMetricsForPaths(
  propertyId: string,
  startDate: string,
  endDate: string,
  paths: string[]
): Promise<ConvertingPageData[]> {
  const normalizedPaths = Array.from(new Set(
    paths
      .map((path) => {
        if (!path) return '';
        try {
          const parsed = path.startsWith('http') ? new URL(path).pathname : path;
          const withSlash = parsed.startsWith('/') ? parsed : `/${parsed}`;
          return withSlash.endsWith('/') && withSlash.length > 1 ? withSlash.slice(0, -1) : withSlash;
        } catch {
          const withSlash = path.startsWith('/') ? path : `/${path}`;
          return withSlash.endsWith('/') && withSlash.length > 1 ? withSlash.slice(0, -1) : withSlash;
        }
      })
      .filter(Boolean)
  ));

  if (normalizedPaths.length === 0) return [];

  return withGa4ResultCache(
    `lpmv2:${propertyId}:${startDate}:${endDate}:${normalizedPaths.sort().join('|')}`,
    () => getLandingPageMetricsForPathsUncached(propertyId, startDate, endDate, normalizedPaths)
  );
}

async function getLandingPageMetricsForPathsUncached(
  propertyId: string,
  startDate: string,
  endDate: string,
  paths: string[]
): Promise<ConvertingPageData[]> {
  const formattedPropertyId = propertyId.startsWith('properties/')
    ? propertyId
    : `properties/${propertyId}`;
  const auth = createAuth();
  const analytics = google.analyticsdata({ version: 'v1beta', auth, ...requestBudgetOptions() });

  try {
    const response = await ga4RunReport(analytics, {
      property: formattedPropertyId,
      requestBody: {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'landingPagePlusQueryString' }],
        metrics: [
          { name: GA4_KEY_EVENTS_METRIC },
          { name: 'sessions' },
          { name: 'engagementRate' },
          { name: 'newUsers' },
        ],
        dimensionFilter: {
          orGroup: {
            expressions: paths.map((path) => ({
              filter: {
                fieldName: 'landingPagePlusQueryString',
                stringFilter: {
                  matchType: 'CONTAINS',
                  value: path,
                  caseSensitive: false,
                },
              },
            })),
          },
        },
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: '100',
      },
    } as any);

    return (response.data.rows || []).map((row) => {
      const conversions = parseGa4Metric(row.metricValues?.[0]?.value);
      const sessions = parseInt(row.metricValues?.[1]?.value || '0', 10);
      const engagementRate = parseFloat(row.metricValues?.[2]?.value || '0');
      const newUsers = parseInt(row.metricValues?.[3]?.value || '0', 10);
      const convRate = sessions > 0 ? ((conversions / sessions) * 100).toFixed(2) : '0';

      return {
        path: row.dimensionValues?.[0]?.value || '(not set)',
        conversions,
        sessions,
        newUsers,
        conversionRate: convRate,
        engagementRate: parseFloat((engagementRate * 100).toFixed(2)),
      };
    });
  } catch (error) {
    console.warn('[GA4] Konnte Standort-Landingpages nicht laden:', error instanceof Error ? error.message : error);
    return [];
  }
}

async function getTopConvertingPagesUncached(
  propertyId: string,
  startDate: string,
  endDate: string
): Promise<ConvertingPageData[]> {
  const formattedPropertyId = propertyId.startsWith('properties/')
    ? propertyId
    : `properties/${propertyId}`;
  const auth = createAuth();
  const analytics = google.analyticsdata({ version: 'v1beta', auth, ...requestBudgetOptions() });

  try {
    const response = await ga4RunReport(analytics, {
      property: formattedPropertyId,
      requestBody: {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'landingPagePlusQueryString' }],
        metrics: [
          { name: GA4_KEY_EVENTS_METRIC },
          { name: 'sessions' },
          { name: 'engagementRate' },
          { name: 'newUsers' },
        ],
        orderBys: [
          { metric: { metricName: GA4_KEY_EVENTS_METRIC }, desc: true },
          { metric: { metricName: 'sessions' }, desc: true },
        ],
        limit: '100',
      },
    });

    const rows = response.data.rows || [];

    return rows
      .map((row) => {
        const conversions = parseGa4Metric(row.metricValues?.[0]?.value);
        const sessions = parseInt(row.metricValues?.[1]?.value || '0', 10);
        const engagementRate = parseFloat(row.metricValues?.[2]?.value || '0');
        const newUsers = parseInt(row.metricValues?.[3]?.value || '0', 10);
        const convRate = sessions > 0 ? ((conversions / sessions) * 100).toFixed(2) : '0';

        return {
          path: row.dimensionValues?.[0]?.value || '(not set)',
          conversions,
          sessions,
          newUsers,
          conversionRate: convRate,
          engagementRate: parseFloat((engagementRate * 100).toFixed(2)),
        };
      })
      .filter((p) => p.conversions > 0 || p.sessions > 5)
      .slice(0, 50);
  } catch (error) {
    console.error('Error fetching Top Converting Pages:', error);
    return [];
  }
}

export type { FollowUpPath, LandingPageFollowUpData };

export async function getLandingPageFollowUpPaths(
  propertyId: string,
  landingPage: string,
  startDate: string,
  endDate: string,
  siteUrl?: string
): Promise<LandingPageFollowUpData> {
  const formattedPropertyId = propertyId.startsWith('properties/')
    ? propertyId
    : `properties/${propertyId}`;

  const auth = createAuth();
  const analytics = google.analyticsdata({ version: 'v1beta', auth, ...requestBudgetOptions() });

  let normalizedLandingPage = landingPage;

  if (landingPage.startsWith('http')) {
    try {
      const url = new URL(landingPage);
      normalizedLandingPage = url.pathname;
    } catch {
      // Fallback: Behalte Original
    }
  }

  const landingPageBase = normalizedLandingPage.split('?')[0];
  const cleanLandingPage = landingPageBase.startsWith('/')
    ? landingPageBase
    : `/${landingPageBase}`;

  console.log(`[GA4 Followup] Property: ${formattedPropertyId}`);
  console.log(`[GA4 Followup] Landing Page: "${cleanLandingPage}"`);
  console.log(`[GA4 Followup] Date Range: ${startDate} - ${endDate}`);

  try {
    const response = await ga4RunReport(analytics, {
      property: formattedPropertyId,
      requestBody: {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'pagePath' }],
        metrics: [{ name: 'screenPageViews' }, { name: 'activeUsers' }],
        dimensionFilter: {
          filter: {
            fieldName: 'landingPagePlusQueryString',
            stringFilter: {
              matchType: 'CONTAINS',
              value: cleanLandingPage,
              caseSensitive: false,
            },
          },
        },
        orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
        limit: '100',
      },
    });

    const rows = response.data.rows || [];
    console.log(`[GA4 Followup] Rows returned: ${rows.length}`);

    if (rows.length > 0) {
      console.log(
        `[GA4 Followup] Sample results:`,
        rows.slice(0, 3).map((r) => ({
          path: r.dimensionValues?.[0]?.value,
          views: r.metricValues?.[0]?.value,
        }))
      );
    }

    const followUpPaths: FollowUpPath[] = [];
    let totalPageViews = 0;
    let landingPageViews = 0;

    for (const row of rows) {
      const pagePath = row.dimensionValues?.[0]?.value || '';
      const pageViews = parseInt(row.metricValues?.[0]?.value || '0', 10);

      if (!pagePath || pagePath === '(not set)' || pagePath === '(not provided)') {
        continue;
      }

      const isLandingPage =
        pagePath === cleanLandingPage ||
        pagePath === `${cleanLandingPage}/` ||
        pagePath.replace(/\/$/, '') === cleanLandingPage.replace(/\/$/, '') ||
        (cleanLandingPage === '/' && pagePath === '/');

      if (isLandingPage) {
        landingPageViews = pageViews;
        continue;
      }

      totalPageViews += pageViews;
      followUpPaths.push({ path: pagePath, sessions: pageViews, percentage: 0 });
    }

    console.log(`[GA4 Followup] Landing page views: ${landingPageViews}`);
    console.log(`[GA4 Followup] Follow-up page views: ${totalPageViews}`);
    console.log(`[GA4 Followup] Unique follow-up paths: ${followUpPaths.length}`);

    for (const fp of followUpPaths) {
      fp.percentage =
        landingPageViews > 0 ? (fp.sessions / landingPageViews) * 100 : 0;
    }

    const sortedPaths = followUpPaths
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, 20);

    return {
      landingPage: cleanLandingPage,
      totalSessions: landingPageViews + totalPageViews,
      landingPageSessions: landingPageViews,
      followUpPaths: sortedPaths,
    };
  } catch (error) {
    console.error('[GA4 Followup] Error:', error);
    return {
      landingPage: cleanLandingPage,
      totalSessions: 0,
      landingPageSessions: 0,
      followUpPaths: [],
    };
  }
}
