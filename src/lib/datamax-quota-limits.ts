// src/lib/datamax-quota-limits.ts
// Grenzen für das DataMax-Tageslimit, ohne Server-Abhängigkeiten (auch im Browser nutzbar).

/** Standard: Fragen pro Person und Tag; Superadmins sind nicht begrenzt. */
export const DATAMAX_DAILY_LIMITS = {
  BENUTZER: 10,
  ADMIN: 50,
} as const;

/** Erlaubter Bereich für ein eigenes Limit (Spalte users.datamax_daily_limit). */
export const DATAMAX_LIMIT_RANGE = { min: 1, max: 1000 } as const;
