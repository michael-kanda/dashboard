export const DASHBOARD_WIDGET_DEFINITIONS = [
  {
    key: 'projectTimeline',
    group: 'Projekt',
    label: 'Projektverlauf',
    description: 'Zeitplan und aktueller Projektfortschritt.',
  },
  {
    key: 'aiAnalysis',
    group: 'Projekt',
    label: 'DataMax AI Analyst',
    description: 'Automatisch erstellter Statusbericht mit Analyse und Fazit.',
  },
  {
    key: 'kpis',
    group: 'Performance',
    label: 'Traffic & Reichweite',
    description: 'Zentrale KPI-Kacheln aus GSC und GA4.',
  },
  {
    key: 'trend',
    group: 'Performance',
    label: 'Verlauf & Analyse',
    description: 'Zeitlicher Verlauf der ausgewählten Kennzahl.',
  },
  {
    key: 'localSeo',
    group: 'Sichtbarkeit',
    label: 'Lokale Sichtbarkeit',
    description: 'Standorte, lokale GSC-Signale und GA4-Standortdaten.',
  },
  {
    key: 'googleGenAi',
    group: 'Sichtbarkeit',
    label: 'Google GenAI Sichtbarkeit',
    description: 'Offizielle oder importierte Google-GenAI-Impressionen.',
  },
  {
    key: 'aiTraffic',
    group: 'KI',
    label: 'KI-Traffic',
    description: 'Sitzungen und Nutzer aus KI-Assistenten.',
  },
  {
    key: 'promptTracking',
    group: 'KI',
    label: 'Prompt Tracking',
    description: 'Prompt-Auswertung und Prompt Research; wird über KI-Traffic geöffnet.',
  },
  {
    key: 'topQueries',
    group: 'Search Console',
    label: 'Top Suchanfragen',
    description: 'Klicks, Impressionen, CTR und Position der Suchanfragen.',
  },
  {
    key: 'landingPages',
    group: 'Search Console',
    label: 'Top Landingpages',
    description: 'Landingpage-Auswertung aus GA4 und GSC.',
  },
  {
    key: 'indexingStatus',
    group: 'Search Console',
    label: 'Indexierungsstatus',
    description: 'Sitemap-Abgleich, Indexierung und Handlungsbedarf.',
  },
  {
    key: 'channelTraffic',
    group: 'Zugriffe',
    label: 'Zugriffe nach Channel',
    description: 'Verteilung der Sitzungen nach Traffic-Channel.',
  },
  {
    key: 'countryTraffic',
    group: 'Zugriffe',
    label: 'Zugriffe nach Land',
    description: 'Geografische Verteilung der Website-Zugriffe.',
  },
  {
    key: 'deviceTraffic',
    group: 'Zugriffe',
    label: 'Zugriffe nach Endgerät',
    description: 'Verteilung nach Desktop, Mobilgerät und Tablet.',
  },
  {
    key: 'googleAds',
    group: 'Weitere Datenquellen',
    label: 'Google Ads Performance',
    description: 'Kosten, Klicks, Kampagnen und Conversions aus Google Ads.',
  },
  {
    key: 'semrushPrimary',
    group: 'Weitere Datenquellen',
    label: 'Semrush Keywords – Kampagne 1',
    description: 'Keyword-Tracking der ersten Semrush-Kampagne.',
  },
  {
    key: 'semrushSecondary',
    group: 'Weitere Datenquellen',
    label: 'Semrush Keywords – Kampagne 2',
    description: 'Keyword-Tracking der zweiten Semrush-Kampagne.',
  },
  {
    key: 'dataInfo',
    group: 'Projekt',
    label: 'Hinweis zur Datenbasis',
    description: 'Methodik-, Datenschutz- und Messhinweise.',
  },
  {
    key: 'dataMaxChat',
    group: 'KI',
    label: 'DataMax Chat',
    description: 'Schwebender DataMax-Assistent im Projekt-Dashboard.',
  },
] as const;

export type DashboardWidgetKey = typeof DASHBOARD_WIDGET_DEFINITIONS[number]['key'];
export type DashboardWidgetVisibility = Record<DashboardWidgetKey, boolean>;

const DEFAULT_HIDDEN_WIDGETS = new Set<DashboardWidgetKey>([
  'googleAds',
  'promptTracking',
]);

export const DEFAULT_DASHBOARD_WIDGET_VISIBILITY = Object.fromEntries(
  DASHBOARD_WIDGET_DEFINITIONS.map(({ key }) => [key, !DEFAULT_HIDDEN_WIDGETS.has(key)])
) as DashboardWidgetVisibility;

type LegacyVisibility = {
  landingPages?: boolean | null;
  googleAds?: boolean | null;
  promptTracking?: boolean | null;
};

export function normalizeDashboardWidgetVisibility(
  value: unknown,
  legacy: LegacyVisibility = {}
): DashboardWidgetVisibility {
  const result: DashboardWidgetVisibility = {
    ...DEFAULT_DASHBOARD_WIDGET_VISIBILITY,
  };

  if (typeof legacy.landingPages === 'boolean') {
    result.landingPages = legacy.landingPages;
  }
  if (typeof legacy.googleAds === 'boolean') {
    result.googleAds = legacy.googleAds;
  }
  if (typeof legacy.promptTracking === 'boolean') {
    result.promptTracking = legacy.promptTracking;
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return result;
  }

  const source = value as Record<string, unknown>;
  DASHBOARD_WIDGET_DEFINITIONS.forEach(({ key }) => {
    if (typeof source[key] === 'boolean') {
      result[key] = source[key];
    }
  });

  return result;
}
