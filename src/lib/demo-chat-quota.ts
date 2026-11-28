// src/lib/demo-chat-quota.ts
// Grenzen für DataMax in der öffentlichen Demo: 5 Fragen pro Besucher und Tag (Hash der IP),
// dazu eine Obergrenze für alle Demo-Besucher zusammen, damit die KI-Kosten gedeckelt bleiben.
// Ist die Tabelle nicht erreichbar, wird geblockt (anders als beim Kunden-Limit): hier zahlt sonst jeder Fremde mit.
import crypto from 'node:crypto';
import { sql } from '@vercel/postgres';
import { logger } from '@/lib/logger';

export const DEMO_QUESTIONS_PER_VISITOR = 5;
export const DEMO_QUESTIONS_PER_DAY = 300;

export interface DemoChatQuota {
  limit: number;
  remaining: number;
  allowed: boolean;
  /** 'visitor' = eigene 5 Fragen aufgebraucht, 'global' = Demo heute ausgelastet, 'error' = Zähler nicht erreichbar */
  reason?: 'visitor' | 'global' | 'error';
}

export function hashDemoVisitor(ip: string | null): string {
  const salt = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || 'datapeak';
  return crypto.createHash('sha256').update(`demo-chat:${salt}:${ip ?? 'unbekannt'}`).digest('hex');
}

function state(used: number, allowed: boolean, reason?: DemoChatQuota['reason']): DemoChatQuota {
  return {
    limit: DEMO_QUESTIONS_PER_VISITOR,
    remaining: Math.max(0, DEMO_QUESTIONS_PER_VISITOR - used),
    allowed,
    reason,
  };
}

/** Stand ohne zu zählen. */
export async function readDemoChatQuota(ipHash: string): Promise<DemoChatQuota> {
  try {
    const { rows } = await sql<{ mine: number; total: number }>`
      SELECT
        COALESCE(SUM(question_count) FILTER (WHERE ip_hash = ${ipHash}), 0)::int AS mine,
        COALESCE(SUM(question_count), 0)::int AS total
      FROM demo_chat_usage
      WHERE usage_date = (NOW() AT TIME ZONE 'Europe/Vienna')::date
    `;
    const mine = Number(rows[0]?.mine ?? 0);
    const total = Number(rows[0]?.total ?? 0);
    if (mine >= DEMO_QUESTIONS_PER_VISITOR) return state(mine, false, 'visitor');
    if (total >= DEMO_QUESTIONS_PER_DAY) return state(mine, false, 'global');
    return state(mine, true);
  } catch (error) {
    logger.warn('[Demo-Chat] Zähler nicht lesbar, Demo-Chat gesperrt', error);
    return state(0, false, 'error');
  }
}

/** Zählt eine Frage, sofern beide Grenzen noch nicht erreicht sind (atomar je Besucher). */
export async function consumeDemoChatQuota(ipHash: string): Promise<DemoChatQuota> {
  const before = await readDemoChatQuota(ipHash);
  if (!before.allowed) return before;
  try {
    const { rows } = await sql<{ question_count: number }>`
      INSERT INTO demo_chat_usage (ip_hash, usage_date, question_count)
      VALUES (${ipHash}, (NOW() AT TIME ZONE 'Europe/Vienna')::date, 1)
      ON CONFLICT (ip_hash, usage_date) DO UPDATE
        SET question_count = demo_chat_usage.question_count + 1,
            updated_at = NOW()
        WHERE demo_chat_usage.question_count < ${DEMO_QUESTIONS_PER_VISITOR}
      RETURNING question_count
    `;
    // Alte Zeilen gelegentlich aufräumen
    if (Math.random() < 0.05) {
      await sql`DELETE FROM demo_chat_usage WHERE usage_date < (NOW() AT TIME ZONE 'Europe/Vienna')::date - 7`.catch(() => undefined);
    }
    if (rows.length === 0) return state(DEMO_QUESTIONS_PER_VISITOR, false, 'visitor');
    return state(Number(rows[0].question_count), true);
  } catch (error) {
    logger.warn('[Demo-Chat] Zählen fehlgeschlagen, Frage abgelehnt', error);
    return state(0, false, 'error');
  }
}

export function demoQuotaHeaders(q: DemoChatQuota): Record<string, string> {
  return {
    'X-DataMax-Limit': String(q.limit),
    'X-DataMax-Remaining': String(q.remaining),
  };
}

/** Text für den Chat, wenn keine Frage mehr geht. */
export function demoQuotaMessage(q: DemoChatQuota): string {
  if (q.reason === 'global') {
    return 'Die Demo ist heute stark gefragt und DataMax macht eine Pause. Morgen geht es weiter. Für einen eigenen Zugang schreiben Sie an michael@designare.at.';
  }
  if (q.reason === 'error') {
    return 'DataMax ist in der Demo gerade nicht erreichbar. Bitte versuchen Sie es später noch einmal.';
  }
  return `Das waren die ${q.limit} Fragen der Testversion. Mit einem eigenen Zugang beantwortet DataMax Fragen zu Ihren echten Zahlen. Zugang anfragen: michael@designare.at`;
}
