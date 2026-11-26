// src/app/demo-anwalt/demo-extras.ts
// Zusätzliche fiktive Daten der öffentlichen Demo: Wetter im Verlauf,
// KI-Traffic pro Modell und Lokale Sichtbarkeit mit drei Standorten.
import type { LocalSeoData } from '@/lib/dashboard-shared';
import type { AiTrafficExtendedData } from '@/lib/ai-traffic-v2/types';
import type { DailyWeather, WeatherIcon } from '@/lib/weather';

export const DEMO_START = Date.UTC(2026, 3, 13);
export const DEMO_DAYS = 30;
const DAY = 24 * 60 * 60 * 1000;

function isoDate(index: number) {
  return new Date(DEMO_START + index * DAY).toISOString().split('T')[0];
}

// ── Wetter (Wien, Mitte April bis Mitte Mai) ───────────────────
const WEATHER_LABELS: Record<WeatherIcon, { emoji: string; label: string }> = {
  sun: { emoji: '☀️', label: 'Sonnig' },
  'partly-cloudy': { emoji: '⛅', label: 'Teilweise bewölkt' },
  cloudy: { emoji: '☁️', label: 'Bewölkt' },
  fog: { emoji: '🌫️', label: 'Nebel' },
  rain: { emoji: '🌧️', label: 'Regen' },
  snow: { emoji: '🌨️', label: 'Schnee' },
  thunderstorm: { emoji: '⛈️', label: 'Gewitter' },
};

const WEATHER_DAYS: Array<[WeatherIcon, number, number]> = [
  ['partly-cloudy', 16, 7], ['sun', 18, 8], ['sun', 19, 9], ['cloudy', 15, 9], ['rain', 12, 8],
  ['rain', 11, 7], ['partly-cloudy', 14, 6], ['sun', 17, 7], ['sun', 20, 9], ['sun', 21, 10],
  ['partly-cloudy', 19, 11], ['thunderstorm', 17, 12], ['rain', 14, 10], ['cloudy', 15, 9], ['partly-cloudy', 18, 9],
  ['sun', 22, 11], ['sun', 23, 12], ['partly-cloudy', 21, 13], ['cloudy', 18, 12], ['rain', 15, 11],
  ['fog', 14, 8], ['partly-cloudy', 19, 10], ['sun', 22, 11], ['sun', 24, 13], ['sun', 25, 14],
  ['thunderstorm', 21, 14], ['rain', 17, 12], ['partly-cloudy', 20, 12], ['sun', 23, 13], ['sun', 24, 14],
];

export const demoWeatherData: Record<string, DailyWeather> = Object.fromEntries(
  WEATHER_DAYS.map(([icon, tempMax, tempMin], index) => [
    isoDate(index),
    { icon, tempMax, tempMin, ...WEATHER_LABELS[icon] },
  ]),
);

// ── KI-Traffic pro Modell ──────────────────────────────────────
const MODEL_SESSIONS: Record<string, number[]> = {
  'chatgpt.com': [0, 1, 0, 1, 1, 1, 1, 2, 1, 2, 2, 1, 2, 2, 2, 3, 2, 3, 2, 3, 3, 3, 4, 3, 4, 4, 5, 5, 4, 5],
  'perplexity.ai': [1, 0, 1, 0, 1, 1, 0, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 2, 1, 2, 1, 2, 2, 1, 2, 2, 2, 3, 2, 3],
  'gemini.google.com': [0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 2, 1, 1, 2, 2, 2, 2],
  'copilot.microsoft.com': [0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 0, 1, 1, 1],
  'claude.ai': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0],
};

const SOURCE_DETAILS: Array<{
  source: string;
  users: number;
  engagementRate: number;
  conversions: number;
  topPage: string;
}> = [
  { source: 'chatgpt.com', users: 44, engagementRate: 71.2, conversions: 5, topPage: '/familienrecht/scheidung/' },
  { source: 'perplexity.ai', users: 27, engagementRate: 68.4, conversions: 3, topPage: '/verkehrsrecht/fuehrerschein-entzug/' },
  { source: 'gemini.google.com', users: 19, engagementRate: 64.9, conversions: 2, topPage: '/erbrecht/testament/' },
  { source: 'copilot.microsoft.com', users: 10, engagementRate: 59.3, conversions: 1, topPage: '/rechtsanwalt-wien/' },
  { source: 'claude.ai', users: 3, engagementRate: 77.8, conversions: 0, topPage: '/familienrecht/scheidung/' },
];

const trendBySource = Object.entries(MODEL_SESSIONS).flatMap(([source, values]) =>
  values.map((sessions, index) => ({
    date: isoDate(index),
    source,
    sessions,
    users: sessions,
  })),
);

const dailyTotals = Array.from({ length: DEMO_DAYS }, (_, index) =>
  Object.values(MODEL_SESSIONS).reduce((sum, values) => sum + values[index], 0),
);

const totalSessions = dailyTotals.reduce((sum, value) => sum + value, 0);

const sources = SOURCE_DETAILS.map((detail) => {
  const sessions = MODEL_SESSIONS[detail.source].reduce((sum, value) => sum + value, 0);
  const topLandingPage = { path: detail.topPage, sessions: Math.max(1, Math.round(sessions * 0.45)), conversions: detail.conversions };
  return {
    source: detail.source,
    sessions,
    users: detail.users,
    engagementRate: detail.engagementRate,
    percentage: Math.round((sessions / totalSessions) * 1000) / 10,
    conversions: detail.conversions,
    conversionRate: sessions ? Math.round((detail.conversions / sessions) * 1000) / 10 : 0,
    topPages: [topLandingPage],
    topLandingPage,
  };
});

export const demoAiTrafficExtended: AiTrafficExtendedData = {
  totalSessions,
  totalUsers: SOURCE_DETAILS.reduce((sum, detail) => sum + detail.users, 0),
  totalSessionsChange: 42.6,
  totalUsersChange: 36.4,
  avgEngagementTime: 96,
  bounceRate: 31.4,
  engagementRate: 68.6,
  conversions: SOURCE_DETAILS.reduce((sum, detail) => sum + detail.conversions, 0),
  intentBreakdown: [],
  userJourney: {
    avgPagesPerSession: 2.4,
    avgSessionDuration: 118,
    avgEngagementRate: 68.6,
    topJourneys: [],
    interactionEvents: [],
    scrollDepth: { reached25: 0, reached50: 0, reached75: 0, reached100: 0 },
  },
  sources,
  landingPages: [],
  trend: dailyTotals.map((sessions, index) => ({ date: isoDate(index), sessions, users: sessions })),
  trendBySource,
};

// ── Lokale Sichtbarkeit ────────────────────────────────────────
export const demoLocalSeo: LocalSeoData = {
  locations: [
    {
      id: 'demo-wien',
      name: 'Kanzlei Wien',
      postalCode: '1010',
      city: 'Wien',
      country: 'AT',
      landingPages: ['/rechtsanwalt-wien/'],
      keywords: ['wien', 'innere stadt'],
      score: 82,
      clicks: 1124,
      impressions: 29840,
      ctr: 3.8,
      position: 5.9,
      sessions: 1962,
      newUsers: 1214,
      conversions: 112,
      topQueries: [
        { query: 'rechtsanwalt wien', clicks: 214, impressions: 8240, ctr: 2.6, position: 7.8, url: '/rechtsanwalt-wien/' },
        { query: 'scheidungsanwalt wien erstberatung', clicks: 132, impressions: 2140, ctr: 6.2, position: 2.9, url: '/familienrecht/scheidung/' },
        { query: 'strafverteidiger wien', clicks: 84, impressions: 1960, ctr: 4.3, position: 5.6, url: '/strafrecht/' },
      ],
      topLandingPages: [
        { path: '/rechtsanwalt-wien/', conversions: 31, conversionRate: 4.4, engagementRate: 63.8, sessions: 704, newUsers: 552, ctr: 2.6 },
        { path: '/familienrecht/scheidung/', conversions: 34, conversionRate: 6.9, engagementRate: 70.1, sessions: 493, newUsers: 381, ctr: 6.2 },
      ],
    },
    {
      id: 'demo-graz',
      name: 'Sprechstelle Graz',
      postalCode: '8010',
      city: 'Graz',
      country: 'AT',
      landingPages: ['/standorte/graz/'],
      keywords: ['graz', 'steiermark'],
      score: 61,
      clicks: 412,
      impressions: 11260,
      ctr: 3.7,
      position: 8.2,
      sessions: 688,
      newUsers: 471,
      conversions: 41,
      topQueries: [
        { query: 'anwalt graz verkehrsrecht', clicks: 96, impressions: 2210, ctr: 4.3, position: 6.1, url: '/standorte/graz/' },
        { query: 'fuehrerschein entzogen graz', clicks: 58, impressions: 1380, ctr: 4.2, position: 7.4, url: '/verkehrsrecht/fuehrerschein-entzug/' },
      ],
      topLandingPages: [
        { path: '/standorte/graz/', conversions: 19, conversionRate: 5.1, engagementRate: 66.2, sessions: 372, newUsers: 268, ctr: 4.3 },
      ],
    },
    {
      id: 'demo-linz',
      name: 'Sprechstelle Linz',
      postalCode: '4020',
      city: 'Linz',
      country: 'AT',
      landingPages: ['/standorte/linz/'],
      keywords: ['linz', 'oberösterreich'],
      score: 44,
      clicks: 186,
      impressions: 6420,
      ctr: 2.9,
      position: 11.6,
      sessions: 312,
      newUsers: 238,
      conversions: 14,
      topQueries: [
        { query: 'erbrecht anwalt linz', clicks: 41, impressions: 1180, ctr: 3.5, position: 9.8, url: '/standorte/linz/' },
      ],
      topLandingPages: [
        { path: '/standorte/linz/', conversions: 8, conversionRate: 3.9, engagementRate: 61.4, sessions: 205, newUsers: 161, ctr: 3.5 },
      ],
    },
  ],
  totals: {
    clicks: 1722,
    impressions: 47520,
    sessions: 2962,
    newUsers: 1923,
    conversions: 167,
  },
};
