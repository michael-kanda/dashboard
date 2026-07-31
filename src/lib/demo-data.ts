// src/lib/demo-data.ts
import type { ProjectDashboardData, ConvertingPageData } from '@/lib/dashboard-shared';
import type { TopQueryData } from '@/types/dashboard';
import type { AiTrafficData } from '@/types/ai-traffic';

/**
 * Generiert realistische Demo-Daten für Demo-Accounts
 * Verhindert leere Dashboards und zeigt vollständige Beispieldaten
 */

export function getDemoAnalyticsData(dateRange: string): ProjectDashboardData {
  // Berechne Anzahl Tage für Chart-Daten
  let days = 30;
  if (dateRange === '7d') days = 7;
  if (dateRange === '3m') days = 90;
  if (dateRange === '6m') days = 180;
  if (dateRange === '12m') days = 365;

  // Generiere Chart-Daten (vereinfacht: letzte X Tage)
  const generateChartData = (baseValue: number, variance: number) => {
    const data = [];
    const now = Date.now();
    for (let i = days - 1; i >= 0; i--) {
      const date = now - i * 24 * 60 * 60 * 1000;
      const randomVariance = (Math.random() - 0.5) * variance;
      data.push({
        date,
        value: Math.max(0, Math.floor(baseValue + randomVariance))
      });
    }
    return data;
  };

  // KPI-Werte (realistisch für einen kleinen E-Commerce Shop)
  const kpis = {
    // Google Search Console
    clicks: {
      value: 1247,
      change: 18.5,
    },
    impressions: {
      value: 28934,
      change: 22.3,
    },
    
    // Google Analytics 4
    sessions: {
      value: 4521,
      change: 24.7,
      aiTraffic: {
        value: 158,
        percentage: 3.5
      }
    },
    totalUsers: {
      value: 2847,
      change: 19.2,
    },
    conversions: {
      value: 127,
      change: 31.5,
    },
    engagementRate: {
      value: 68.5,
      change: 8.3,
    },
    bounceRate: {
      value: 42.8,
      change: -5.2, // Negativ ist gut!
    },
    newUsers: {
      value: 1923,
      change: 21.4,
    },
    avgEngagementTime: {
      value: 245,
      change: 12.8,
    },
    paidSearch: {
      value: 234,
      change: 15.6,
    },
  };

  // Chart-Daten generieren
  const charts = {
    clicks: generateChartData(42, 15),
    impressions: generateChartData(980, 200),
    sessions: generateChartData(150, 40),
    totalUsers: generateChartData(95, 25),
    conversions: generateChartData(4, 2),
    engagementRate: generateChartData(68, 5),
    bounceRate: generateChartData(43, 5),
    newUsers: generateChartData(64, 20),
    avgEngagementTime: generateChartData(245, 30),
    paidSearch: generateChartData(8, 3),
  };

  // Top Suchanfragen (GSC)
  const topQueries: TopQueryData[] = [
    {
      query: 'sneaker online kaufen',
      clicks: 234,
      impressions: 5678,
      ctr: 4.12,
      position: 4.2,
    },
    {
      query: 'sportschuhe sale',
      clicks: 189,
      impressions: 4321,
      ctr: 4.37,
      position: 6.8,
    },
    {
      query: 'laufschuhe damen',
      clicks: 156,
      impressions: 3890,
      ctr: 4.01,
      position: 8.1,
    },
    {
      query: 'turnschuhe günstig',
      clicks: 134,
      impressions: 3245,
      ctr: 4.13,
      position: 9.5,
    },
    {
      query: 'nike air max sale',
      clicks: 98,
      impressions: 2567,
      ctr: 3.82,
      position: 11.2,
    },
    {
      query: 'adidas schuhe herren',
      clicks: 87,
      impressions: 2134,
      ctr: 4.08,
      position: 12.8,
    },
    {
      query: 'running shoes test',
      clicks: 76,
      impressions: 1987,
      ctr: 3.83,
      position: 14.3,
    },
    {
      query: 'sneaker trends 2025',
      clicks: 65,
      impressions: 1756,
      ctr: 3.70,
      position: 15.7,
    },
    {
      query: 'basketballschuhe kaufen',
      clicks: 54,
      impressions: 1543,
      ctr: 3.50,
      position: 17.2,
    },
    {
      query: 'wanderschuhe test',
      clicks: 43,
      impressions: 1234,
      ctr: 3.48,
      position: 18.9,
    },
  ];

  // Top Converting Pages - ERWEITERT mit mehr Daten für LandingPageChart
  const topConvertingPages: ConvertingPageData[] = [
    {
      path: '/produkte/sneaker-collection',
      conversions: 52,
      conversionRate: 4.2,
      sessions: 1234,
      newUsers: 892,
      engagementRate: 72.3,
    },
    {
      path: '/sale/sommer-special',
      conversions: 38,
      conversionRate: 3.8,
      sessions: 987,
      newUsers: 654,
      engagementRate: 68.5,
    },
    {
      path: '/landingpage/newsletter-anmeldung',
      conversions: 21,
      conversionRate: 4.6,
      sessions: 456,
      newUsers: 312,
      engagementRate: 75.8,
    },
    {
      path: '/blog/top-trends-2025',
      conversions: 16,
      conversionRate: 2.0,
      sessions: 789,
      newUsers: 567,
      engagementRate: 64.2,
    },
    {
      path: '/produkte/laufschuhe-damen',
      conversions: 12,
      conversionRate: 3.1,
      sessions: 387,
      newUsers: 234,
      engagementRate: 69.1,
    },
    {
      path: '/produkte/basketballschuhe',
      conversions: 9,
      conversionRate: 2.8,
      sessions: 321,
      newUsers: 198,
      engagementRate: 66.7,
    },
    {
      path: '/sale/outlet',
      conversions: 8,
      conversionRate: 2.5,
      sessions: 320,
      newUsers: 187,
      engagementRate: 65.4,
    },
    {
      path: '/produkte/wanderschuhe',
      conversions: 7,
      conversionRate: 2.2,
      sessions: 318,
      newUsers: 176,
      engagementRate: 63.8,
    },
    {
      path: '/blog/sneaker-pflege-tipps',
      conversions: 5,
      conversionRate: 1.8,
      sessions: 278,
      newUsers: 165,
      engagementRate: 61.2,
    },
    {
      path: '/produkte/kinderschuhe',
      conversions: 4,
      conversionRate: 1.5,
      sessions: 267,
      newUsers: 154,
      engagementRate: 59.8,
    },
  ];

  // AI Traffic Data
  const aiTraffic: AiTrafficData = {
    totalSessions: 158,
    totalUsers: 134,
    totalSessionsChange: 28.5,
    totalUsersChange: 31.2,
    sessionsBySource: {
      'ChatGPT': 89,
      'Google Gemini': 42,
      'Perplexity': 27,
    },
    topAiSources: [
      {
        source: 'ChatGPT',
        sessions: 89,
        users: 76,
        percentage: 56.3,
      },
      {
        source: 'Google Gemini',
        sessions: 42,
        users: 35,
        percentage: 26.6,
      },
      {
        source: 'Perplexity',
        sessions: 27,
        users: 23,
        percentage: 17.1,
      },
    ],
    trend: generateChartData(5, 2).map(point => ({
      date: point.date,
      sessions: point.value,
    })),
  };

  // Country Data (Pie Chart)
  const countryData = [
    { name: 'Deutschland', value: 1823, fill: 'hsl(var(--chart-1))' },
    { name: 'Österreich', value: 567, fill: 'hsl(var(--chart-2))' },
    { name: 'Schweiz', value: 423, fill: 'hsl(var(--chart-3))' },
    { name: 'Niederlande', value: 234, fill: 'hsl(var(--chart-4))' },
    { name: 'Andere', value: 474, fill: 'hsl(var(--chart-5))' },
  ];

  // Channel Data (Traffic Sources)
  const channelData = [
    { name: 'Organic Search', value: 2145, fill: 'hsl(var(--chart-1))' },
    { name: 'Direct', value: 1234, fill: 'hsl(var(--chart-2))' },
    { name: 'Social', value: 678, fill: 'hsl(var(--chart-3))' },
    { name: 'Paid Search', value: 234, fill: 'hsl(var(--chart-4))' },
    { name: 'Referral', value: 230, fill: 'hsl(var(--chart-5))' },
  ];

  // Device Data
  const deviceData = [
    { name: 'Desktop', value: 2347, fill: 'hsl(var(--chart-1))' },
    { name: 'Mobile', value: 1823, fill: 'hsl(var(--chart-2))' },
    { name: 'Tablet', value: 351, fill: 'hsl(var(--chart-3))' },
  ];

  return {
    kpis,
    charts,
    topQueries,
    topConvertingPages,
    aiTraffic,
    countryData,
    channelData,
    deviceData,
    bingData: [], // Leer, da im Frontend nicht angezeigt
    apiErrors: undefined, // Demo hat keine Fehler
  };
}
