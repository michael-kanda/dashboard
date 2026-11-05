// GSC kennt zwei Formen: Domain-Property (sc-domain:beispiel.at) und URL-Präfix (https://www.beispiel.at/).
export function normalizeGscSiteUrl(input: string): { ok: true; value: string } | { ok: false; message: string } {
  const value = input.trim();
  if (/^sc-domain:[a-z0-9.-]+\.[a-z]{2,}$/i.test(value)) return { ok: true, value: value.toLowerCase() };
  if (/^https?:\/\/[^\s/]+\.[^\s/]+(\/.*)?$/i.test(value)) return { ok: true, value: value.endsWith('/') ? value : `${value}/` };
  if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(value)) {
    return { ok: false, message: `Bitte als Domain-Property angeben: sc-domain:${value.toLowerCase().replace(/^www\./, '')}` };
  }
  return { ok: false, message: 'Format: sc-domain:beispiel.at oder https://www.beispiel.at/' };
}
