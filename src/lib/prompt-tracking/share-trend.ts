// Anteil der langen, fragenartigen Suchen an allen Impressionen je Woche bzw. Monat.
import type { ChartPoint } from '@/types/dashboard';
import type { PromptTrackingShareBucket } from '@/lib/dashboard-shared';

export function buildShareTrend(
  allDaily: ChartPoint[],
  promptDaily: { date: number; impressions: number }[],
  days: number
): PromptTrackingShareBucket[] {
  const useMonthly = days > 60;
  const allByBucket = new Map<string, number>();
  const promptByBucket = new Map<string, number>();

  function bucketKey(ts: number): { key: string; label: string } {
    const d = new Date(ts);
    if (useMonthly) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const monthNames = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
      return { key: `${y}-${m}`, label: `${monthNames[d.getMonth()]} '${String(y).slice(2)}` };
    }
    const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = tmp.getUTCDay() || 7;
    tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
    const week = Math.ceil((((tmp.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return { key: `${tmp.getUTCFullYear()}-W${String(week).padStart(2, '0')}`, label: `KW ${week}` };
  }

  for (const point of allDaily) {
    const ts = typeof point.date === 'number' ? point.date : new Date(point.date).getTime();
    if (!ts) continue;
    const { key } = bucketKey(ts);
    const value = point.value ?? 0;
    allByBucket.set(key, (allByBucket.get(key) || 0) + value);
  }

  for (const point of promptDaily) {
    if (!point.date) continue;
    const { key } = bucketKey(point.date);
    promptByBucket.set(key, (promptByBucket.get(key) || 0) + point.impressions);
  }

  const allKeys = Array.from(new Set([
    ...Array.from(allByBucket.keys()),
    ...Array.from(promptByBucket.keys()),
  ])).sort();

  return allKeys.map((key) => {
    const totalImpressions = allByBucket.get(key) || 0;
    const promptImpressions = promptByBucket.get(key) || 0;
    const sharePercent = totalImpressions > 0 ? (promptImpressions / totalImpressions) * 100 : 0;
    let label = key;
    if (useMonthly) {
      const [y, m] = key.split('-');
      const monthNames = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
      label = `${monthNames[parseInt(m, 10) - 1]} '${y.slice(2)}`;
    } else {
      const week = key.split('-W')[1];
      label = `KW ${week}`;
    }
    return { bucket: key, label, totalImpressions, promptImpressions, sharePercent };
  });
}
