// src/lib/ai-chat/date-range.ts
// Zeitraum-Helfer des DataMax-Chats

export type ChatDateRange = '30d' | '3m' | '6m' | '12m' | '18m' | '24m';

// ============================================================================
// HELPER: Datumsberechnung
// ============================================================================


export function normalizeDateRange(dateRange: string): ChatDateRange {
  return ['30d', '3m', '6m', '12m', '18m', '24m'].includes(dateRange)
    ? dateRange as ChatDateRange
    : '30d';
}

export function detectRequestedDateRange(message: string): ChatDateRange | null {
  const normalized = message
    .toLowerCase()
    .replace(/[.,;:!?]/g, ' ')
    .replace(/\s+/g, ' ');

  if (/(24|vierundzwanzig)\s*(monate|monat|m\b)|\b2\s*(jahre|jahr)\b|zwei\s*(jahre|jahr)/.test(normalized)) {
    return '24m';
  }
  if (/(18|achtzehn)\s*(monate|monat|m\b)|anderthalb\s*(jahre|jahr)/.test(normalized)) {
    return '18m';
  }
  if (/(12|zwoelf|zwölf)\s*(monate|monat|m\b)|\b1\s*(jahr|jahre)\b|ein\s*(jahr|jahre)|letzte[nr]?\s*(jahr|12 monate)/.test(normalized)) {
    return '12m';
  }
  if (/(6|sechs)\s*(monate|monat|m\b)|halbjahr|letzte[nr]?\s*6\s*monate/.test(normalized)) {
    return '6m';
  }
  if (/(3|drei)\s*(monate|monat|m\b)|quartal|letzte[nr]?\s*3\s*monate/.test(normalized)) {
    return '3m';
  }
  if (/(30|dreissig|dreißig)\s*(tage|tag|d\b)|letzte[nr]?\s*30\s*tage|letzte[nr]?\s*monat/.test(normalized)) {
    return '30d';
  }

  return null;
}

export function getDateRangeLabel(dateRange: string): string {
  const labels: Record<ChatDateRange, string> = {
    '30d': 'Letzte 30 Tage',
    '3m': 'Letzte 3 Monate',
    '6m': 'Letzte 6 Monate',
    '12m': 'Letzte 12 Monate',
    '18m': 'Letzte 18 Monate',
    '24m': 'Letzte 24 Monate',
  };

  return labels[normalizeDateRange(dateRange)];
}

export function getDateRanges(dateRange: string) {
  const end = new Date();
  end.setDate(end.getDate() - 1); // Gestern

  const start = new Date(end);
  let days = 30;
  if (dateRange === '3m') days = 90;
  if (dateRange === '6m') days = 180;
  if (dateRange === '12m') days = 365;
  if (dateRange === '18m') days = 548;
  if (dateRange === '24m') days = 730;
  start.setDate(end.getDate() - days);

  const startDateStr = start.toISOString().split('T')[0];
  const endDateStr = end.toISOString().split('T')[0];

  // Vorperiode
  const prevEnd = new Date(start);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevEnd.getDate() - days);

  return {
    current: { start: startDateStr, end: endDateStr },
    previous: { start: prevStart.toISOString().split('T')[0], end: prevEnd.toISOString().split('T')[0] },
    days
  };
}
