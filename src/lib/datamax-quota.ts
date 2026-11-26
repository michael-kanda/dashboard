// src/lib/datamax-quota.ts
// Tageslimit für DataMax: zählt Chat-Fragen und KI-Analysen pro angemeldeter Person
// (Tabelle datamax_usage, Migration 012). Der Tag läuft nach Wiener Zeit.
import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

/** Fragen pro Person und Tag; Superadmins sind nicht begrenzt. */
export const DATAMAX_DAILY_LIMITS = {
  BENUTZER: 10,
  ADMIN: 50,
} as const;

export interface DataMaxQuota {
  /** null = unbegrenzt */
  limit: number | null;
  used: number;
  /** null = unbegrenzt */
  remaining: number | null;
  allowed: boolean;
}

export function dailyLimitFor(role: string | null | undefined): number | null {
  if (role === 'SUPERADMIN') return null;
  if (role === 'ADMIN') return DATAMAX_DAILY_LIMITS.ADMIN;
  return DATAMAX_DAILY_LIMITS.BENUTZER;
}

function quota(limit: number | null, used: number, allowed: boolean): DataMaxQuota {
  return {
    limit,
    used,
    remaining: limit === null ? null : Math.max(0, limit - used),
    allowed,
  };
}

/** Aktueller Stand, ohne zu zählen. */
export async function readDataMaxQuota(userId: string, role: string | null | undefined): Promise<DataMaxQuota> {
  const limit = dailyLimitFor(role);
  if (limit === null) return quota(null, 0, true);
  try {
    const { rows } = await sql`
      SELECT question_count FROM datamax_usage
      WHERE user_id = ${userId}::uuid
        AND usage_date = (NOW() AT TIME ZONE 'Europe/Vienna')::date
    `;
    const used = Number(rows[0]?.question_count ?? 0);
    return quota(limit, used, used < limit);
  } catch (error) {
    logger.warn('[DataMax-Limit] Stand nicht lesbar, keine Begrenzung', error);
    return quota(limit, 0, true);
  }
}

/**
 * Zählt eine Anfrage, sofern das Tageslimit noch nicht erreicht ist (atomar).
 * Ist die Datenbank nicht erreichbar, wird nicht blockiert.
 */
export async function consumeDataMaxQuota(userId: string, role: string | null | undefined): Promise<DataMaxQuota> {
  const limit = dailyLimitFor(role);
  if (limit === null) return quota(null, 0, true);
  try {
    const { rows } = await sql`
      INSERT INTO datamax_usage (user_id, usage_date, question_count)
      VALUES (${userId}::uuid, (NOW() AT TIME ZONE 'Europe/Vienna')::date, 1)
      ON CONFLICT (user_id, usage_date) DO UPDATE
        SET question_count = datamax_usage.question_count + 1,
            updated_at = NOW()
        WHERE datamax_usage.question_count < ${limit}
      RETURNING question_count
    `;
    if (rows.length === 0) return quota(limit, limit, false);
    return quota(limit, Number(rows[0].question_count), true);
  } catch (error) {
    logger.warn('[DataMax-Limit] Zählen fehlgeschlagen, keine Begrenzung', error);
    return quota(limit, 0, true);
  }
}

/** Header für die Anzeige „Noch X Fragen heute“ im Chat. */
export function quotaHeaders(q: DataMaxQuota): Record<string, string> {
  if (q.limit === null || q.remaining === null) return {};
  return {
    'X-DataMax-Limit': String(q.limit),
    'X-DataMax-Remaining': String(q.remaining),
  };
}

export function quotaExceededResponse(q: DataMaxQuota) {
  return NextResponse.json(
    {
      error: `Das Tageslimit von ${q.limit} DataMax-Fragen ist erreicht. Ab morgen geht es weiter.`,
      message: `Das Tageslimit von ${q.limit} DataMax-Anfragen ist erreicht. Ab morgen geht es weiter.`,
      limitReached: true,
      limit: q.limit,
      remaining: 0,
    },
    { status: 429, headers: quotaHeaders(q) },
  );
}
