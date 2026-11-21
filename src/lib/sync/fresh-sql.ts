// Tagged-Template-Wrapper um `sql` aus @vercel/postgres für die Auftragsverwaltung.
//
// Hintergrund: Im Cron-Lauf kamen Antworten auf identische Anweisungen (gleicher
// Text, gleiche Parameter) bis auf die Mikrosekunde unverändert zurück – auch
// clock_timestamp() lieferte tagelang denselben Wert. Die Warteschlange stand
// dadurch still, und derselbe Auftrag wurde immer wieder abgearbeitet.
// Ein einmaliger Kommentar macht jede Anweisung eindeutig, sodass keine
// gespeicherte Antwort mehr passen kann. Postgres ignoriert den Kommentar.
import { sql } from '@vercel/postgres';
import { randomUUID } from 'node:crypto';

type SqlValue = Parameters<typeof sql>[1];

export function withFreshMarker(strings: TemplateStringsArray, marker: string): TemplateStringsArray {
  const suffix = `\n/* fresh:${marker} */`;
  const cooked = [...strings];
  const raw = [...strings.raw];
  cooked[cooked.length - 1] = `${cooked[cooked.length - 1] ?? ''}${suffix}`;
  raw[raw.length - 1] = `${raw[raw.length - 1] ?? ''}${suffix}`;
  return Object.assign(cooked, { raw }) as unknown as TemplateStringsArray;
}

export function freshSql<O extends Record<string, unknown> = Record<string, unknown>>(
  strings: TemplateStringsArray,
  ...values: SqlValue[]
) {
  return sql<O>(withFreshMarker(strings, randomUUID()), ...values);
}
