// src/app/api/semrush/keywords/route.ts (DEBUG VERSION - Findet Cache-Problem)
import { NextResponse, NextRequest } from 'next/server';
import { auth } from '@/lib/auth'; // KORRIGIERT: Import von auth
import { canAccessProject } from '@/lib/project-access';
import { sql } from '@vercel/postgres';
import { getSemrushKeywordsWithFallback } from '@/lib/semrush-api-handler';
import { logger } from '@/lib/logger';

interface UserRow {
  id: string;
  domain: string | null;
  semrush_project_id: string | null;
  semrush_tracking_id: string | null;
  semrush_tracking_id_02: string | null;
}

interface CacheRow {
  keywords_data: unknown;
  last_fetched: string;
}

export async function GET(request: NextRequest) {
  const debugLog = (msg: string, data?: unknown) => {
    logger.debug(`[API Keywords Debug] ${msg}`, data ? JSON.stringify(data, null, 2) : '');
  };

  try {
    const session = await auth(); // KORRIGIERT: auth() aufgerufen

    if (!session?.user?.email) {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    const { role, id: adminOrUserId } = session.user;
    const { searchParams } = new URL(request.url);
    
    const campaign = searchParams.get('campaign') || 'kampagne_1'; 
    const forceRefresh = searchParams.get('forceRefresh') === 'true'
      && (role === 'ADMIN' || role === 'SUPERADMIN');
    const projectIdParam = searchParams.get('projectId');
    let targetUserId: string;

    if (projectIdParam && (role === 'ADMIN' || role === 'SUPERADMIN')) {
      if (!(await canAccessProject(session.user, projectIdParam))) {
        return NextResponse.json({ message: 'Zugriff verweigert' }, { status: 403 });
      }
      targetUserId = projectIdParam;
      debugLog(`Admin ${adminOrUserId} accessing user ${targetUserId}`);
    } else {
      targetUserId = adminOrUserId;
      debugLog(`User ${targetUserId} accessing own data`);
    }

    debugLog('Request params', { campaign, forceRefresh, targetUserId });

    // User daten laden
    const { rows } = await sql<UserRow>`
      SELECT 
        id,
        domain, 
        semrush_project_id, 
        semrush_tracking_id,
        semrush_tracking_id_02 
      FROM users 
      WHERE id::text = ${targetUserId} 
    `;

    if (!rows || rows.length === 0) {
      return NextResponse.json({ keywords: [], error: 'User not found' }, { status: 404 });
    }

    const userData = rows[0];

    if (!userData.domain) {
      return NextResponse.json({ keywords: [], error: 'Domain not configured' });
    }
    
    const projectId = userData.semrush_project_id;
    let trackingId: string | null = null;
    
    if (campaign === 'kampagne_2') {
      trackingId = userData.semrush_tracking_id_02;
    } else {
      trackingId = userData.semrush_tracking_id;
    }

    if (!projectId || !trackingId) {
      const errorMsg = `Semrush config incomplete for ${campaign}`;
      debugLog(errorMsg, { projectId, trackingId });
      return NextResponse.json({
        keywords: [],
        error: errorMsg,
        keywordsCount: 0
      }, { status: 400 });
    }
    
    const campaignId = `${projectId}_${trackingId}`;
    const domain = userData.domain;

    debugLog('Semrush config', { domain, campaignId, campaign });
    
    // ============================================
    // 🔍 KRITISCHER PUNKT: Cache Check
    // ============================================
    
    debugLog('🔍 Checking cache...', { targetUserId, campaign });
    
    let cachedData: CacheRow[] = [];
    try {
      const cacheResult = await sql<CacheRow>`
        SELECT keywords_data, last_fetched 
        FROM semrush_keywords_cache 
        WHERE user_id::text = ${targetUserId} AND campaign = ${campaign}
      `;
      cachedData = cacheResult.rows;
      
      debugLog('📦 Cache query executed', {
        rowsFound: cachedData.length,
        hasData: cachedData.length > 0,
        firstRow: cachedData[0] ? {
          lastFetched: cachedData[0].last_fetched,
          dataType: typeof cachedData[0].keywords_data,
          isArray: Array.isArray(cachedData[0].keywords_data),
          itemCount: Array.isArray(cachedData[0].keywords_data) 
            ? cachedData[0].keywords_data.length 
            : 'N/A'
        } : null
      });
    } catch (cacheError) {
      debugLog('❌ Cache query error', {
        error: 'Interner Fehler',
        stack: cacheError instanceof Error ? cacheError.stack : undefined
      });
      // Weiter ohne Cache
    }

    if (!forceRefresh && cachedData && cachedData.length > 0) {
      const cachedLastFetched = cachedData[0].last_fetched;
      const lastFetchedDate = new Date(cachedLastFetched);
      const now = new Date();
      const ageMs = now.getTime() - lastFetchedDate.getTime();
      const ageDays = ageMs / (1000 * 60 * 60 * 24);
      const ageHours = ageMs / (1000 * 60 * 60);

      debugLog('⏰ Cache age check', {
        cachedLastFetched,
        now: now.toISOString(),
        ageMs,
        ageHours: ageHours.toFixed(2),
        ageDays: ageDays.toFixed(2),
        isValid: ageDays < 14,
        willUseCache: ageDays < 14
      });

      if (ageDays < 14) {
        debugLog('✅ USING CACHE', {
          age: `${Math.floor(ageDays)} days, ${Math.floor(ageHours)} hours`,
          timestamp: cachedLastFetched
        });
        
        return NextResponse.json({
          keywords: cachedData[0].keywords_data || [],
          lastFetched: cachedLastFetched,
          fromCache: true,
          keywordsCount: Array.isArray(cachedData[0].keywords_data) 
            ? cachedData[0].keywords_data.length 
            : 0
        });
      } else {
        debugLog('⏰ Cache expired', { ageDays: ageDays.toFixed(2) });
      }
    } else {
      debugLog('ℹ️ Cache not available', {
        forceRefresh,
        hasCachedData: cachedData && cachedData.length > 0,
        reason: forceRefresh 
          ? 'Force refresh requested' 
          : cachedData.length === 0 
            ? 'No cache entries found' 
            : 'Unknown'
      });
    }

    // ============================================
    // 🔄 FETCHING FROM API
    // ============================================
    
    debugLog('🔄 Fetching from Semrush API...');
    const result = await getSemrushKeywordsWithFallback({
      campaignId: campaignId,
      domain: domain,
      userId: targetUserId
    });

    if (!result || result.keywords.length === 0) {
      debugLog('❌ API fetch failed', { error: result?.error });
      return NextResponse.json({
        keywords: [],
        error: result?.error || 'Failed to fetch keywords',
        keywordsCount: 0
      });
    }

    debugLog('✅ API fetch successful', { 
      keywordCount: result.keywords.length 
    });

    // ============================================
    // 💾 SAVING TO CACHE
    // ============================================
    
    const now = new Date().toISOString();
    try {
      debugLog('💾 Saving to cache...', { 
        targetUserId, 
        campaign, 
        keywordCount: result.keywords.length,
        timestamp: now 
      });

      await sql`
        INSERT INTO semrush_keywords_cache (user_id, campaign, keywords_data, last_fetched)
        VALUES (
          ${targetUserId}::uuid, 
          ${campaign}, 
          ${JSON.stringify(result.keywords)}::jsonb, 
          ${now}
        )
        ON CONFLICT (user_id, campaign)
        DO UPDATE SET 
          keywords_data = ${JSON.stringify(result.keywords)}::jsonb,
          last_fetched = ${now}
      `;
      
      debugLog('✅ Cache saved successfully');
      
      // Verify cache was saved
      const verifyResult = await sql`
        SELECT last_fetched 
        FROM semrush_keywords_cache 
        WHERE user_id::text = ${targetUserId} AND campaign = ${campaign}
      `;
      
      debugLog('🔍 Cache verification', {
        saved: verifyResult.rows.length > 0,
        timestamp: verifyResult.rows[0]?.last_fetched
      });
      
    } catch (error) {
      debugLog('❌ Cache save error', {
        error: 'Interner Fehler',
        stack: error instanceof Error ? error.stack : undefined
      });
    }

    return NextResponse.json({
      keywords: result.keywords,
      lastFetched: now,
      fromCache: false,
      keywordsCount: result.keywords.length
    });

  } catch (error) {
    console.error('[API Keywords] ❌ Unexpected error:', error);
    return NextResponse.json({ 
      keywords: [],
      error: 'Unknown error',
      keywordsCount: 0
    }, { status: 500 });
  }
}
