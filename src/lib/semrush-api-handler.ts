// src/lib/semrush-api-handler.ts - COMPLETE HANDLER MIT AUTOMATISCHEM FALLBACK
import { getSemrushKeywords } from './semrush-api';
import { getSemrushKeywordsV2Fallback, getSemrushKeywordsV2Extended } from './semrush-api-v2-fallback';

interface CampaignData {
  campaignId: string;
  domain: string;
  projectId?: string;
  trackingId?: string;
  userId?: string;
}

interface SemrushHandlerResult {
  source: 'v1-api' | 'v2-api' | 'v2-extended-api' | 'failed';
  keywords: Array<{
    keyword: string;
    position: number;
    previousPosition: number | null;
    searchVolume: number;
    url: string;
    trafficPercent: number;
  }>;
  error: string | null;
  attemptCount?: number;
  timing?: {
    v1Ms?: number;
    v2Ms?: number;
    v2ExtMs?: number;
    totalMs?: number;
  };
}

/**
 * 🎯 HAUPTFUNKTION - Semrush API mit automatischem Fallback
 */
export async function getSemrushKeywordsWithFallback(
  data: CampaignData
): Promise<SemrushHandlerResult> {
  const { campaignId, domain } = data;
  
  const totalStartTime = Date.now();
  
  console.log('\n========== SEMRUSH HANDLER START ==========');
  console.log('[Handler] Campaign ID:', campaignId);
  console.log('[Handler] Domain:', domain);
  console.log('[Handler] Attempting: v1 → v2-simple → v2-extended');

  const timing = {
    v1Ms: 0,
    v2Ms: 0,
    v2ExtMs: 0,
    totalMs: 0
  };

  // ========== SCHRITT 1: v1 API mit 5 Strategien ==========
  try {
    console.log('\n[Handler] ATTEMPT 1/3: v1 API (5 strategies)');
    const v1StartTime = Date.now();
    
    const v1Result = await getSemrushKeywords(campaignId, domain);
    timing.v1Ms = Date.now() - v1StartTime;
    
    if (v1Result.keywords && v1Result.keywords.length > 0) {
      timing.totalMs = Date.now() - totalStartTime;
      console.log(`[Handler] ✅ SUCCESS! v1 API worked in ${timing.v1Ms}ms`);
      console.log('[Handler] Got', v1Result.keywords.length, 'keywords');
      console.log('========== SEMRUSH HANDLER END ==========\n');
      
      return {
        source: 'v1-api',
        keywords: v1Result.keywords,
        error: null,
        attemptCount: 1,
        timing
      };
    }
    
    console.log('[Handler] ⚠️ v1 returned no keywords');
    console.log('[Handler] Error:', v1Result.error);
  } catch (error: unknown) {
    console.error('[Handler] ❌ v1 threw error:', error instanceof Error ? error.message : error);
  }

  // ========== SCHRITT 2: v2 API einfach ==========
  try {
    console.log('\n[Handler] ATTEMPT 2/3: v2 API (simple)');
    const v2StartTime = Date.now();
    
    const v2Result = await getSemrushKeywordsV2Fallback(domain);
    timing.v2Ms = Date.now() - v2StartTime;
    
    if (v2Result.keywords && v2Result.keywords.length > 0) {
      timing.totalMs = Date.now() - totalStartTime;
      console.log(`[Handler] ✅ SUCCESS! v2-simple worked in ${timing.v2Ms}ms`);
      console.log('[Handler] Got', v2Result.keywords.length, 'keywords');
      console.log('========== SEMRUSH HANDLER END ==========\n');
      
      return {
        source: 'v2-api',
        keywords: v2Result.keywords,
        error: null,
        attemptCount: 2,
        timing
      };
    }
    
    console.log('[Handler] ⚠️ v2-simple returned no keywords');
    console.log('[Handler] Error:', v2Result.error);
  } catch (error: unknown) {
    console.error('[Handler] ❌ v2-simple threw error:', error instanceof Error ? error.message : error);
  }

  // ========== SCHRITT 3: v2 API erweitert ==========
  try {
    console.log('\n[Handler] ATTEMPT 3/3: v2 API (extended)');
    const v2ExtStartTime = Date.now();
    
    const v2ExtResult = await getSemrushKeywordsV2Extended(domain);
    timing.v2ExtMs = Date.now() - v2ExtStartTime;
    
    if (v2ExtResult.keywords && v2ExtResult.keywords.length > 0) {
      timing.totalMs = Date.now() - totalStartTime;
      console.log(`[Handler] ✅ SUCCESS! v2-extended worked in ${timing.v2ExtMs}ms`);
      console.log('[Handler] Got', v2ExtResult.keywords.length, 'keywords');
      console.log('========== SEMRUSH HANDLER END ==========\n');
      
      return {
        source: 'v2-extended-api',
        keywords: v2ExtResult.keywords,
        error: null,
        attemptCount: 3,
        timing
      };
    }
    
    console.log('[Handler] ⚠️ v2-extended returned no keywords');
    console.log('[Handler] Error:', v2ExtResult.error);
  } catch (error: unknown) {
    console.error('[Handler] ❌ v2-extended threw error:', error instanceof Error ? error.message : error);
  }

  // ========== ALLE VERSUCHE FEHLGESCHLAGEN ==========
  timing.totalMs = Date.now() - totalStartTime;
  console.error('\n[Handler] ❌ ALL ATTEMPTS FAILED!');
  console.error('[Handler] Timings:', timing);
  console.log('========== SEMRUSH HANDLER END ==========\n');
  
  return {
    source: 'failed',
    keywords: [],
    error: 'Could not fetch keywords from any API version (tried: v1, v2-simple, v2-extended)',
    attemptCount: 3,
    timing
  };
}
