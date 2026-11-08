import { withGa4ResultCache, ga4RunReport } from './ga4-runtime';
import { createAuth } from './client';
import { google } from 'googleapis';
import { requestBudgetOptions } from '../sync/request-budget';
import { GA4_KEY_EVENTS_METRIC } from '@/lib/ga4-metrics';
import type { GoogleAdsGa4Supplement, GoogleAdsMetricLookup } from '@/lib/dashboard-shared';
import { GOOGLE_ADS_SHEET_DATA_VERSION, parseGoogleAdsSheetNumber, readGoogleAdsConversions, reconcileGoogleAdsCampaignConversions, type GoogleAdsSheetRawRow } from '@/lib/google-ads-sheet';

export interface GoogleAdsRow {
  campaign: string;
  adGroup: string;
  adName: string;
  keyword: string;
  searchQuery: string;
  landingPage: string;
  cost: number;
  clicks: number;
  impressions: number;
  cpc: number;
  roas: number;
  conversions: number;
  sessions: number;
  engagedSessions: number;
}

export interface GoogleAdsData {
  rows: GoogleAdsRow[];
  landingPageRows: GoogleAdsRow[];
  totals: {
    cost: number;
    clicks: number;
    avgCpc: number;
    roas: number;
    conversions: number;
    sessions: number;
    engagedSessions: number;
    impressions?: number;
    interactionRate?: number;
  };
  /** Echte Conversions pro Kampagne (1-Dimension-Call, kein Thresholding) */
  conversionsByCampaign?: Record<string, number>;
  /** Echte Conversions pro Anzeigengruppe (1-Dimension-Call, kein Thresholding) */
  conversionsByAdGroup?: Record<string, number>;
  /** Echte Conversions pro Suchanfrage (1-Dimension-Call, kein Thresholding) */
  conversionsByQuery?: Record<string, number>;
  /** Alle Metriken pro Kampagne (1-Dimension-Call, kein Thresholding) */
  metricsByCampaign?: Record<string, { cost: number; clicks: number; sessions: number; engagedSessions: number }>;
  /** Alle Metriken pro Anzeigengruppe (1-Dimension-Call, kein Thresholding) */
  metricsByAdGroup?: Record<string, { cost: number; clicks: number; sessions: number; engagedSessions: number }>;
  /** Sheet-basierte Daten (pro Ebene separat, keine Thresholding-Probleme) */
  campaignRows?: GoogleAdsRow[];
  adGroupRows?: GoogleAdsRow[];
  adRows?: GoogleAdsRow[];
  searchQueryRows?: GoogleAdsRow[];
  /** Datenquelle: 'ga4' (Standard, via GA4 Data API) oder 'sheet' (via Google Ads Script Export) */
  source?: 'ga4' | 'sheet';
  /** Konfigurierte Sheet-ID, damit Dashboard-Caches bei ID-Wechsel sauber invalidieren. */
  configuredSheetId?: string;
  /** Parser-Version, damit alte Sheet-Snapshots einmalig erneuert werden können. */
  sheetDataVersion?: number;
  reportStartDate?: string;
  reportEndDate?: string;
  latestDataDate?: string;
  fetchedAt?: string;
  conversionFallbackUsed?: boolean;
  /** GA4-Ergänzung bei Sheet-Quelle: Sitzungen pro Kampagne/Anzeigengruppe und Abgleich. */
  ga4Supplement?: GoogleAdsGa4Supplement;
}

export async function getGoogleAdsReport(
  propertyId: string,
  startDate: string,
  endDate: string
): Promise<GoogleAdsData> {
  return withGa4ResultCache(
    `adsv2:${propertyId}:${startDate}:${endDate}`,
    () => getGoogleAdsReportUncached(propertyId, startDate, endDate)
  );
}

async function getGoogleAdsReportUncached(
  propertyId: string,
  startDate: string,
  endDate: string
): Promise<GoogleAdsData> {
  const formattedPropertyId = propertyId.startsWith('properties/')
    ? propertyId
    : `properties/${propertyId}`;

  const auth = createAuth();
  const analytics = google.analyticsdata({ version: 'v1beta', auth, ...requestBudgetOptions() });

  // Gemeinsamer Filter: nur Google Ads Traffic
  const adsFilter = {
    notExpression: {
      filter: {
        fieldName: 'sessionGoogleAdsCampaignName',
        stringFilter: { matchType: 'EXACT' as const, value: '(not set)' },
      },
    },
  };

  // ═════════════════════════════════════════
  // CALL 0: Totals OHNE Dimensionen
  //
  // GA4 unterdrückt Conversions bei Multi-Dimension-Queries
  // (Data Thresholding). Ohne Dimensionen liefert die API
  // die echten, ungekürzten Totals.
  // ═════════════════════════════════════════
  const totalsResponse = await ga4RunReport(analytics, {
    property: formattedPropertyId,
    requestBody: {
      dateRanges: [{ startDate, endDate }],
      dimensions: [],
      metrics: [
        { name: 'advertiserAdCost' },
        { name: 'advertiserAdClicks' },
        { name: 'advertiserAdCostPerClick' },
        { name: 'returnOnAdSpend' },
        { name: GA4_KEY_EVENTS_METRIC },
        { name: 'sessions' },
        { name: 'engagedSessions' },
      ],
      dimensionFilter: adsFilter,
    },
  });

  const totalsRow = totalsResponse.data.rows?.[0]?.metricValues || [];
  const totalCost = parseFloat(totalsRow[0]?.value || '0');
  const totalClicks = parseInt(totalsRow[1]?.value || '0', 10);
  const totalAvgCpc = parseFloat(totalsRow[2]?.value || '0');
  const totalRoas = parseFloat(totalsRow[3]?.value || '0');
  const totalConversions = parseFloat(totalsRow[4]?.value || '0');
  const totalSessions = parseInt(totalsRow[5]?.value || '0', 10);
  const totalEngagedSessions = parseInt(totalsRow[6]?.value || '0', 10);

  console.log(
    `[Google Ads] Call 0 Totals → Spend: €${totalCost.toFixed(2)} | Klicks: ${totalClicks} | Conv.: ${totalConversions} | Sessions: ${totalSessions} | Engaged: ${totalEngagedSessions}`
  );

  // ═════════════════════════════════════════
  // CALL 1: Ads-Performance nach Kampagne / AdGroup / Query
  // ═════════════════════════════════════════
  const adsResponse = await ga4RunReport(analytics, {
    property: formattedPropertyId,
    requestBody: {
      dateRanges: [{ startDate, endDate }],
      dimensions: [
        { name: 'sessionGoogleAdsCampaignName' },
        { name: 'sessionGoogleAdsAdGroupName' },
        { name: 'sessionGoogleAdsQuery' },
      ],
      metrics: [
        { name: 'advertiserAdCost' },
        { name: 'advertiserAdClicks' },
        { name: 'advertiserAdCostPerClick' },
        { name: 'returnOnAdSpend' },
        { name: GA4_KEY_EVENTS_METRIC },
        { name: 'sessions' },
        { name: 'engagedSessions' },
      ],
      orderBys: [{ metric: { metricName: 'advertiserAdCost' }, desc: true }],
      limit: '500',
      dimensionFilter: adsFilter,
    },
  });

  const rows: GoogleAdsRow[] = (adsResponse.data.rows || []).map((row) => {
    const dims = row.dimensionValues || [];
    const mets = row.metricValues || [];
    return {
      campaign: dims[0]?.value || '(not set)',
      adGroup: dims[1]?.value || '(not set)',
      adName: '–',
      keyword: '–',
      searchQuery: dims[2]?.value || '(not set)',
      landingPage: '–',
      cost: parseFloat(mets[0]?.value || '0'),
      clicks: parseInt(mets[1]?.value || '0', 10),
      impressions: 0,
      cpc: parseFloat(mets[2]?.value || '0'),
      roas: parseFloat(mets[3]?.value || '0'),
      conversions: parseFloat(mets[4]?.value || '0'),
      sessions: parseInt(mets[5]?.value || '0', 10),
      engagedSessions: parseInt(mets[6]?.value || '0', 10),
    };
  });

  // ═════════════════════════════════════════
  // CALL 1b/1c/1d: Echte Conversions pro Dimension (je 1 Dimension)
  //
  // Call 1 (3 Dimensionen) liefert wegen GA4 Thresholding 0 Conversions.
  // Separate 1-Dimension-Calls liefern die echten, unverfälschten Werte.
  // ═════════════════════════════════════════
  // CALL 1e/1f: Alle Metriken pro Kampagne / Anzeigengruppe (je 1 Dimension)
  //
  // Call 1 (3 Dimensionen) verliert durch Thresholding auch Zeilen
  // bei Kosten, Klicks, Sessions etc. 1-Dimension-Calls liefern
  // die echten Werte für die Hauptzeilen der Tabelle.
  // ═════════════════════════════════════════
  const conversionsByCampaign: Record<string, number> = {};
  const conversionsByAdGroup: Record<string, number> = {};
  const conversionsByQuery: Record<string, number> = {};
  const metricsByCampaign: Record<string, { cost: number; clicks: number; sessions: number; engagedSessions: number }> = {};
  const metricsByAdGroup: Record<string, { cost: number; clicks: number; sessions: number; engagedSessions: number }> = {};

  try {
    const [convByCamp, convByAg, convByQuery, metsByCamp, metsByAg] = await Promise.all([
      ga4RunReport(analytics, {
        property: formattedPropertyId,
        requestBody: {
          dateRanges: [{ startDate, endDate }],
          dimensions: [{ name: 'sessionGoogleAdsCampaignName' }],
          metrics: [{ name: GA4_KEY_EVENTS_METRIC }],
          dimensionFilter: adsFilter,
        },
      }),
      ga4RunReport(analytics, {
        property: formattedPropertyId,
        requestBody: {
          dateRanges: [{ startDate, endDate }],
          dimensions: [{ name: 'sessionGoogleAdsAdGroupName' }],
          metrics: [{ name: GA4_KEY_EVENTS_METRIC }],
          dimensionFilter: adsFilter,
        },
      }),
      ga4RunReport(analytics, {
        property: formattedPropertyId,
        requestBody: {
          dateRanges: [{ startDate, endDate }],
          dimensions: [{ name: 'sessionGoogleAdsQuery' }],
          metrics: [{ name: GA4_KEY_EVENTS_METRIC }],
          dimensionFilter: adsFilter,
        },
      }),
      // CALL 1e: Alle Metriken pro Kampagne (1 Dimension)
      ga4RunReport(analytics, {
        property: formattedPropertyId,
        requestBody: {
          dateRanges: [{ startDate, endDate }],
          dimensions: [{ name: 'sessionGoogleAdsCampaignName' }],
          metrics: [
            { name: 'advertiserAdCost' },
            { name: 'advertiserAdClicks' },
            { name: 'sessions' },
            { name: 'engagedSessions' },
          ],
          dimensionFilter: adsFilter,
        },
      }),
      // CALL 1f: Alle Metriken pro Anzeigengruppe (1 Dimension)
      ga4RunReport(analytics, {
        property: formattedPropertyId,
        requestBody: {
          dateRanges: [{ startDate, endDate }],
          dimensions: [{ name: 'sessionGoogleAdsAdGroupName' }],
          metrics: [
            { name: 'advertiserAdCost' },
            { name: 'advertiserAdClicks' },
            { name: 'sessions' },
            { name: 'engagedSessions' },
          ],
          dimensionFilter: adsFilter,
        },
      }),
    ]);

    for (const row of convByCamp.data.rows || []) {
      const name = row.dimensionValues?.[0]?.value || '(not set)';
      conversionsByCampaign[name] = parseFloat(row.metricValues?.[0]?.value || '0');
    }
    for (const row of convByAg.data.rows || []) {
      const name = row.dimensionValues?.[0]?.value || '(not set)';
      conversionsByAdGroup[name] = parseFloat(row.metricValues?.[0]?.value || '0');
    }
    for (const row of convByQuery.data.rows || []) {
      const name = row.dimensionValues?.[0]?.value || '(not set)';
      conversionsByQuery[name] = parseFloat(row.metricValues?.[0]?.value || '0');
    }

    // Metriken-Lookups für Kampagnen
    for (const row of metsByCamp.data.rows || []) {
      const name = row.dimensionValues?.[0]?.value || '(not set)';
      const mets = row.metricValues || [];
      metricsByCampaign[name] = {
        cost: parseFloat(mets[0]?.value || '0'),
        clicks: parseInt(mets[1]?.value || '0', 10),
        sessions: parseInt(mets[2]?.value || '0', 10),
        engagedSessions: parseInt(mets[3]?.value || '0', 10),
      };
    }

    // Metriken-Lookups für Anzeigengruppen
    for (const row of metsByAg.data.rows || []) {
      const name = row.dimensionValues?.[0]?.value || '(not set)';
      const mets = row.metricValues || [];
      metricsByAdGroup[name] = {
        cost: parseFloat(mets[0]?.value || '0'),
        clicks: parseInt(mets[1]?.value || '0', 10),
        sessions: parseInt(mets[2]?.value || '0', 10),
        engagedSessions: parseInt(mets[3]?.value || '0', 10),
      };
    }

    console.log(`[Google Ads] Conv-Lookups → Campaigns: ${Object.keys(conversionsByCampaign).length} | AdGroups: ${Object.keys(conversionsByAdGroup).length} | Queries: ${Object.keys(conversionsByQuery).length}`);
    console.log(`[Google Ads] Metrics-Lookups → Campaigns: ${Object.keys(metricsByCampaign).length} | AdGroups: ${Object.keys(metricsByAdGroup).length}`);
  } catch (e) {
    console.warn('[Google Ads] Conv/Metrics-Lookup fehlgeschlagen (ignoriert):', e);
  }

  // ═════════════════════════════════════════
  // CALL 2: Landingpages
  //
  // Versuch A: Mit Ad-Metriken (Kosten/Klicks) — benötigt Google-Ads-Dimension.
  //            Kann wegen Thresholding bei wenig Daten 0 Rows liefern.
  // Versuch B: Fallback ohne Ad-Metriken — nur Sessions/Conv./EngagedSessions.
  //            Funktioniert immer, aber ohne Kosten/Klicks.
  // ═════════════════════════════════════════
  let landingPageRows: GoogleAdsRow[] = [];

  // Versuch A: Mit Kosten (2 Dimensionen + Ad-Metriken)
  try {
    const lpFullResponse = await ga4RunReport(analytics, {
      property: formattedPropertyId,
      requestBody: {
        dateRanges: [{ startDate, endDate }],
        dimensions: [
          { name: 'landingPagePlusQueryString' },
          { name: 'sessionGoogleAdsCampaignName' },
        ],
        metrics: [
          { name: 'advertiserAdCost' },
          { name: 'advertiserAdClicks' },
          { name: 'advertiserAdCostPerClick' },
          { name: GA4_KEY_EVENTS_METRIC },
          { name: 'sessions' },
          { name: 'engagedSessions' },
        ],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: '200',
        dimensionFilter: adsFilter,
      },
    });

    const fullRows = lpFullResponse.data.rows || [];
    if (fullRows.length > 0) {
      landingPageRows = fullRows.map((row) => {
        const dims = row.dimensionValues || [];
        const mets = row.metricValues || [];
        return {
          campaign: dims[1]?.value || '(not set)',
          adGroup: '–',
          adName: '–',
          keyword: '–',
          searchQuery: '–',
          landingPage: dims[0]?.value || '(not set)',
          cost: parseFloat(mets[0]?.value || '0'),
          clicks: parseInt(mets[1]?.value || '0', 10),
          impressions: 0,
          cpc: parseFloat(mets[2]?.value || '0'),
          roas: 0,
          conversions: parseFloat(mets[3]?.value || '0'),
          sessions: parseInt(mets[4]?.value || '0', 10),
          engagedSessions: parseInt(mets[5]?.value || '0', 10),
        };
      });
      console.log(`[Google Ads] LP-Call A (mit Kosten): ${landingPageRows.length} Landingpages ✅`);
    } else {
      console.log('[Google Ads] LP-Call A: 0 Rows (Thresholding) → Fallback B');
    }
  } catch (e) {
    console.log('[Google Ads] LP-Call A fehlgeschlagen → Fallback B');
  }

  // Versuch B: Fallback ohne Ad-Metriken (falls A leer)
  if (landingPageRows.length === 0) {
    try {
      const lpResponse = await ga4RunReport(analytics, {
        property: formattedPropertyId,
        requestBody: {
          dateRanges: [{ startDate, endDate }],
          dimensions: [
            { name: 'landingPagePlusQueryString' },
          ],
          metrics: [
            { name: 'sessions' },
            { name: GA4_KEY_EVENTS_METRIC },
            { name: 'engagedSessions' },
          ],
          orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
          limit: '200',
          dimensionFilter: {
            filter: {
              fieldName: 'sessionDefaultChannelGroup',
              stringFilter: { matchType: 'EXACT' as const, value: 'Paid Search' },
            },
          },
        },
      });

      landingPageRows = (lpResponse.data.rows || []).map((row) => {
        const dims = row.dimensionValues || [];
        const mets = row.metricValues || [];
        return {
          campaign: '–',
          adGroup: '–',
          adName: '–',
          keyword: '–',
          searchQuery: '–',
          landingPage: dims[0]?.value || '(not set)',
          cost: 0,
          clicks: 0,
          impressions: 0,
          cpc: 0,
          roas: 0,
          conversions: parseFloat(mets[1]?.value || '0'),
          sessions: parseInt(mets[0]?.value || '0', 10),
          engagedSessions: parseInt(mets[2]?.value || '0', 10),
        };
      });

      console.log(`[Google Ads] LP-Call B (ohne Kosten): ${landingPageRows.length} Landingpages`);
    } catch (e) {
      console.warn('[Google Ads] LP-Call B fehlgeschlagen (ignoriert):', e);
    }
  }

  // ═════════════════════════════════════════
  // Totals aus Call 0 (dimensionsfrei = kein Thresholding)
  // ═════════════════════════════════════════
  const totals = {
    cost: totalCost,
    clicks: totalClicks,
    avgCpc: totalAvgCpc,
    roas: totalRoas,
    conversions: totalConversions,
    sessions: totalSessions,
    engagedSessions: totalEngagedSessions,
  };

  return { rows, landingPageRows, totals, conversionsByCampaign, conversionsByAdGroup, conversionsByQuery, metricsByCampaign, metricsByAdGroup };
}

/**
 * Schlanke GA4-Abfrage für Projekte mit Sheet-Quelle: Kosten und Klicks dienen
 * nur dem Admin-Abgleich, Sitzungen ergänzen die Sheet-Tabelle.
 */
export async function getGoogleAdsGa4Supplement(
  propertyId: string,
  startDate: string,
  endDate: string,
): Promise<GoogleAdsGa4Supplement> {
  return withGa4ResultCache(
    `adsga4sup:${propertyId}:${startDate}:${endDate}`,
    () => getGoogleAdsGa4SupplementUncached(propertyId, startDate, endDate),
  );
}

async function getGoogleAdsGa4SupplementUncached(
  propertyId: string,
  startDate: string,
  endDate: string,
): Promise<GoogleAdsGa4Supplement> {
  const property = propertyId.startsWith('properties/') ? propertyId : `properties/${propertyId}`;
  const analytics = google.analyticsdata({ version: 'v1beta', auth: createAuth(), ...requestBudgetOptions() });
  const dimensionFilter = {
    notExpression: {
      filter: {
        fieldName: 'sessionGoogleAdsCampaignName',
        stringFilter: { matchType: 'EXACT' as const, value: '(not set)' },
      },
    },
  };
  const metrics = [
    { name: 'advertiserAdCost' },
    { name: 'advertiserAdClicks' },
    { name: 'sessions' },
    { name: 'engagedSessions' },
  ];
  const report = (dimension?: string) => ga4RunReport(analytics, {
    property,
    requestBody: {
      dateRanges: [{ startDate, endDate }],
      dimensions: dimension ? [{ name: dimension }] : [],
      metrics: dimension ? metrics : [...metrics, { name: GA4_KEY_EVENTS_METRIC }],
      dimensionFilter,
      ...(dimension ? { limit: '1000' } : {}),
    },
  });
  const toLookup = (values: Array<{ value?: string | null }> = []): GoogleAdsMetricLookup => ({
    cost: parseFloat(values[0]?.value || '0'),
    clicks: parseInt(values[1]?.value || '0', 10),
    sessions: parseInt(values[2]?.value || '0', 10),
    engagedSessions: parseInt(values[3]?.value || '0', 10),
  });

  const [totalsResponse, campaignResponse, adGroupResponse] = await Promise.all([
    report(),
    report('sessionGoogleAdsCampaignName'),
    report('sessionGoogleAdsAdGroupName'),
  ]);

  const totalsValues = totalsResponse.data.rows?.[0]?.metricValues || [];
  const byName = (rows: typeof campaignResponse.data.rows) => {
    const result: Record<string, GoogleAdsMetricLookup> = {};
    for (const row of rows || []) {
      const name = row.dimensionValues?.[0]?.value || '(not set)';
      result[name] = toLookup(row.metricValues || []);
    }
    return result;
  };

  return {
    totals: { ...toLookup(totalsValues), conversions: parseFloat(totalsValues[4]?.value || '0') },
    byCampaign: byName(campaignResponse.data.rows),
    byAdGroup: byName(adGroupResponse.data.rows),
  };
}

type SheetRowRaw = GoogleAdsSheetRawRow;

function parseSheetDate(val: string | undefined): Date | null {
  if (!val) return null;
  // Handles YYYY-MM-DD (from Ads Script)
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

function isInDateRange(dateStr: string | undefined, startDate: string, endDate: string): boolean {
  const d = parseSheetDate(dateStr);
  if (!d) return false;
  const start = new Date(startDate);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999); // inclusive
  return d >= start && d <= end;
}

async function readSheetTab(
  sheets: ReturnType<typeof google.sheets>,
  sheetId: string,
  tabName: string
): Promise<SheetRowRaw[]> {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      // Ganze Spalten lesen: Bei Tagesdaten über 24 Monate haben Anzeigen und
      // Suchanfragen leicht mehr als 50.000 Zeilen.
      range: `'${tabName}'!A:Z`,
    });

    const rows = response.data.values;
    if (!rows || rows.length < 2) return [];

    const headers = rows[0];
    return rows.slice(1).map((row) => {
      const obj: SheetRowRaw = {};
      headers.forEach((header, index) => {
        const key = header?.trim();
        if (key) obj[key] = row[index]?.toString().trim() || '';
      });
      return obj;
    });
  } catch (e) {
    console.warn(`[Google Ads Sheet] Tab "${tabName}" nicht lesbar:`, e);
    throw e;
  }
}

function sheetRowToAdsRow(
  raw: SheetRowRaw,
  mapping: {
    campaign?: string;
    adGroup?: string;
    adName?: string;
    searchQuery?: string;
  }
): GoogleAdsRow {
  const impressions = parseGoogleAdsSheetNumber(raw['Impressionen']);
  const clicks = parseGoogleAdsSheetNumber(raw['Klicks']);
  const cost = parseGoogleAdsSheetNumber(raw['Kosten']);
  return {
    campaign: raw[mapping.campaign || 'Kampagne'] || '(not set)',
    adGroup: raw[mapping.adGroup || 'Anzeigengruppe'] || '–',
    adName: raw[mapping.adName || 'AnzeigenName'] || '–',
    keyword: '–',
    searchQuery: raw[mapping.searchQuery || 'Suchanfrage'] || '–',
    landingPage: '–',
    cost,
    clicks,
    impressions,
    cpc: clicks > 0 ? cost / clicks : 0,
    roas: 0,
    conversions: readGoogleAdsConversions(raw),
    sessions: 0,
    engagedSessions: 0,
  };
}

export async function getGoogleAdsFromSheet(
  sheetId: string,
  startDate: string,
  endDate: string
): Promise<GoogleAdsData> {
  const auth = createAuth();
  const sheets = google.sheets({ version: 'v4', auth, ...requestBudgetOptions() });

  console.log(`[Google Ads Sheet] Lese Sheet ${sheetId} für ${startDate} – ${endDate}`);

  // ── Alle Tabs parallel lesen ──
  const [rawCampaigns, rawAdGroups, rawAds, rawQueries] = await Promise.all([
    readSheetTab(sheets, sheetId, 'Kampagnen'),
    readSheetTab(sheets, sheetId, 'Anzeigengruppen'),
    readSheetTab(sheets, sheetId, 'Anzeigen'),
    readSheetTab(sheets, sheetId, 'Suchanfragen'),
  ]);

  // ── Nach Datum filtern ──
  const filteredCampaigns = rawCampaigns.filter((r) => isInDateRange(r['Datum'], startDate, endDate));
  const filteredAdGroups = rawAdGroups.filter((r) => isInDateRange(r['Datum'], startDate, endDate));
  const filteredAds = rawAds.filter((r) => isInDateRange(r['Datum'], startDate, endDate));
  const filteredQueries = rawQueries.filter((r) => isInDateRange(r['Datum'], startDate, endDate));

  console.log(`[Google Ads Sheet] Gefiltert → Kampagnen: ${filteredCampaigns.length} | AG: ${filteredAdGroups.length} | Anzeigen: ${filteredAds.length} | SQ: ${filteredQueries.length}`);

  // ── In GoogleAdsRow[] konvertieren ──
  const parsedCampaignRows: GoogleAdsRow[] = filteredCampaigns.map((r) =>
    sheetRowToAdsRow(r, { campaign: 'Kampagne' })
  );

  const adGroupRows: GoogleAdsRow[] = filteredAdGroups.map((r) =>
    sheetRowToAdsRow(r, { campaign: 'Kampagne', adGroup: 'Anzeigengruppe' })
  );

  const adRows: GoogleAdsRow[] = filteredAds.map((r) =>
    sheetRowToAdsRow(r, { campaign: 'Kampagne', adGroup: 'Anzeigengruppe', adName: 'AnzeigenName' })
  );

  const searchQueryRows: GoogleAdsRow[] = filteredQueries.map((r) =>
    sheetRowToAdsRow(r, { campaign: 'Kampagne', adGroup: 'Anzeigengruppe', searchQuery: 'Suchanfrage' })
  );

  // Einige Ads-Script-/Kontokonstellationen liefern Conversions auf der
  // Kampagnenebene leer, obwohl sie auf der Anzeigengruppen- oder Anzeigenebene
  // vorhanden sind. In diesem Fall genau eine vollständige Detailebene nutzen.
  const conversionResult = reconcileGoogleAdsCampaignConversions(
    parsedCampaignRows,
    [adGroupRows, adRows, searchQueryRows],
  );
  const campaignRows = conversionResult.rows;

  // ── Totals aus Kampagnen-Tab berechnen (höchste Ebene = kein Doppelzählen) ──
  let totalCost = 0;
  let totalClicks = 0;
  let totalImpressions = 0;
  let totalConversions = 0;

  for (const row of campaignRows) {
    totalCost += row.cost;
    totalClicks += row.clicks;
    totalImpressions += row.impressions;
    totalConversions += row.conversions;
  }

  const totals = {
    cost: totalCost,
    clicks: totalClicks,
    avgCpc: totalClicks > 0 ? totalCost / totalClicks : 0,
    roas: 0,
    conversions: totalConversions,
    sessions: 0,
    engagedSessions: 0,
    impressions: totalImpressions,
    interactionRate: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
  };

  console.log(
    `[Google Ads Sheet] Totals → Spend: €${totalCost.toFixed(2)} | Klicks: ${totalClicks} | Conv.: ${totalConversions}` +
    `${conversionResult.fallbackUsed ? ' (aus Detailebene rekonstruiert)' : ''}`
  );

  const campaignDates = filteredCampaigns
    .map((row) => parseSheetDate(row['Datum'])?.toISOString().slice(0, 10))
    .filter(Boolean)
    .sort();
  const latestDataDate = campaignDates[campaignDates.length - 1];

  // rows = adGroupRows als Fallback für Legacy-Kompatibilität (aggregateBy funktioniert damit)
  return {
    rows: adGroupRows,
    landingPageRows: [],
    totals,
    campaignRows,
    adGroupRows,
    adRows,
    searchQueryRows,
    source: 'sheet',
    configuredSheetId: sheetId,
    sheetDataVersion: GOOGLE_ADS_SHEET_DATA_VERSION,
    reportStartDate: startDate,
    fetchedAt: new Date().toISOString(),
    reportEndDate: endDate,
    latestDataDate,
    conversionFallbackUsed: conversionResult.fallbackUsed,
  };
}
