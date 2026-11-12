// src/lib/ai-chat/fallback.ts
// Vorgeschlagene Fragen des DataMax-Chats inkl. Fallback-Fragen

import type { ProjectDashboardData } from '@/lib/dashboard-shared';
import type { AiTrafficDetailData } from '@/types/ai-traffic-detail';

// ============================================================================
// SUGGESTED QUESTIONS GENERATOR (Erweitert)
// ============================================================================

export function generateSuggestedQuestions(data: ProjectDashboardData, aiTrafficDetail?: AiTrafficDetailData | null, hasHolidays?: boolean): string[] {
  const questions: string[] = [];
  const kpis = data.kpis;

  // Basierend auf Daten-Anomalien
  if (kpis) {
    if (kpis.conversions?.change && kpis.conversions.change < -10) {
      questions.push('Warum sind meine Conversions gesunken?');
    }
    if (kpis.clicks?.change && kpis.clicks.change > 20) {
      questions.push('Was hat den Klick-Anstieg verursacht?');
    }
  }
  
  // ✅ NEU: KI-Traffic spezifische Fragen
  if (aiTrafficDetail && aiTrafficDetail.totalSessions > 50) {
    questions.push('Welche Seiten werden von KI-Systemen empfohlen?');
    
    if (aiTrafficDetail.conversions > 0) {
      questions.push('Wie viele Conversions kommen durch KI-Traffic?');
    }
    
    if (aiTrafficDetail.sources?.length > 1) {
      questions.push('Welche KI-Plattform bringt den besten Traffic?');
    }
  } else if (data.aiTraffic && data.aiTraffic.totalSessions > 50) {
    questions.push('Erklaere meinen KI-Traffic genauer');
  }
  
  if (data.topQueries?.some(q => q.position >= 4 && q.position <= 10)) {
    questions.push('Welche Keywords sollte ich priorisieren?');
  }

  // ✅ NEU: Google Ads / SEA Fragen
  if (data.googleAdsData && data.googleAdsData.rows.length > 0) {
    const adTotals = data.googleAdsData.totals;
    if (adTotals.clicks > 0) {
      questions.push('Wie performen meine Google Ads Kampagnen?');
    }
    if (adTotals.conversions > 0 && adTotals.clicks > 0) {
      questions.push('Welche Anzeigengruppen haben die besten Conversions?');
    }
  }

  if (data.localSeo?.locations?.length) {
    questions.push('Wie performen meine Standorte lokal?');
    questions.push('Welche lokale Landingpage sollte optimiert werden?');
  }

  // ✅ NEU: Wetter- & Feiertags-Fragen
  if (data.weatherData && Object.keys(data.weatherData).length > 0) {
    questions.push('Hat das Wetter meinen Traffic beeinflusst?');
  }
  if (hasHolidays) {
    questions.push('Wie haben Feiertage meinen Traffic beeinflusst?');
  }

  // Fallback-Fragen
  if (questions.length < 3) {
    questions.push('Wie kann ich meine Conversion-Rate verbessern?');
    questions.push('Was sind meine groessten SEO-Chancen?');
    questions.push('Gib mir 3 konkrete Empfehlungen');
  }

  return questions.slice(0, 4);
}
