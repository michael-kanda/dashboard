// src/app/demo-anwalt/demo-prompt-tracking.ts
// Fiktives Fragen-Radar der Demo-Kanzlei: lange, fragenartige Google-Suchen (ab 6 Wörtern).
// Klassifiziert mit denselben Regeln wie die echten Daten (query-classifier).
import type {
  PromptQueryData,
  PromptTrackingResult,
  PromptTrackingShareBucket,
  PromptWordCountBucket,
  QuestionTypeDistribution,
} from '@/lib/dashboard-shared';
import { detectQuestionType, hasGeoReference, isBrandedQuery, type QuestionType } from '@/lib/prompt-tracking/query-classifier';
import { DEMO_START } from './demo-extras';

const DAY = 24 * 60 * 60 * 1000;
const DOMAIN = 'kanzlei-demo.at';
const MIN_WORDS = 6;

// [Suchanfrage, Klicks, Impressionen, Position, Landingpage]
const RAW: [string, number, number, number, string][] = [
  ['was kostet eine scheidung in österreich mit anwalt', 21, 640, 4.2, '/familienrecht/scheidung/'],
  ['wie lange dauert ein führerscheinentzug nach alkohol am steuer', 18, 520, 3.6, '/verkehrsrecht/fuehrerschein-entzug/'],
  ['kann der arbeitgeber mich im krankenstand kündigen österreich', 16, 590, 5.1, '/arbeitsrecht/kuendigung/'],
  ['wie hoch ist der unterhalt für zwei kinder in österreich', 14, 470, 4.8, '/familienrecht/unterhalt/'],
  ['was passiert mit dem erbe ohne testament in österreich', 13, 610, 6.3, '/erbrecht/testament/'],
  ['muss ich bei einer einvernehmlichen scheidung zum anwalt', 12, 380, 3.9, '/familienrecht/scheidung/'],
  ['bester anwalt für verkehrsrecht in wien mit erfahrung', 11, 290, 2.8, '/verkehrsrecht/fuehrerschein-entzug/'],
  ['wie viel kostet ein testament beim anwalt in wien', 10, 330, 3.4, '/erbrecht/testament/'],
  ['welche fristen gelten bei einer kündigung durch den arbeitgeber', 9, 410, 6.8, '/arbeitsrecht/kuendigung/'],
  ['was kostet ein strafverteidiger in wien pro stunde', 9, 260, 4.4, '/strafrecht/'],
  ['unterschied zwischen strittiger und einvernehmlicher scheidung in österreich', 8, 350, 5.6, '/familienrecht/scheidung/'],
  ['wer erbt wenn kein testament vorhanden ist österreich', 8, 420, 7.1, '/erbrecht/testament/'],
  ['wie schreibe ich ein gültiges testament ohne notar', 7, 380, 8.2, '/erbrecht/testament/'],
  ['was tun wenn die polizei den führerschein abnimmt', 7, 300, 5.3, '/verkehrsrecht/fuehrerschein-entzug/'],
  ['wann bekomme ich meinen führerschein nach entzug zurück', 7, 340, 6.0, '/verkehrsrecht/fuehrerschein-entzug/'],
  ['wie berechnet man den unterhalt nach einer scheidung', 6, 310, 7.4, '/familienrecht/unterhalt/'],
  ['welcher anwalt hilft bei einer fristlosen entlassung in wien', 6, 190, 3.1, '/arbeitsrecht/kuendigung/'],
  ['kanzlei demo wien erstberatung online termin vereinbaren', 6, 80, 1.2, '/rechtsanwalt-wien/'],
  ['was kostet die erste beratung beim rechtsanwalt in wien', 5, 280, 6.6, '/rechtsanwalt-wien/'],
  ['wie lange hat man zeit ein erbe auszuschlagen in österreich', 5, 260, 6.9, '/erbrecht/testament/'],
  ['muss ich zur einvernahme bei der polizei als beschuldigter', 5, 230, 5.8, '/strafrecht/'],
  ['wie viel abfertigung bekomme ich bei kündigung nach zehn jahren', 4, 270, 8.4, '/arbeitsrecht/kuendigung/'],
  ['wer zahlt den anwalt bei einer scheidung in österreich', 4, 240, 7.2, '/familienrecht/scheidung/'],
  ['warum wurde mein führerschein für sechs monate entzogen', 4, 180, 6.4, '/verkehrsrecht/fuehrerschein-entzug/'],
  ['wann ist eine kündigung im krankenstand unwirksam', 4, 220, 7.7, '/arbeitsrecht/kuendigung/'],
  ['wo kann ich in wien kostenlose rechtsberatung bekommen', 3, 310, 9.1, '/rechtsanwalt-wien/'],
  ['was ist der unterschied zwischen anwalt und notar beim erbrecht', 3, 200, 8.8, '/erbrecht/testament/'],
  ['wie hoch ist die strafe für fahren ohne führerschein in österreich', 3, 260, 9.4, '/verkehrsrecht/fuehrerschein-entzug/'],
  ['welche unterlagen brauche ich für die scheidung beim gericht', 3, 170, 6.1, '/familienrecht/scheidung/'],
  ['wer bekommt das sorgerecht nach der scheidung in österreich', 3, 210, 8.0, '/familienrecht/scheidung/'],
  ['wie wehre ich mich gegen eine anzeige wegen körperverletzung', 2, 140, 7.5, '/strafrecht/'],
  ['wann verjährt eine forderung aus dem arbeitsverhältnis in österreich', 2, 130, 9.6, '/arbeitsrecht/kuendigung/'],
  ['wie viel kindesunterhalt muss ich bei geringem einkommen zahlen', 2, 160, 8.7, '/familienrecht/unterhalt/'],
  ['was kostet ein anwalt für ein verfahren vor dem arbeitsgericht', 2, 120, 7.9, '/arbeitsrecht/kuendigung/'],
];

function countWords(s: string) {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

const queries: PromptQueryData[] = RAW
  .map(([query, clicks, impressions, position, url]) => ({
    query,
    clicks,
    impressions,
    ctr: clicks / impressions,
    position,
    url,
    wordCount: countWords(query),
    isBranded: isBrandedQuery(query, DOMAIN),
    hasGeoReference: hasGeoReference(query),
    questionType: detectQuestionType(query),
  }))
  .sort((a, b) => b.impressions - a.impressions);

function wordCountDistribution(list: PromptQueryData[]): PromptWordCountBucket[] {
  const ranges = [
    { range: '6–7', minWords: 6, max: 7 },
    { range: '8–9', minWords: 8, max: 9 },
    { range: '10–14', minWords: 10, max: 14 },
    { range: '15+', minWords: 15, max: Infinity },
  ];
  return ranges.map(({ range, minWords, max }) => {
    const matching = list.filter((q) => q.wordCount >= minWords && q.wordCount <= max);
    return { range, minWords, count: matching.length, impressions: matching.reduce((sum, q) => sum + q.impressions, 0) };
  });
}

function questionTypeDistribution(list: PromptQueryData[]): QuestionTypeDistribution {
  const dist: QuestionTypeDistribution = {
    what: 0, how: 0, why: 0, who: 0, where: 0, when: 0,
    compare: 0, price: 0, recommendation: 0, other: 0,
  };
  for (const q of list) dist[q.questionType]++;
  return dist;
}

function dominant(dist: QuestionTypeDistribution): QuestionType {
  return (Object.entries(dist) as [QuestionType, number][]).reduce((best, entry) => (entry[1] > best[1] ? entry : best))[0];
}

// Tagesverlauf der langen Suchen, passend zu den Summen oben
const totalClicks = queries.reduce((s, q) => s + q.clicks, 0);
const totalImpressions = queries.reduce((s, q) => s + q.impressions, 0);
// Wächst schneller als alle Suchen zusammen: der Anteil steigt im Zeitraum, wie es das Fragen-Radar zeigen soll.
const weights = Array.from({ length: 30 }, (_, i) => 0.4 + (i / 29) * 1.6 + (i % 7 === 5 || i % 7 === 6 ? -0.12 : 0));
const weightSum = weights.reduce((s, w) => s + w, 0);
const trend = weights.map((w, i) => ({
  date: DEMO_START + i * DAY,
  clicks: Math.round((totalClicks * w) / weightSum),
  impressions: Math.round((totalImpressions * w) / weightSum),
}));

/** Anteil der langen Suchen an allen Impressionen, je Kalenderwoche (wie buildShareTrend in lib/prompt-tracking/share-trend). */
export function buildDemoShareTrend(allDaily: { date: number; value: number }[]): PromptTrackingShareBucket[] {
  const week = (ts: number) => {
    const d = new Date(ts);
    const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
    const n = Math.ceil(((tmp.getTime() - yearStart.getTime()) / DAY + 1) / 7);
    return { key: `${tmp.getUTCFullYear()}-W${String(n).padStart(2, '0')}`, label: `KW ${n}` };
  };
  const buckets = new Map<string, PromptTrackingShareBucket>();
  for (const point of allDaily) {
    const { key, label } = week(point.date);
    const bucket = buckets.get(key) ?? { bucket: key, label, totalImpressions: 0, promptImpressions: 0, sharePercent: 0 };
    bucket.totalImpressions += point.value;
    buckets.set(key, bucket);
  }
  for (const point of trend) {
    const bucket = buckets.get(week(point.date).key);
    if (bucket) bucket.promptImpressions += point.impressions;
  }
  return Array.from(buckets.values())
    .sort((a, b) => a.bucket.localeCompare(b.bucket))
    .map((b) => ({ ...b, sharePercent: b.totalImpressions > 0 ? (b.promptImpressions / b.totalImpressions) * 100 : 0 }));
}

export function buildDemoPromptTracking(totalImpressionsAll: number, allDaily: { date: number; value: number }[]): PromptTrackingResult {
  const totalQueries = queries.length;
  const positionSum = queries.reduce((s, q) => s + q.position * q.impressions, 0);
  const branded = queries.filter((q) => q.isBranded);
  const geo = queries.filter((q) => q.hasGeoReference);
  const brandedImpressions = branded.reduce((s, q) => s + q.impressions, 0);
  const geoImpressions = geo.reduce((s, q) => s + q.impressions, 0);
  const dist = questionTypeDistribution(queries);
  const sharePercent = totalImpressionsAll > 0 ? (totalImpressions / totalImpressionsAll) * 100 : 0;

  return {
    queries,
    totals: {
      totalQueries,
      totalClicks,
      totalImpressions,
      avgCtr: totalClicks / totalImpressions,
      avgPosition: positionSum / totalImpressions,
      brandedShare: (branded.length / totalQueries) * 100,
      nonBrandedShare: 100 - (branded.length / totalQueries) * 100,
      brandedImpressionShare: (brandedImpressions / totalImpressions) * 100,
      nonBrandedImpressionShare: 100 - (brandedImpressions / totalImpressions) * 100,
      sharePercent,
      totalImpressionsAll,
      geoShare: (geo.length / totalQueries) * 100,
      geoImpressionShare: (geoImpressions / totalImpressions) * 100,
      questionTypeDistribution: dist,
      dominantQuestionType: dominant(dist),
    },
    trend,
    shareTrend: buildDemoShareTrend(allDaily),
    wordCountDistribution: wordCountDistribution(queries),
    previous: {
      totalQueries: 27,
      totalImpressions: Math.round(totalImpressions * 0.74),
      totalClicks: Math.round(totalClicks * 0.7),
      sharePercent: sharePercent * 0.81,
    },
    minWords: MIN_WORDS,
    brandKeywordsUsed: null,
    brandKeywordsSource: 'domain-heuristic',
  };
}
