// GA4 erwartet die numerische Property-ID; häufig wird stattdessen die Mess-ID (G-…) eingetragen.
export type Ga4PropertyIdResult =
  | { ok: true; value: string | null }
  | { ok: false; message: string };

export const GA4_PROPERTY_ID_HINT =
  'Numerische Property-ID aus GA4 → Verwaltung → Property-Details, z. B. 412345678 (nicht die Mess-ID G-…).';

export function parseGa4PropertyId(input: unknown): Ga4PropertyIdResult {
  if (input === null || input === undefined) return { ok: true, value: null };
  const raw = String(input).trim().replace(/^properties\//i, '');
  if (raw === '') return { ok: true, value: null };
  if (/^\d{4,15}$/.test(raw)) return { ok: true, value: raw };
  if (/^G-[A-Z0-9]+$/i.test(raw)) {
    return { ok: false, message: `Ungültige GA4 Property-ID: ${raw} ist die Mess-ID. ${GA4_PROPERTY_ID_HINT}` };
  }
  return { ok: false, message: `Ungültige GA4 Property-ID: ${GA4_PROPERTY_ID_HINT}` };
}
