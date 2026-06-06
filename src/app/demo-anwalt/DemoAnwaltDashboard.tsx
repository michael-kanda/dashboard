'use client';

import { useMemo, useState } from 'react';
import ProjectDashboard from '@/components/ProjectDashboard';
import type { DateRangeOption } from '@/components/DateRangeSelector';
import type {
  GoogleAdsData,
  ProjectDashboardData,
} from '@/lib/dashboard-shared';

const DAY = 24 * 60 * 60 * 1000;
const START = Date.UTC(2026, 3, 13);

function trend(values: number[]) {
  return values.map((value, index) => ({
    date: START + index * DAY,
    value,
  }));
}

function aiTrend(values: number[]) {
  return values.map((sessions, index) => ({
    date: START + index * DAY,
    sessions,
  }));
}

function genAiTrend(values: number[]) {
  return values.map((impressions, index) => ({
    date: START + index * DAY,
    impressions,
  }));
}

const googleAdsRows: GoogleAdsData['rows'] = [
  {
    campaign: 'Demo | Rechtsanwalt Wien',
    adGroup: 'Verkehrsrecht',
    adName: 'Fuehrerschein Soforthilfe',
    keyword: 'fuehrerschein entzogen anwalt',
    searchQuery: 'fuehrerschein entzogen anwalt wien',
    landingPage: '/verkehrsrecht/fuehrerschein-entzug/',
    cost: 312.4,
    clicks: 74,
    impressions: 1840,
    cpc: 4.22,
    roas: 6.1,
    conversions: 11,
    sessions: 69,
    engagedSessions: 48,
  },
  {
    campaign: 'Demo | Rechtsanwalt Wien',
    adGroup: 'Familienrecht',
    adName: 'Scheidung Erstberatung',
    keyword: 'scheidungsanwalt wien',
    searchQuery: 'scheidungsanwalt wien erstberatung',
    landingPage: '/familienrecht/scheidung/',
    cost: 428.9,
    clicks: 91,
    impressions: 2210,
    cpc: 4.71,
    roas: 4.8,
    conversions: 14,
    sessions: 86,
    engagedSessions: 61,
  },
  {
    campaign: 'Demo | Rechtsanwalt Wien',
    adGroup: 'Erbrecht',
    adName: 'Testament Beratung',
    keyword: 'erbrecht anwalt wien',
    searchQuery: 'anwalt erbrecht testament wien',
    landingPage: '/erbrecht/testament/',
    cost: 226.3,
    clicks: 43,
    impressions: 1190,
    cpc: 5.26,
    roas: 5.4,
    conversions: 7,
    sessions: 41,
    engagedSessions: 31,
  },
];

const googleAdsData: GoogleAdsData = {
  rows: googleAdsRows,
  landingPageRows: googleAdsRows,
  campaignRows: googleAdsRows,
  adGroupRows: googleAdsRows,
  adRows: googleAdsRows,
  searchQueryRows: googleAdsRows,
  totals: {
    cost: 967.6,
    clicks: 208,
    impressions: 5240,
    avgCpc: 4.65,
    roas: 5.4,
    conversions: 32,
    sessions: 196,
    engagedSessions: 140,
    interactionRate: 3.97,
  },
  conversionsByCampaign: {
    'Demo | Rechtsanwalt Wien': 32,
  },
  conversionsByAdGroup: {
    Verkehrsrecht: 11,
    Familienrecht: 14,
    Erbrecht: 7,
  },
  conversionsByQuery: {
    'fuehrerschein entzogen anwalt wien': 11,
    'scheidungsanwalt wien erstberatung': 14,
    'anwalt erbrecht testament wien': 7,
  },
  source: 'sheet',
};

const demoData: ProjectDashboardData = {
  kpis: {
    clicks: { value: 1848, change: 14.7 },
    impressions: { value: 48210, change: 22.4 },
    sessions: { value: 3216, change: 12.8 },
    totalUsers: { value: 2474, change: 10.5 },
    newUsers: { value: 1986, change: 9.3 },
    conversions: { value: 184, change: 18.9 },
    engagementRate: { value: 67.4, change: 6.2 },
    bounceRate: { value: 32.6, change: -5.4 },
    avgEngagementTime: { value: 104, change: 11.6 },
    genAiImpressions: { value: 1430, change: 38.2 },
    paidSearch: { value: 208, change: 16.1 },
  },
  charts: {
    clicks: trend([42, 45, 39, 51, 48, 52, 58, 61, 55, 63, 66, 64, 71, 70, 76, 73, 79, 84, 82, 88, 91, 90, 94, 99, 103, 101, 108, 112, 118, 121]),
    impressions: trend([1120, 1185, 1094, 1260, 1315, 1380, 1440, 1492, 1520, 1588, 1635, 1690, 1722, 1780, 1840, 1905, 1960, 2012, 2070, 2135, 2200, 2260, 2314, 2380, 2445, 2510, 2580, 2640, 2705, 2780]),
    sessions: trend([82, 88, 84, 96, 101, 97, 106, 111, 108, 115, 119, 122, 128, 131, 126, 135, 141, 144, 149, 151, 156, 160, 164, 169, 172, 176, 181, 184, 189, 194]),
    totalUsers: trend([61, 66, 64, 72, 76, 73, 80, 82, 81, 87, 91, 92, 96, 99, 97, 103, 107, 111, 114, 116, 119, 123, 126, 129, 132, 136, 139, 142, 146, 151]),
    conversions: trend([4, 5, 4, 6, 5, 7, 6, 8, 7, 8, 9, 8, 10, 9, 11, 10, 12, 12, 11, 13, 14, 13, 15, 16, 15, 17, 18, 18, 19, 20]),
    engagementRate: trend([58, 59, 61, 60, 62, 63, 64, 62, 65, 66, 64, 67, 68, 66, 69, 68, 70, 69, 71, 70, 72, 73, 71, 74, 73, 75, 74, 76, 75, 77]),
    bounceRate: trend([41, 40, 39, 40, 38, 37, 36, 38, 35, 34, 36, 33, 32, 34, 31, 32, 30, 31, 29, 30, 28, 27, 29, 26, 27, 25, 26, 24, 25, 23]),
    newUsers: trend([49, 53, 50, 57, 61, 58, 64, 66, 65, 69, 72, 74, 77, 79, 78, 82, 85, 88, 91, 92, 95, 98, 100, 103, 106, 109, 111, 114, 117, 121]),
    avgEngagementTime: trend([76, 78, 81, 79, 83, 86, 88, 84, 90, 92, 89, 94, 96, 95, 99, 101, 98, 103, 105, 104, 107, 109, 108, 111, 113, 112, 115, 117, 119, 121]),
    paidSearch: trend([4, 5, 3, 6, 7, 6, 8, 7, 9, 10, 8, 11, 10, 12, 13, 11, 14, 13, 15, 16, 14, 17, 16, 18, 19, 17, 20, 21, 22, 23]),
  },
  topQueries: [
    { query: 'rechtsanwalt wien', clicks: 214, impressions: 8240, ctr: 2.6, position: 7.8, url: '/rechtsanwalt-wien/' },
    { query: 'fuehrerschein entzogen anwalt', clicks: 168, impressions: 2980, ctr: 5.6, position: 3.2, url: '/verkehrsrecht/fuehrerschein-entzug/' },
    { query: 'scheidungsanwalt wien erstberatung', clicks: 132, impressions: 2140, ctr: 6.2, position: 2.9, url: '/familienrecht/scheidung/' },
    { query: 'anwalt erbrecht testament', clicks: 96, impressions: 1740, ctr: 5.5, position: 4.1, url: '/erbrecht/testament/' },
    { query: 'strafverteidiger wien', clicks: 84, impressions: 1960, ctr: 4.3, position: 5.6, url: '/strafrecht/' },
    { query: 'arbeitsrecht kuendigung anwalt', clicks: 73, impressions: 1560, ctr: 4.7, position: 6.4, url: '/arbeitsrecht/kuendigung/' },
    { query: 'unterhaltsrecht anwalt wien', clicks: 51, impressions: 970, ctr: 5.3, position: 4.8, url: '/familienrecht/unterhalt/' },
  ],
  topConvertingPages: [
    { path: '/verkehrsrecht/fuehrerschein-entzug/', conversions: 39, conversionRate: 7.8, engagementRate: 72.4, sessions: 498, newUsers: 344, ctr: 5.6 },
    { path: '/familienrecht/scheidung/', conversions: 34, conversionRate: 6.9, engagementRate: 70.1, sessions: 493, newUsers: 381, ctr: 6.2 },
    { path: '/rechtsanwalt-wien/', conversions: 31, conversionRate: 4.4, engagementRate: 63.8, sessions: 704, newUsers: 552, ctr: 2.6 },
    { path: '/erbrecht/testament/', conversions: 22, conversionRate: 6.1, engagementRate: 69.3, sessions: 361, newUsers: 278, ctr: 5.5 },
    { path: '/strafrecht/', conversions: 18, conversionRate: 5.8, engagementRate: 66.7, sessions: 309, newUsers: 244, ctr: 4.3 },
  ],
  landingPageQueries: {
    '/verkehrsrecht/fuehrerschein-entzug/': [
      { query: 'fuehrerschein entzogen anwalt', clicks: 168, impressions: 2980 },
      { query: 'fuehrerschein entzogen oesterreich', clicks: 74, impressions: 1860 },
    ],
    '/familienrecht/scheidung/': [
      { query: 'scheidungsanwalt wien erstberatung', clicks: 132, impressions: 2140 },
      { query: 'scheidung kosten anwalt', clicks: 49, impressions: 980 },
    ],
  },
  aiTraffic: {
    totalSessions: 86,
    totalUsers: 61,
    totalSessionsChange: 42.6,
    totalUsersChange: 36.4,
    sessionsBySource: {
      ChatGPT: 39,
      Perplexity: 22,
      Gemini: 14,
      Copilot: 8,
      Claude: 3,
    },
    topAiSources: [
      { source: 'ChatGPT', sessions: 39, users: 28, percentage: 45.3 },
      { source: 'Perplexity', sessions: 22, users: 17, percentage: 25.6 },
      { source: 'Gemini', sessions: 14, users: 10, percentage: 16.3 },
      { source: 'Copilot', sessions: 8, users: 5, percentage: 9.3 },
    ],
    trend: aiTrend([1, 2, 1, 2, 2, 3, 2, 4, 3, 4, 5, 3, 5, 4, 5, 6, 5, 7, 6, 8, 7, 8, 9, 8, 10, 9, 11, 12, 11, 13]),
  },
  googleGenAi: {
    status: 'available',
    message: 'Demo-Daten: fiktive Search-Console-Sichtbarkeit in Google GenAI.',
    totalImpressions: 1430,
    impressionsChange: 38.2,
    trend: genAiTrend([12, 14, 13, 18, 21, 19, 24, 28, 27, 32, 35, 36, 39, 42, 44, 48, 51, 54, 58, 61, 64, 68, 72, 74, 79, 83, 86, 91, 96, 101]),
    topPages: [
      { key: '/verkehrsrecht/fuehrerschein-entzug/', impressions: 442 },
      { key: '/familienrecht/scheidung/', impressions: 318 },
      { key: '/rechtsanwalt-wien/', impressions: 286 },
      { key: '/erbrecht/testament/', impressions: 194 },
      { key: '/strafrecht/', impressions: 128 },
    ],
    countries: [
      { key: 'AT', impressions: 1294 },
      { key: 'DE', impressions: 96 },
      { key: 'CH', impressions: 40 },
    ],
    devices: [
      { key: 'mobile', impressions: 914 },
      { key: 'desktop', impressions: 432 },
      { key: 'tablet', impressions: 84 },
    ],
    detectedAppearances: ['AI Overview', 'AI Mode'],
    source: 'gsc-search-appearance',
  },
  googleAdsData,
  countryData: [
    { name: 'Oesterreich', value: 2741, fill: '#188BDB' },
    { name: 'Deutschland', value: 294, fill: '#34A853' },
    { name: 'Schweiz', value: 112, fill: '#FBBC05' },
    { name: 'Sonstige', value: 69, fill: '#EA4335' },
  ],
  channelData: [
    { name: 'Organic Search', value: 1842, fill: '#188BDB' },
    { name: 'Direct', value: 521, fill: '#34A853' },
    { name: 'Paid Search', value: 196, fill: '#FBBC05' },
    { name: 'AI Referrals', value: 86, fill: '#8B5CF6' },
    { name: 'Referral', value: 71, fill: '#EA4335' },
  ],
  deviceData: [
    { name: 'Mobile', value: 2014, fill: '#188BDB' },
    { name: 'Desktop', value: 1028, fill: '#34A853' },
    { name: 'Tablet', value: 174, fill: '#FBBC05' },
  ],
  apiErrors: {},
};

export default function DemoAnwaltDashboard() {
  const [dateRange, setDateRange] = useState<DateRangeOption>('30d');
  const dashboardData = useMemo(() => demoData, []);

  return (
    <ProjectDashboard
      data={dashboardData}
      isLoading={false}
      dateRange={dateRange}
      onDateRangeChange={setDateRange}
      domain="kanzlei-demo.at"
      userRole="BENUTZER"
      userEmail="demo@datapeak.at"
      userAnsprache="Willkommen in der oeffentlichen Demo"
      showLandingPages
      showGoogleAds
      showPromptTracking={false}
      dashboardInfoText="Demo-Hinweis: Diese oeffentliche Ansicht verwendet ausschliesslich fiktive Werte fuer eine Rechtsanwaltskanzlei. Es werden keine echten Kunden-, Google- oder Backend-Daten geladen."
      dataMaxEnabled={false}
    />
  );
}
