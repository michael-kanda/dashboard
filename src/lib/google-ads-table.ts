import type { GoogleAdsData, GoogleAdsRow } from './dashboard-shared';

export interface GoogleAdsTableRow {
  label: string;
  cost: number;
  clicks: number;
  cpc: number;
  interactionRate: number;
  conversions: number;
  sessions: number;
  subRows?: GoogleAdsRow[];
  /** Restzeile, damit die Tabelle mit den Summen oben übereinstimmt. */
  isRemainder?: boolean;
}

type MetricsLookup = Record<string, { cost: number; clicks: number; sessions: number; engagedSessions: number }>;

export const GOOGLE_ADS_UNASSIGNED_LABEL = 'Nicht zugeordnet';
export const GOOGLE_ADS_NO_AD_GROUP_LABEL = 'Ohne Anzeigengruppe';

export function aggregateGoogleAdsRows(rows: GoogleAdsRow[], field: keyof GoogleAdsRow): GoogleAdsTableRow[] {
  const map = new Map<
    string,
    {
      cost: number;
      clicks: number;
      impressions: number;
      conversions: number;
      sessions: number;
      engagedSessions: number;
      subRows: GoogleAdsRow[];
    }
  >();

  for (const row of rows) {
    const key = String(row[field]) || '(not set)';
    if (key === '–' || key === 'undefined' || key === '') continue;
    const existing = map.get(key) || {
      cost: 0,
      clicks: 0,
      impressions: 0,
      conversions: 0,
      sessions: 0,
      engagedSessions: 0,
      subRows: [],
    };
    existing.cost += row.cost;
    existing.clicks += row.clicks;
    existing.impressions += row.impressions ?? 0;
    existing.conversions += row.conversions;
    existing.sessions += row.sessions;
    existing.engagedSessions += row.engagedSessions ?? 0;
    existing.subRows.push(row);
    map.set(key, existing);
  }

  return Array.from(map.entries()).map(([label, agg]) => ({
    label,
    cost: agg.cost,
    clicks: agg.clicks,
    cpc: agg.clicks > 0 ? agg.cost / agg.clicks : 0,
    // Sheet-Daten: Klicks/Impressionen, GA4-Daten: Engaged/Sessions
    interactionRate: agg.impressions > 0
      ? (agg.clicks / agg.impressions) * 100
      : agg.sessions > 0
      ? (agg.engagedSessions / agg.sessions) * 100
      : 0,
    conversions: agg.conversions,
    sessions: agg.sessions,
    subRows: agg.subRows,
  }));
}

function applyLookups(
  rows: GoogleAdsTableRow[],
  metrics: MetricsLookup | undefined,
  conversions: Record<string, number> | undefined,
): GoogleAdsTableRow[] {
  const byLabel = new Map(rows.map((row) => [row.label, row]));

  // Einträge, die nur in den 1-Dimension-Abfragen vorkommen (z. B. Performance
  // Max ohne Suchanfrage), fehlen in der 3-Dimensionen-Abfrage komplett.
  for (const label of Object.keys(metrics ?? {})) {
    if (!byLabel.has(label)) {
      const row: GoogleAdsTableRow = {
        label,
        cost: 0,
        clicks: 0,
        cpc: 0,
        interactionRate: 0,
        conversions: 0,
        sessions: 0,
        subRows: [],
      };
      byLabel.set(label, row);
      rows.push(row);
    }
  }

  for (const row of rows) {
    const lookup = metrics?.[row.label];
    if (lookup) {
      row.cost = lookup.cost;
      row.clicks = lookup.clicks;
      row.cpc = lookup.clicks > 0 ? lookup.cost / lookup.clicks : 0;
      row.sessions = lookup.sessions;
      row.interactionRate = lookup.sessions > 0 ? (lookup.engagedSessions / lookup.sessions) * 100 : 0;
    }
    if (conversions?.[row.label] !== undefined) {
      row.conversions = conversions[row.label];
    }
  }

  return rows;
}

function appendRemainder(rows: GoogleAdsTableRow[], totals: GoogleAdsData['totals']): GoogleAdsTableRow[] {
  const sum = rows.reduce(
    (acc, row) => ({
      cost: acc.cost + row.cost,
      clicks: acc.clicks + row.clicks,
      conversions: acc.conversions + row.conversions,
      sessions: acc.sessions + row.sessions,
    }),
    { cost: 0, clicks: 0, conversions: 0, sessions: 0 },
  );

  const cost = Math.max(0, totals.cost - sum.cost);
  const clicks = Math.max(0, totals.clicks - sum.clicks);
  const sessions = Math.max(0, totals.sessions - sum.sessions);
  const conversions = Math.max(0, totals.conversions - sum.conversions);

  if (cost < 0.01 && clicks < 1 && sessions < 1) return rows;

  rows.push({
    label: GOOGLE_ADS_UNASSIGNED_LABEL,
    cost,
    clicks,
    cpc: clicks > 0 ? cost / clicks : 0,
    interactionRate: 0,
    conversions,
    sessions,
    subRows: [],
    isRemainder: true,
  });
  return rows;
}

/**
 * Zeilen für die Kampagnen- und Anzeigengruppen-Ansicht im GA4-Modus.
 *
 * Basis sind die 1-Dimension-Abfragen (vollständig, kein Thresholding). Die
 * 3-Dimensionen-Abfrage liefert nur noch die Unterzeilen fürs Aufklappen.
 * Was danach noch zu den Summen fehlt, landet in einer Restzeile, damit die
 * Tabelle immer zu den Kennzahlen oben passt.
 */
export function buildGa4GoogleAdsLevelRows(
  data: GoogleAdsData,
  level: 'campaign' | 'adGroup',
): GoogleAdsTableRow[] {
  const aggregated = aggregateGoogleAdsRows(data.rows, level);
  const rows = level === 'campaign'
    ? applyLookups(aggregated, data.metricsByCampaign, data.conversionsByCampaign)
    : applyLookups(aggregated, data.metricsByAdGroup, data.conversionsByAdGroup);

  if (level === 'adGroup') {
    for (const row of rows) {
      if (row.label === '(not set)') row.label = GOOGLE_ADS_NO_AD_GROUP_LABEL;
    }
  }

  return appendRemainder(rows, data.totals);
}

/**
 * Sheet-Quelle: Sitzungen aus GA4 pro Kampagne bzw. Anzeigengruppe ergänzen.
 * Kosten, Klicks und Conversions bleiben aus Google Ads.
 */
export function applyGa4SessionsToSheetRows(
  rows: GoogleAdsTableRow[],
  data: GoogleAdsData,
  level: 'campaign' | 'adGroup',
): GoogleAdsTableRow[] {
  const lookup = level === 'campaign' ? data.ga4Supplement?.byCampaign : data.ga4Supplement?.byAdGroup;
  if (!lookup) return rows;
  for (const row of rows) {
    row.sessions = lookup[row.label]?.sessions ?? 0;
  }
  return rows;
}

export interface GoogleAdsSourceComparisonValue {
  sheet: number;
  ga4: number;
  /** Abweichung GA4 gegenüber Sheet in Prozent; null, wenn das Sheet 0 hat. */
  diffPercent: number | null;
}

export interface GoogleAdsSourceComparison {
  cost: GoogleAdsSourceComparisonValue;
  clicks: GoogleAdsSourceComparisonValue;
  /** true, wenn Kosten oder Klicks mehr als die Toleranz abweichen. */
  hasWarning: boolean;
}

export const GOOGLE_ADS_COMPARISON_TOLERANCE_PERCENT = 10;

function compareValue(sheet: number, ga4: number): GoogleAdsSourceComparisonValue {
  return { sheet, ga4, diffPercent: sheet > 0 ? ((ga4 - sheet) / sheet) * 100 : null };
}

function exceedsTolerance(value: GoogleAdsSourceComparisonValue): boolean {
  if (value.diffPercent === null) return value.ga4 > 0;
  return Math.abs(value.diffPercent) > GOOGLE_ADS_COMPARISON_TOLERANCE_PERCENT;
}

/** Abgleich Sheet gegen GA4 für Admins. Nur bei Sheet-Quelle mit GA4-Ergänzung. */
export function compareGoogleAdsSources(data: GoogleAdsData): GoogleAdsSourceComparison | null {
  if (data.source !== 'sheet' || !data.ga4Supplement) return null;
  const cost = compareValue(data.totals.cost, data.ga4Supplement.totals.cost);
  const clicks = compareValue(data.totals.clicks, data.ga4Supplement.totals.clicks);
  if (cost.sheet === 0 && cost.ga4 === 0 && clicks.sheet === 0 && clicks.ga4 === 0) return null;
  return { cost, clicks, hasWarning: exceedsTolerance(cost) || exceedsTolerance(clicks) };
}
