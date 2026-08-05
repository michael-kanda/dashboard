export const LOCAL_VISIBILITY_INFO_TEXT = '• Lokale Sichtbarkeit: GA4 und GSC verwenden unterschiedliche Zuordnungen. Sind Standort-Landingpages hinterlegt, stammen neue Besucher, Sessions und Conversions aus diesen Seiten; ohne hinterlegte Standort-Landingpage nutzt das Widget die von GA4 erkannte Stadt des Besuchers. GSC-Klicks und -Impressionen werden separat über konfigurierte Standort-Landingpages sowie lokale Keywords/Aliase zugeordnet. Deshalb können für einen Standort GA4-Besucher vorhanden sein, obwohl GSC dort 0 Klicks oder Impressionen ausweist.';

export const DEFAULT_DASHBOARD_INFO_TEXT = `• GSC & Google Ads (SERP-Daten): Messen Impressionen und Klicks direkt auf der Google-Suchseite. Diese Daten sind cookie-unabhängig und werden auch bei Cookie-Ablehnung oder im Inkognito-Modus erfasst. GSC filtert dabei seltene Suchanfragen aus Datenschutzgründen heraus (im Schnitt ca. 47 % der Queries). Hinweis: Conversion-Tracking auf der Website ist hingegen consent-pflichtig.
• Google GenAI-Sichtbarkeit: Misst offizielle Search-Console-Impressions in generativen Google-Sucherlebnissen wie AI Overviews und AI Mode, sofern die Property bereits im Rollout ist und genug Daten vorhanden sind. Diese Werte zeigen Sichtbarkeit in Google-GenAI, nicht Website-Besuche.
• Google Analytics (GA4): Misst das Nutzerverhalten direkt auf der Website. Erfassung ist cookie-abhängig und erfordert in der EU eine Einwilligung (DSGVO/TTDSG). Mit Consent Mode v2 sind teilweise modellierte Daten verfügbar.
${LOCAL_VISIBILITY_INFO_TEXT}
• KI-Traffic (GA4): Misst Website-Besuche über das offizielle GA4-Medium „ai-assistant“ und ergänzt erkannte KI-Referrer wie ChatGPT, Perplexity, Gemini, Copilot, Claude, DeepSeek oder Grok. Google AI Overviews und AI Mode zählen in GA4 weiterhin zu Organic Search.
• Prompt Tracking / Prompt Research: Nutzt GSC-Queries und KI-generierte Decision-Prompts als Research- und Optimierungsinstrument. Es ist ein AI-Mode-Proxy bzw. Testverfahren, aber kein offizieller Sichtbarkeitswert von Google.`;

export function resolveDashboardInfoText(value?: string | null) {
  const text = value?.trim() || DEFAULT_DASHBOARD_INFO_TEXT;
  return text.includes('• Lokale Sichtbarkeit:')
    ? text
    : `${text}\n${LOCAL_VISIBILITY_INFO_TEXT}`;
}
