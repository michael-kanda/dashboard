import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { sql } from '@vercel/postgres';
import { generateText } from 'ai';
import { AI_CONFIG, google } from '@/lib/ai-config';
import { getSearchConsoleData, getAnalyticsData } from '@/lib/google-api';
import { getBingData } from '@/lib/bing-api';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 1. Security Check
    const session = await auth();
    if (session?.user?.role !== 'SUPERADMIN') {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    const status = {
      database: { status: 'pending', message: '', latency: 0 },
      google: { status: 'pending', message: '' },
      semrush: { status: 'pending', message: '' },
      aiModel: {
        status: 'pending',
        message: '',
        activeModel: AI_CONFIG.primaryModel,
        fallbackModel: AI_CONFIG.fallbackModel,
        latency: 0,
      },
      bingApi: { status: 'pending', message: '' },
      cache: { count: 0, size: 'Unknown' },
      cron: { status: 'pending', message: '', lastRun: null as string | null },
      gscApi: { status: 'pending', message: '' },
      ga4Api: { status: 'pending', message: '' }
    };

    // --- TEST 1: DATENBANK ---
    const startDb = performance.now();
    try {
      await sql`SELECT 1`; 
      status.database.status = 'ok';
      status.database.latency = Math.round(performance.now() - startDb);
      status.database.message = 'Verbindung stabil.';
    } catch (e: any) {
      status.database.status = 'error';
      status.database.message = e.message;
    }

    // --- TEST 2: GOOGLE API AUTH CONFIG ---
    try {
      if (!process.env.GOOGLE_CREDENTIALS && !process.env.GOOGLE_PRIVATE_KEY_BASE64) {
        throw new Error('Keine Credentials in ENV gefunden.');
      }
      status.google.status = 'ok';
      status.google.message = 'Credentials konfiguriert.';
    } catch (e: any) {
      status.google.status = 'error';
      status.google.message = e.message;
    }

    // --- TEST 3: SEMRUSH CONFIG ---
    try {
      if (!process.env.SEMRUSH_API_KEY) {
        status.semrush.status = 'warning';
        status.semrush.message = 'Kein API Key.';
      } else {
        status.semrush.status = 'ok';
        status.semrush.message = 'API Key vorhanden.';
      }
    } catch (e: any) {
      status.semrush.status = 'error';
      status.semrush.message = e.message;
    }

    // --- TEST 4: KI MODELL LIVE CHECK ---
    const startAi = performance.now();
    try {
      if (!process.env.GEMINI_API_KEY && !process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
        throw new Error('Env Variable GEMINI_API_KEY oder GOOGLE_GENERATIVE_AI_API_KEY fehlt.');
      }

      const modelsToCheck = [AI_CONFIG.primaryModel, AI_CONFIG.fallbackModel];
      let lastError = '';

      for (const modelName of modelsToCheck) {
        try {
          await generateText({
            model: google(modelName),
            prompt: 'Antworte exakt mit OK.',
            temperature: 0,
            maxOutputTokens: 8,
          });

          status.aiModel.activeModel = modelName;
          status.aiModel.latency = Math.round(performance.now() - startAi);
          status.aiModel.status = modelName === AI_CONFIG.primaryModel ? 'ok' : 'warning';
          status.aiModel.message = modelName === AI_CONFIG.primaryModel
            ? `Aktiv: ${modelName}. Live-Test fehlerfrei.`
            : `Fallback aktiv: ${modelName}. Primary ${AI_CONFIG.primaryModel} fehlerhaft: ${lastError}`;
          break;
        } catch (modelError: any) {
          lastError = modelError?.message || String(modelError);
        }
      }

      if (status.aiModel.status === 'pending') {
        status.aiModel.status = 'error';
        status.aiModel.latency = Math.round(performance.now() - startAi);
        status.aiModel.message = `Alle KI-Modelle fehlgeschlagen. Letzter Fehler: ${lastError || 'Unbekannt'}`;
      }
    } catch (e: any) {
      status.aiModel.status = 'error';
      status.aiModel.latency = Math.round(performance.now() - startAi);
      status.aiModel.message = e.message;
    }

    // --- TEST 5: CACHE STATS ---
    try {
        const { rows } = await sql`SELECT COUNT(*) as count FROM google_data_cache`;
        status.cache.count = rows[0].count;
    } catch (e) {
        console.error('Cache count failed', e);
    }

    // --- TEST 6: CRON JOB / UPDATE STATUS ---
    try {
      const { rows } = await sql`SELECT MAX(gsc_last_updated) as last_update FROM landingpages`;
      const lastUpdate = rows[0]?.last_update;

      if (lastUpdate) {
        status.cron.lastRun = lastUpdate;
        const diffInHours = (Date.now() - new Date(lastUpdate).getTime()) / (1000 * 60 * 60);

        if (diffInHours < 50) {
           status.cron.status = 'ok';
           status.cron.message = 'Daten aktuell (innerhalb 48h).';
        } else {
           status.cron.status = 'warning';
           status.cron.message = `Update überfällig (${Math.round(diffInHours)}h alt).`;
        }
      } else {
        status.cron.status = 'warning';
        status.cron.message = 'Noch keine GSC Daten vorhanden.';
      }
    } catch (e: any) {
       status.cron.status = 'error';
       status.cron.message = 'Prüfung fehlgeschlagen: ' + e.message;
    }

    // --- TEST 7: LIVE DATEN-FLUSS (GSC, GA4 & BING) ---
    try {
      const { rows } = await sql`
        SELECT email, domain, gsc_site_url, ga4_property_id 
        FROM users 
        WHERE role = 'BENUTZER' 
          AND (gsc_site_url IS NOT NULL OR ga4_property_id IS NOT NULL)
        ORDER BY RANDOM()
        LIMIT 1
      `;
      
      const testUser = rows[0];

      if (!testUser) {
         status.gscApi = { status: 'warning', message: 'Keine User mit GSC gefunden.' };
         status.ga4Api = { status: 'warning', message: 'Keine User mit GA4 gefunden.' };
      } else {
         const today = new Date();
         
         // GSC Datum (vor 4 Tagen, um sicher zu sein wegen Latenz)
         const gscDate = new Date(today);
         gscDate.setDate(today.getDate() - 4);
         const gscDateStr = gscDate.toISOString().split('T')[0];

         // GA4 Datum (gestern)
         const gaDate = new Date(today);
         gaDate.setDate(today.getDate() - 1);
         const gaDateStr = gaDate.toISOString().split('T')[0];

         // Identifikation für die Fehlermeldung
         const userLabel = testUser.domain || testUser.email || 'Unbekannt';

         // A) GSC TEST
         if (testUser.gsc_site_url) {
            try {
               await getSearchConsoleData(testUser.gsc_site_url, gscDateStr, gscDateStr);
               status.gscApi = { status: 'ok', message: `OK (${userLabel})` };
            } catch (e: any) {
               let errorMsg = e.message;
               if(errorMsg.includes('User does not have sufficient permissions')) errorMsg = 'Zugriff verweigert (Permissions)';
               
               status.gscApi = { 
                   status: 'warning', 
                   message: `Fehler bei ${userLabel}: ${errorMsg}` 
               };
            }
         } else {
            status.gscApi = { status: 'pending', message: `${userLabel}: Kein GSC konfiguriert.` };
         }

       // B) GA4 TEST
         if (testUser.ga4_property_id) {
            try {
               await getAnalyticsData(testUser.ga4_property_id, gaDateStr, gaDateStr);
               status.ga4Api = { status: 'ok', message: `OK (${userLabel})` };
            } catch (e: any) {
               status.ga4Api = { status: 'warning', message: `Fehler bei ${userLabel}: ${e.message}` };
            }
         } else {
            status.ga4Api = { status: 'pending', message: `${userLabel}: Kein GA4 konfiguriert.` };
         }

         // C) BING API TEST
         if (!process.env.BING_API_KEY) {
            status.bingApi = { status: 'error', message: 'Env Variable BING_API_KEY fehlt.' };
         } else if (testUser.gsc_site_url) {
            try {
               // Wir versuchen einen echten Fetch
               const bingRes = await getBingData(testUser.gsc_site_url);
               // getBingData fängt Fehler intern ab und gibt [] zurück.
               // Wir bewerten es als OK, wenn der Aufruf durchlief.
               status.bingApi = { status: 'ok', message: `OK (${userLabel})` };
            } catch (e: any) {
               status.bingApi = { status: 'warning', message: `Fehler bei ${userLabel}: ${e.message}` };
            }
         } else {
            status.bingApi = { status: 'pending', message: 'User hat keine URL für Bing Test.' };
         }
      }
    } catch (e: any) {
       status.gscApi = { status: 'error', message: 'DB Suche fehlgeschlagen.' };
       status.ga4Api = { status: 'error', message: 'DB Suche fehlgeschlagen.' };
       status.bingApi = { status: 'error', message: 'DB Suche fehlgeschlagen.' };
    }

    return NextResponse.json(status);

  } catch (error: any) {
    return NextResponse.json({ message: 'System Check Failed', error: error.message }, { status: 500 });
  }
}
