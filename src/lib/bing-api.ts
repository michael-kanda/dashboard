// src/lib/bing-api.ts
import axios from 'axios';
import { requestBudgetOptions } from './sync/request-budget';
import { logger } from '@/lib/logger';
import { errorFields, getErrorMessage } from '@/lib/errors';

const BING_API_BASE = 'https://ssl.bing.com/webmaster/api.svc/json';

// Rohzeile aus GetQueryStats; die API liefert je nach Version Pascal- oder camelCase.
type BingQueryStatEntry = {
  Query?: string; query?: string;
  Impressions?: number; impressions?: number;
  Clicks?: number; clicks?: number;
  AvgImpressionPosition?: number; Position?: number; position?: number;
};

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
      keywords = response.data.d.map((entry: BingQueryStatEntry) => ({
        query: entry.Query || entry.query || '',
        impressions: entry.Impressions || entry.impressions || 0,
        clicks: entry.Clicks || entry.clicks || 0,
        position: entry.AvgImpressionPosition || entry.Position || entry.position || 0,
      }));
    } else if (Array.isArray(response.data)) {
      keywords = response.data.map((entry: BingQueryStatEntry) => ({
        query: entry.Query || entry.query || '',
        impressions: entry.Impressions || entry.impressions || 0,
        clicks: entry.Clicks || entry.clicks || 0,
        position: entry.AvgImpressionPosition || entry.Position || entry.position || 0,
      }));
    }

    logger.debug(`[BING] ${keywords.length} Keywords geladen`);
    return keywords;

  } catch (error: unknown) {
    const { response } = errorFields(error);
    if (response) {
      console.error('[BING] API Error:', response.status, response.data);
    } else {
      console.error('[BING] Request Error:', getErrorMessage(error));
    }
    return [];
  }
}
