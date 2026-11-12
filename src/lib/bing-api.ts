// src/lib/bing-api.ts
import axios from 'axios';
import { requestBudgetOptions } from './sync/request-budget';
import { logger } from '@/lib/logger';

const BING_API_BASE = 'https://ssl.bing.com/webmaster/api.svc/json';

export interface BingKeywordData {
  query: string;
  impressions: number;
  clicks: number;
  position: number;
  ctr?: number;
}

export async function getBingData(
  siteUrl: string,
  _startDate?: string,
  _endDate?: string
): Promise<BingKeywordData[]> {
  const apiKey = process.env.BING_API_KEY;

  if (!apiKey) {
    console.warn('[BING] API Key fehlt in Environment Variables');
    return [];
  }

  try {
    const cleanUrl = siteUrl.replace(/\/$/, "");
    
    logger.debug('[BING] Fetching data for:', cleanUrl);

    const response = await axios.get(`${BING_API_BASE}/GetQueryStats`, {
      ...requestBudgetOptions(),
      params: {
        apikey: apiKey,
        siteUrl: cleanUrl,
      },
      timeout: 10000
    });
    
    logger.debug('[BING] Response status:', response.status);

    let keywords: BingKeywordData[] = [];

    if (response.data && response.data.d) {
      keywords = response.data.d.map((entry: any) => ({
        query: entry.Query || entry.query || '',
        impressions: entry.Impressions || entry.impressions || 0,
        clicks: entry.Clicks || entry.clicks || 0,
        position: entry.AvgImpressionPosition || entry.Position || entry.position || 0,
      }));
    } else if (Array.isArray(response.data)) {
      keywords = response.data.map((entry: any) => ({
        query: entry.Query || entry.query || '',
        impressions: entry.Impressions || entry.impressions || 0,
        clicks: entry.Clicks || entry.clicks || 0,
        position: entry.AvgImpressionPosition || entry.Position || entry.position || 0,
      }));
    }

    logger.debug(`[BING] ${keywords.length} Keywords geladen`);
    return keywords;

  } catch (error: any) {
    if (error.response) {
      console.error('[BING] API Error:', error.response.status, error.response.data);
    } else {
      console.error('[BING] Request Error:', error.message);
    }
    return [];
  }
}
