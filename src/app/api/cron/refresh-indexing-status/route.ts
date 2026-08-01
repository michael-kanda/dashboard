import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { syncProjectIndexingStatus } from '@/lib/indexing-status';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

type DueProject = { id: string; email: string };
type CronResult = {
  projectId: string;
  email: string;
  success: boolean;
  retryable: boolean;
  message: string;
};

const DATABASE_RETRY_DELAYS_MS = [0, 500, 1_500, 3_000] as const;
const TRANSIENT_DATABASE_CODES = new Set([
  '08000', '08001', '08003', '08006', '53300', '57P01', '57P02', '57P03',
  'EAI_AGAIN', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'UND_ERR_CONNECT_TIMEOUT',
]);

function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function isRetryableDatabaseError(error: unknown): boolean {
  const queue: unknown[] = [error];
  const visited = new Set<unknown>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current)) continue;
    visited.add(current);

    if (typeof current === 'string') {
      const message = current.toLowerCase();
      if (
        message.includes('"neon:retryable":true') ||
        message.includes('control plane request failed') ||
        message.includes('connection terminated unexpectedly') ||
        message.includes('fetch failed') ||
        message.includes('connection timeout')
      ) {
        return true;
      }
      continue;
    }

    if (typeof current !== 'object') continue;
    const value = current as Record<string, unknown>;
    if (value['neon:retryable'] === true) return true;

    const code = typeof value.code === 'string' ? value.code.toUpperCase() : '';
    if (TRANSIENT_DATABASE_CODES.has(code)) return true;

    if (typeof value.message === 'string') queue.push(value.message);
    if (value.sourceError) queue.push(value.sourceError);
    if (value.cause) queue.push(value.cause);
  }

  return false;
}

async function loadDueProjects(): Promise<DueProject[]> {
  let lastError: unknown;
  for (let attempt = 0; attempt < DATABASE_RETRY_DELAYS_MS.length; attempt += 1) {
    const delay = DATABASE_RETRY_DELAYS_MS[attempt];
    if (delay > 0) await sleep(delay);

    try {
      const { rows } = await sql<DueProject>`
        SELECT u.id::text, u.email
        FROM users u
        LEFT JOIN project_indexing_sync s ON s.user_id = u.id
        WHERE u.role = 'BENUTZER'
          AND u.gsc_site_url IS NOT NULL
          AND (
            s.user_id IS NULL
            OR s.next_sync_at IS NULL
            OR s.next_sync_at <= NOW()
          )
        ORDER BY
          CASE WHEN s.status = 'partial' THEN 0 ELSE 1 END,
          s.completed_at ASC NULLS FIRST
        LIMIT 5
      `;
      return rows;
    } catch (error) {
      lastError = error;
      if (!isRetryableDatabaseError(error) || attempt === DATABASE_RETRY_DELAYS_MS.length - 1) {
        throw error;
      }
      console.warn(`[Indexing Cron] Temporärer Datenbankfehler, Versuch ${attempt + 2}/${DATABASE_RETRY_DELAYS_MS.length}`);
    }
  }
  throw lastError;
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  let projects: DueProject[];
  try {
    projects = await loadDueProjects();
  } catch (error) {
    const retryable = isRetryableDatabaseError(error);
    const log = retryable ? console.warn : console.error;
    log('[Indexing Cron] Fällige Projekte konnten nicht geladen werden:', error);
    return NextResponse.json({
      processed: 0,
      success: 0,
      failed: 0,
      deferred: retryable,
      message: retryable
        ? 'Neon ist vorübergehend nicht erreichbar. Der Indexierungsabgleich wurde aufgeschoben.'
        : 'Fällige Projekte konnten nicht geladen werden.',
    }, {
      status: retryable ? 503 : 500,
      headers: retryable ? { 'Retry-After': '60' } : undefined,
    });
  }

  const deadlineAt = Date.now() + 240_000;
  const results: CronResult[] = [];
  let databaseUnavailable = false;
  for (let index = 0; index < projects.length; index += 1) {
    if (Date.now() + 25_000 >= deadlineAt) break;
    const project = projects[index];
    const remainingProjects = projects.length - index;
    const fairShareMs = Math.floor((deadlineAt - Date.now()) / remainingProjects);
    const projectDeadlineAt = Math.min(deadlineAt, Date.now() + Math.max(35_000, fairShareMs));
    try {
      const status = await syncProjectIndexingStatus(project.id, {
        maxInspections: 120,
        deadlineAt: projectDeadlineAt,
      });
      results.push({
        projectId: project.id,
        email: project.email,
        success: true,
        retryable: false,
        message: `${status.indexedUrls}/${status.totalUrls} URLs indexiert`,
      });
    } catch (error) {
      const retryable = isRetryableDatabaseError(error);
      results.push({
        projectId: project.id,
        email: project.email,
        success: false,
        retryable,
        message: retryable
          ? 'Temporärer Datenbankfehler; der Lauf wird später fortgesetzt.'
          : error instanceof Error ? error.message : 'Unbekannter Fehler',
      });
      if (retryable) {
        databaseUnavailable = true;
        break;
      }
    }
  }

  return NextResponse.json({
    processed: results.length,
    success: results.filter((result) => result.success).length,
    failed: results.filter((result) => !result.success).length,
    deferred: databaseUnavailable,
    results,
  }, {
    status: databaseUnavailable ? 503 : 200,
    headers: databaseUnavailable ? { 'Retry-After': '60' } : undefined,
  });
}
