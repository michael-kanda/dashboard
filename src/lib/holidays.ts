// src/lib/holidays.ts
import Holidays from 'date-holidays';

const hd_DE = new Holidays('DE');
const hd_AT = new Holidays('AT');

export interface HolidayInfo {
  name: string;
  countries: ('DE' | 'AT')[];
}

/**
 * Prüft ob ein Datum ein Feiertag in DE und/oder AT ist.
 * Gibt null zurück wenn kein Feiertag, sonst Name + betroffene Länder.
 */
export function getHolidayInfo(date: Date | string): HolidayInfo | null {
  const d = typeof date === 'string' ? new Date(date) : date;

  const deHolidays = hd_DE.isHoliday(d);
  const atHolidays = hd_AT.isHoliday(d);

  // isHoliday gibt false oder ein Array zurück
  // Nur "public" Feiertage berücksichtigen (keine Schulferien etc.)
  const dePublic = Array.isArray(deHolidays)
    ? deHolidays.filter((h) => h.type === 'public')
    : [];
  const atPublic = Array.isArray(atHolidays)
    ? atHolidays.filter((h) => h.type === 'public')
    : [];

  if (dePublic.length === 0 && atPublic.length === 0) return null;

  // Name: bevorzugt DE-Name, Fallback AT
  const name = dePublic[0]?.name || atPublic[0]?.name || 'Feiertag';

  const countries: ('DE' | 'AT')[] = [];
  if (dePublic.length > 0) countries.push('DE');
  if (atPublic.length > 0) countries.push('AT');

  return { name, countries };
}

/**
 * Erstellt eine Map aller Feiertage in einem Zeitraum.
 * Key = ISO-Datumsstring (YYYY-MM-DD), Value = HolidayInfo.
 * Für performanten Zugriff im Chart (einmal berechnen, oft lesen).
 */
export function buildHolidayMap(
  startDate: Date | string,
  endDate: Date | string
): Map<string, HolidayInfo> {
  const map = new Map<string, HolidayInfo>();
  const start = new Date(typeof startDate === 'string' ? startDate : startDate);
  const end = new Date(typeof endDate === 'string' ? endDate : endDate);

  const cursor = new Date(start);
  while (cursor <= end) {
    const key = cursor.toISOString().split('T')[0];
    const info = getHolidayInfo(cursor);
    if (info) map.set(key, info);
    cursor.setDate(cursor.getDate() + 1);
  }

  return map;
}
