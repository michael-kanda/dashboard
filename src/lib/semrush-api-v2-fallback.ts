// src/lib/semrush-api-v2-fallback.ts - ALTERNATIVE MIT V2 API
import axios from 'axios';
import { logger } from '@/lib/logger';

const apiKey = process.env.SEMRUSH_API_KEY;

interface ProcessedKeyword {
  keyword: string;
  position: number;
  previousPosition: number | null;
  searchVolume: number;
  url: string;
  trafficPercent: number;
}

/**
 * FALLBACK: Nutzt die älteren Semrush v2 API Endpoints
 */
export async function getSemrushKeywordsV2Fallback(
  domain: string,
  database: string = 'de'
): Promise<{ keywords: ProcessedKeyword[]; error: null | string }> {
  
  if (!apiKey) {
    console.error('[Semrush-v2] SEMRUSH_API_KEY is not set');
    return { keywords: [], error: 'Semrush API key is missing' };
  }

  if (!domain) {
    console.error('[Semrush-v2] No domain provided');
    return { keywords: [], error: 'No domain provided' };
  }

  let normalizedDomain = String(domain);
  if (normalizedDomain.startsWith('www.')) {
    normalizedDomain = normalizedDomain.substring(4);
  }
  if (normalizedDomain.startsWith('https://')) {
    normalizedDomain = normalizedDomain.substring(8);
  } else if (normalizedDomain.startsWith('http://')) {
    normalizedDomain = normalizedDomain.substring(7);
  }

  logger.debug('[Semrush-v2] Using fallback v2 API for domain:', normalizedDomain);

  const rankParams: Record<string, string> = {
    key: apiKey,
    type: 'rank',
    domain: normalizedDomain,
    database: database,
    limit: '50'
  };

  try {
    logger.debug('[Semrush-v2] Fetching rank data from v2 API');
    
    const queryString = new URLSearchParams(rankParams).toString();
    
    const response = await axios.get(
      `https://www.semrush.com/api/v2/?${queryString}`,
      {
        timeout: 15000,
        headers: {
          'Accept': 'text/plain'
        }
      }
    );

    const lines = response.data.split('\n').filter((line: string) => line.trim());
    
    if (lines.length === 0 || lines[0].includes('No data')) {
      console.warn('[Semrush-v2] No rank data found');
      return { keywords: [], error: 'No keywords found' };
    }

    logger.debug('[Semrush-v2] ✅ Got', lines.length, 'rank results');

    const keywords: ProcessedKeyword[] = [];
    
    for (const line of lines) {
      if (line.startsWith('|') || line.includes('No data') || line.trim() === '') {
        continue;
      }

      const parts = line.split('|');
      if (parts.length < 3) continue;

      const keyword = parts[0].trim();
      const position = parseInt(parts[1].trim(), 10);
      const searchVolume = parseInt(parts[2].trim(), 10);

      if (!keyword || isNaN(position) || position === 0 || position > 100) {
        continue;
      }

      keywords.push({
        keyword,
        position,
        previousPosition: null,
        searchVolume: searchVolume || 0,
        url: '',
        trafficPercent: 0
      });
    }

    keywords.sort((a, b) => a.position - b.position);
    const top20 = keywords.slice(0, 20);

    logger.debug('[Semrush-v2] ✅ Processed', top20.length, 'keywords');
    return { keywords: top20, error: null };

  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      console.error('[Semrush-v2] Error status:', error.response?.status);
      console.error('[Semrush-v2] Error data:', error.response?.data);
    } else {
      console.error('[Semrush-v2] Error:', error);
    }
    return { keywords: [], error: String(error) };
  }
}

/**
 * Erweiterte v2 API: Holt zusätzliche Metriken
 */
export async function getSemrushKeywordsV2Extended(
  domain: string,
  database: string = 'de'
): Promise<{ keywords: ProcessedKeyword[]; error: null | string }> {
  
  if (!apiKey) {
    console.error('[Semrush-v2-ext] SEMRUSH_API_KEY is not set');
    return { keywords: [], error: 'Semrush API key is missing' };
  }

  let normalizedDomain = String(domain);
  if (normalizedDomain.startsWith('www.')) {
    normalizedDomain = normalizedDomain.substring(4);
  }

  logger.debug('[Semrush-v2-ext] Extended v2 API query for:', normalizedDomain);

  try {
    const rankParams: Record<string, string> = {
      key: apiKey,
      type: 'rank',
      domain: normalizedDomain,
      database: database,
      limit: '50'
    };

    const rankResponse = await axios.get(
      `https://www.semrush.com/api/v2/?${new URLSearchParams(rankParams).toString()}`,
      { timeout: 15000 }
    );

    const volumeParams: Record<string, string> = {
      key: apiKey,
      type: 'phrase_volume',
      phrase: '*',
      database: database
    };

    let volumeMap: Record<string, number> = {};
    try {
      const volumeResponse = await axios.get(
        `https://www.semrush.com/api/v2/?${new URLSearchParams(volumeParams).toString()}`,
        { timeout: 15000 }
      );
      
      volumeMap = volumeResponse.data.split('\n').reduce((acc: Record<string, number>, line: string) => {
        const [phrase, volume] = line.split('|');
        if (phrase && volume) {
          acc[phrase.trim()] = parseInt(volume.trim(), 10);
        }
        return acc;
      }, {});
    } catch (error: unknown) {
      console.warn('[Semrush-v2-ext] Could not fetch volume data:', error instanceof Error ? error.message : error);
    }

    const keywords: ProcessedKeyword[] = [];
    rankResponse.data.split('\n').forEach((line: string) => {
      const parts = line.split('|');
      if (parts.length < 3) return;

      const keyword = parts[0].trim();
      const position = parseInt(parts[1].trim(), 10);
      
      if (!keyword || isNaN(position) || position === 0 || position > 100) {
        return;
      }

      keywords.push({
        keyword,
        position,
        previousPosition: null,
        searchVolume: volumeMap[keyword] || 0,
        url: '',
        trafficPercent: 0
      });
    });

    keywords.sort((a, b) => a.position - b.position);
    return { keywords: keywords.slice(0, 20), error: null };

  } catch (error: unknown) {
    console.error('[Semrush-v2-ext] Error:', error instanceof Error ? error.message : error);
    return { keywords: [], error: String(error) };
  }
}
