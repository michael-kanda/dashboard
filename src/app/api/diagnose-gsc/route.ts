// src/app/api/diagnose-gsc/route.ts
// GSC Diagnose-Route - Findet das Problem mit den GSC-Daten

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { sql } from '@vercel/postgres';
import { google } from 'googleapis';
import { JWT } from 'google-auth-library';

export const dynamic = 'force-dynamic';

interface DiagnoseResult {
  step: string;
  status: 'ok' | 'error' | 'warning';
  message: string;
  details?: any;
}

const GEN_AI_SEARCH_APPEARANCE_MATCHERS = [
  'ai overview',
  'ai overviews',
  'ai mode',
  'generative ai',
  'generative ki',
  'gen ai',
  'search generative',
  'auf generativer ki basierende funktionen',
];

function normalizeSearchAppearance(value: string): string {
  return value
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/[^a-z0-9äöüß]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isGenAiSearchAppearance(value: string): boolean {
  const normalized = normalizeSearchAppearance(value);
  return GEN_AI_SEARCH_APPEARANCE_MATCHERS.some((needle) => normalized.includes(needle));
}

function getDateParam(searchParams: URLSearchParams, key: string): string | null {
  const value = searchParams.get(key);
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

async function queryGscDimensionWithAppearanceFilter(
  searchconsole: any,
  siteUrl: string,
  startDate: string,
  endDate: string,
  dimension: 'date' | 'page',
  appearance: string,
  rowLimit = 25000,
) {
  const response = await searchconsole.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate,
      endDate,
      dimensions: [dimension],
      rowLimit,
      type: 'web',
      dimensionFilterGroups: [{
        groupType: 'and',
        filters: [{
          dimension: 'searchAppearance',
          operator: 'equals',
          expression: appearance,
        }],
      }],
    },
  });

  return response.data.rows || [];
}

function createAuth(): JWT | null {
  try {
    if (process.env.GOOGLE_CREDENTIALS) {
      const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
      return new JWT({
        email: credentials.client_email,
        key: credentials.private_key,
        scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
      });
    }
    
    const privateKeyBase64 = process.env.GOOGLE_PRIVATE_KEY_BASE64;
    const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;

    if (!privateKeyBase64 || !clientEmail) {
      return null;
    }

    const privateKey = Buffer.from(privateKeyBase64, 'base64').toString('utf-8');
    return new JWT({
      email: clientEmail,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
    });
  } catch (e) {
    console.error('Auth creation error:', e);
    return null;
  }
}

export async function GET(request: NextRequest) {
  const results: DiagnoseResult[] = [];
  
  try {
    // 1. Auth Check
    const session = await auth();
    if (session?.user?.role !== 'SUPERADMIN' && session?.user?.role !== 'ADMIN') {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const shouldRunGenAiDiagnosis = searchParams.get('genAi') !== '0';

    // ==========================================
    // SCHRITT 1: Credentials prüfen
    // ==========================================
    results.push({
      step: '1. Credentials Check',
      status: process.env.GOOGLE_CREDENTIALS || process.env.GOOGLE_PRIVATE_KEY_BASE64 ? 'ok' : 'error',
      message: process.env.GOOGLE_CREDENTIALS 
        ? 'GOOGLE_CREDENTIALS gefunden' 
        : process.env.GOOGLE_PRIVATE_KEY_BASE64 
          ? 'GOOGLE_PRIVATE_KEY_BASE64 gefunden'
          : '❌ KEINE CREDENTIALS GEFUNDEN!',
      details: {
        hasGoogleCredentials: !!process.env.GOOGLE_CREDENTIALS,
        hasBase64Key: !!process.env.GOOGLE_PRIVATE_KEY_BASE64,
        hasServiceEmail: !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      }
    });

    // ==========================================
    // SCHRITT 2: Auth-Objekt erstellen
    // ==========================================
    const authClient = createAuth();
    
    if (!authClient) {
      results.push({
        step: '2. Auth Client',
        status: 'error',
        message: '❌ Konnte Auth-Client nicht erstellen!',
      });
      return NextResponse.json({ results });
    }

    let serviceEmail = '';
    try {
      if (process.env.GOOGLE_CREDENTIALS) {
        const creds = JSON.parse(process.env.GOOGLE_CREDENTIALS);
        serviceEmail = creds.client_email;
      } else {
        serviceEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '';
      }
    } catch (e) {}

    results.push({
      step: '2. Auth Client',
      status: 'ok',
      message: 'Auth-Client erfolgreich erstellt',
      details: {
        serviceAccountEmail: serviceEmail,
        hint: '⚠️ Diese E-Mail muss in der GSC als Nutzer hinzugefügt werden!'
      }
    });

    // ==========================================
    // SCHRITT 3: GSC API testen - Sites auflisten
    // ==========================================
    const searchconsole = google.searchconsole({ version: 'v1', auth: authClient });
    
    let availableSites: string[] = [];
    try {
      const sitesResponse = await searchconsole.sites.list();
      availableSites = sitesResponse.data.siteEntry?.map(s => s.siteUrl || '') || [];
      
      results.push({
        step: '3. GSC Sites Liste',
        status: availableSites.length > 0 ? 'ok' : 'warning',
        message: availableSites.length > 0 
          ? `${availableSites.length} Sites gefunden` 
          : '⚠️ Keine Sites gefunden - Service Account hat keinen Zugriff!',
        details: {
          sites: availableSites,
          hint: availableSites.length === 0 
            ? `Füge "${serviceEmail}" als Nutzer in der GSC hinzu!`
            : null
        }
      });
    } catch (e: any) {
      results.push({
        step: '3. GSC Sites Liste',
        status: 'error',
        message: '❌ Fehler beim Abrufen der Sites',
        details: {
          error: e.message,
          code: e.code,
          hint: 'Prüfe ob die Search Console API aktiviert ist!'
        }
      });
    }

    // ==========================================
    // SCHRITT 4: User-spezifische Prüfung
    // ==========================================
    if (userId) {
      const { rows: userRows } = await sql`
        SELECT id, email, domain, gsc_site_url 
        FROM users 
        WHERE id::text = ${userId}
      `;

      if (userRows.length === 0) {
        results.push({
          step: '4. User-Daten',
          status: 'error',
          message: '❌ User nicht gefunden',
        });
      } else {
        const user = userRows[0];
        const gscUrl = user.gsc_site_url;

        results.push({
          step: '4. User-Daten',
          status: gscUrl ? 'ok' : 'warning',
          message: gscUrl ? 'GSC URL konfiguriert' : '⚠️ Keine GSC URL konfiguriert!',
          details: {
            email: user.email,
            domain: user.domain,
            gsc_site_url: gscUrl,
            format_hint: gscUrl ? null : 'Erwartet: "sc-domain:example.com" oder "https://www.example.com/"'
          }
        });

        // ==========================================
        // SCHRITT 5: URL-Format prüfen
        // ==========================================
        if (gscUrl) {
          const isDomainProperty = gscUrl.startsWith('sc-domain:');
          const isUrlPrefix = gscUrl.startsWith('http://') || gscUrl.startsWith('https://');
          
          let urlFormatStatus: 'ok' | 'warning' | 'error' = 'ok';
          let urlFormatMessage = '';
          
          if (isDomainProperty) {
            urlFormatMessage = '✅ Domain Property Format (sc-domain:...)';
          } else if (isUrlPrefix) {
            urlFormatMessage = '✅ URL Prefix Format (https://...)';
          } else {
            urlFormatStatus = 'error';
            urlFormatMessage = '❌ Ungültiges Format! Muss mit "sc-domain:" oder "https://" beginnen';
          }

          results.push({
            step: '5. URL-Format',
            status: urlFormatStatus,
            message: urlFormatMessage,
            details: {
              currentValue: gscUrl,
              isDomainProperty,
              isUrlPrefix,
              examples: [
                'sc-domain:example.com',
                'https://www.example.com/',
                'https://example.com/'
              ]
            }
          });

          // ==========================================
          // SCHRITT 6: Zugriff auf diese spezifische Site prüfen
          // ==========================================
          const hasAccessToSite = availableSites.some(site => 
            site === gscUrl || 
            site.includes(gscUrl.replace('sc-domain:', '')) ||
            gscUrl.includes(site.replace('sc-domain:', '').replace('https://', '').replace('http://', ''))
          );

          results.push({
            step: '6. Site-Zugriff',
            status: hasAccessToSite ? 'ok' : 'error',
            message: hasAccessToSite 
              ? '✅ Service Account hat Zugriff auf diese Site'
              : '❌ Service Account hat KEINEN Zugriff auf diese Site!',
            details: {
              requestedSite: gscUrl,
              availableSites: availableSites,
              solution: hasAccessToSite ? null : `
                1. Gehe zu: https://search.google.com/search-console
                2. Wähle die Property: ${gscUrl}
                3. Einstellungen > Nutzer und Berechtigungen
                4. Füge hinzu: ${serviceEmail}
                5. Berechtigung: "Vollständig" oder "Eingeschränkt"
              `
            }
          });

          // ==========================================
          // SCHRITT 7: Tatsächliche Datenabfrage testen
          // ==========================================
          if (hasAccessToSite || availableSites.length > 0) {
            try {
              const testEndDate = new Date();
              testEndDate.setDate(testEndDate.getDate() - 3);
              const testStartDate = new Date(testEndDate);
              testStartDate.setDate(testStartDate.getDate() - 7);

              const startStr = testStartDate.toISOString().split('T')[0];
              const endStr = testEndDate.toISOString().split('T')[0];

              const testResponse = await searchconsole.searchanalytics.query({
                siteUrl: gscUrl,
                requestBody: {
                  startDate: startStr,
                  endDate: endStr,
                  dimensions: ['date'],
                  rowLimit: 5,
                },
              });

              const rowCount = testResponse.data.rows?.length || 0;

              results.push({
                step: '7. Datenabfrage Test',
                status: rowCount > 0 ? 'ok' : 'warning',
                message: rowCount > 0 
                  ? `✅ ${rowCount} Datensätze abgerufen!`
                  : '⚠️ Keine Daten für diesen Zeitraum (evtl. keine Rankings)',
                details: {
                  dateRange: `${startStr} bis ${endStr}`,
                  rowsReturned: rowCount,
                  sampleData: testResponse.data.rows?.slice(0, 2)
                }
              });

            } catch (e: any) {
              results.push({
                step: '7. Datenabfrage Test',
                status: 'error',
                message: '❌ Fehler bei der Datenabfrage',
                details: {
                  error: e.message,
                  code: e.response?.status,
                  reason: e.response?.data?.error?.message,
                  possibleCauses: [
                    'Service Account hat keinen Zugriff',
                    'URL-Format stimmt nicht',
                    'Property existiert nicht',
                  ]
                }
              });
            }

            if (shouldRunGenAiDiagnosis) {
              const endDateParam = getDateParam(searchParams, 'endDate');
              const startDateParam = getDateParam(searchParams, 'startDate');
              const genAiEndDate = endDateParam
                ? new Date(`${endDateParam}T00:00:00Z`)
                : new Date();
              if (!endDateParam) genAiEndDate.setDate(genAiEndDate.getDate() - 2);
              const genAiStartDate = startDateParam
                ? new Date(`${startDateParam}T00:00:00Z`)
                : new Date(genAiEndDate);
              if (!startDateParam) genAiStartDate.setDate(genAiStartDate.getDate() - 27);

              const genAiStartStr = genAiStartDate.toISOString().split('T')[0];
              const genAiEndStr = genAiEndDate.toISOString().split('T')[0];

              try {
                const [appearanceResponse, topPagesResponse] = await Promise.all([
                  searchconsole.searchanalytics.query({
                    siteUrl: gscUrl,
                    requestBody: {
                      startDate: genAiStartStr,
                      endDate: genAiEndStr,
                      dimensions: ['searchAppearance'],
                      rowLimit: 25000,
                      type: 'web',
                    },
                  }),
                  searchconsole.searchanalytics.query({
                    siteUrl: gscUrl,
                    requestBody: {
                      startDate: genAiStartStr,
                      endDate: genAiEndStr,
                      dimensions: ['page'],
                      rowLimit: 20,
                      type: 'web',
                    },
                  }),
                ]);

                const appearanceRows = appearanceResponse.data.rows || [];
                const allAppearances = appearanceRows
                  .map((row) => row.keys?.[0])
                  .filter((value): value is string => typeof value === 'string' && value.length > 0);
                const detectedGenAiAppearances = Array.from(new Set(allAppearances.filter(isGenAiSearchAppearance)));
                const dateRowsByAppearance = await Promise.all(
                  detectedGenAiAppearances.map(async (appearance) => ({
                    appearance,
                    rows: await queryGscDimensionWithAppearanceFilter(
                      searchconsole,
                      gscUrl,
                      genAiStartStr,
                      genAiEndStr,
                      'date',
                      appearance,
                    ),
                  }))
                );
                const pageRowsByAppearance = await Promise.all(
                  detectedGenAiAppearances.map(async (appearance) => ({
                    appearance,
                    rows: await queryGscDimensionWithAppearanceFilter(
                      searchconsole,
                      gscUrl,
                      genAiStartStr,
                      genAiEndStr,
                      'page',
                      appearance,
                      100,
                    ),
                  }))
                );
                const genAiDateRows = dateRowsByAppearance.flatMap(({ appearance, rows }) =>
                  rows.map((row) => ({ ...row, appearance }))
                );
                const genAiPageRows = pageRowsByAppearance.flatMap(({ appearance, rows }) =>
                  rows.map((row) => ({ ...row, appearance }))
                );
                const genAiImpressionsFromDates = genAiDateRows.reduce((sum, row) => sum + (row.impressions || 0), 0);

                results.push({
                  step: '8. GenAI Performance Report / Search-Appearance',
                  status: detectedGenAiAppearances.length > 0 || genAiImpressionsFromDates > 0 ? 'ok' : 'warning',
                  message: detectedGenAiAppearances.length > 0 || genAiImpressionsFromDates > 0
                    ? `✅ GenAI-Daten per Search Analytics API erkannt (${genAiImpressionsFromDates.toLocaleString('de-DE')} Impr.)`
                    : '⚠️ Normale GSC-Daten sind abrufbar, aber die API liefert keine GenAI-Search-Appearance-Werte. Der neue GSC-Report kann in der UI sichtbar sein, ohne bereits per Search Analytics API verfügbar zu sein.',
                  details: {
                    dateRange: `${genAiStartStr} bis ${genAiEndStr}`,
                    testedProperty: gscUrl,
                    allSearchAppearances: allAppearances.map((value) => ({
                      raw: value,
                      normalized: normalizeSearchAppearance(value),
                      impressions: appearanceRows.find((row) => row.keys?.[0] === value)?.impressions || 0,
                    })),
                    detectedGenAiAppearances,
                    genAiDateRows: genAiDateRows.slice(0, 20),
                    genAiPageRows: genAiPageRows.slice(0, 20),
                    ordinaryTopPages: (topPagesResponse.data.rows || []).slice(0, 10),
                    rowCounts: {
                      searchAppearanceRows: appearanceRows.length,
                      genAiDateRows: genAiDateRows.length,
                      genAiPageRows: genAiPageRows.length,
                      ordinaryTopPageRows: topPagesResponse.data.rows?.length || 0,
                    },
                    interpretation: detectedGenAiAppearances.length > 0 || genAiImpressionsFromDates > 0
                      ? 'Dashboard sollte diese Werte anzeigen. Falls nicht, Cache/Datumsbereich prüfen.'
                      : 'Wahrscheinlich stellt Google den neuen GenAI-Report für diese Property aktuell nur in der Search-Console-Oberfläche beziehungsweise im Export bereit, nicht in der Search Analytics API.',
                  }
                });
              } catch (e: any) {
                results.push({
                  step: '8. GenAI Performance Report / Search-Appearance',
                  status: 'error',
                  message: '❌ GenAI-Diagnoseabfrage fehlgeschlagen',
                  details: {
                    dateRange: `${genAiStartStr} bis ${genAiEndStr}`,
                    error: e.message,
                    code: e.response?.status,
                    reason: e.response?.data?.error?.message,
                  }
                });
              }
            }
          }
        }
      }
    } else {
      results.push({
        step: '4-7. User-Test',
        status: 'warning',
        message: 'Kein userId angegeben - überspringe User-spezifische Tests',
        details: {
          hint: 'Füge ?userId=UUID zur URL hinzu für vollständige Diagnose'
        }
      });
    }

    // ==========================================
    // ZUSAMMENFASSUNG
    // ==========================================
    const hasErrors = results.some(r => r.status === 'error');
    const hasWarnings = results.some(r => r.status === 'warning');
    const hasAccessOrAuthErrors = results.some(r =>
      r.status === 'error' && !r.step.includes('GenAI')
    );

    return NextResponse.json({
      summary: {
        status: hasErrors ? 'FEHLER GEFUNDEN' : hasWarnings ? 'WARNUNGEN' : 'ALLES OK',
        errorCount: results.filter(r => r.status === 'error').length,
        warningCount: results.filter(r => r.status === 'warning').length,
        serviceAccountEmail: serviceEmail,
      },
      results,
      quickFix: hasAccessOrAuthErrors ? `
        === SCHNELLE LÖSUNG ===
        
        1. Service Account berechtigen:
           - Öffne: https://search.google.com/search-console
           - Wähle die gewünschte Property
           - Gehe zu: Einstellungen > Nutzer und Berechtigungen
           - Klicke "Nutzer hinzufügen"
           - Trage ein: ${serviceEmail}
           - Wähle: "Volle" Berechtigung
           - Speichern
        
        2. Warte 5-10 Minuten
        
        3. Rufe diese Diagnose erneut auf
      ` : null
    });

  } catch (error: any) {
    return NextResponse.json({
      summary: { status: 'KRITISCHER FEHLER' },
      results,
      error: {
        message: error.message,
        stack: error.stack
      }
    }, { status: 500 });
  }
}
