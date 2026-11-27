// src/lib/access-request.ts
// Prüfung der Zugangsanfrage von der Landingpage. Ohne Server-Abhängigkeiten,
// damit Formular und API dieselben Regeln nutzen.
import { z } from 'zod';

/** Mindestzeit zwischen Öffnen und Absenden; schnellere Anfragen stammen fast immer von Bots. */
export const MIN_FILL_MS = 3000;

const optionalText = (max: number) =>
  z.string().trim().max(max, `Höchstens ${max} Zeichen`).optional().or(z.literal('')).transform((value) => value || undefined);

export const accessRequestSchema = z.object({
  name: z.string().trim().min(2, 'Bitte Ihren Namen angeben').max(100, 'Höchstens 100 Zeichen'),
  company: optionalText(120),
  email: z.string().trim().max(200, 'Höchstens 200 Zeichen').email('Bitte eine gültige E-Mail-Adresse angeben'),
  website: optionalText(200),
  message: optionalText(2000),
  consent: z.literal(true, { message: 'Bitte stimmen Sie der Verarbeitung zu' }),
  /** Honeypot: muss leer bleiben. */
  fax: z.string().max(0).optional().or(z.literal('')),
  /** Zeitpunkt, zu dem das Formular geöffnet wurde (ms). */
  openedAt: z.number().int().positive(),
});

export type AccessRequestInput = z.input<typeof accessRequestSchema>;
export type AccessRequest = z.output<typeof accessRequestSchema>;
