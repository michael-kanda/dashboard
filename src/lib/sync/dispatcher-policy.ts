import type { ProjectSyncJobType } from './job-queue';

const JOB_TYPE_ORDER: ProjectSyncJobType[] = ['dashboard', 'gsc-history', 'indexing'];

export interface QueueSourceState {
  oldestDueAt: string | null;
  lastStartedAt: string | null;
  dueCount: number;
}

export type QueueSourceStates = Partial<Record<ProjectSyncJobType, QueueSourceState>>;

export const MAX_JOBS_PER_RUN = 9;

/**
 * Reservierte Slots je Lauf.
 * - "mixed" (regulärer Cron alle 12 Stunden): Indexing bekommt den größten Anteil,
 *   weil ein Projekt mehrere Chargen braucht, bis alle Sitemap-URLs geprüft sind.
 * - "dashboard" (Morgenlauf): nur Dashboard-Snapshots, damit alle Projekte vor dem
 *   ersten Einstieg schon Daten bis zum Vortag zeigen.
 */
export type DispatchMode = 'mixed' | 'dashboard';

export function getRunQuota(mode: DispatchMode): Record<ProjectSyncJobType, number> {
  if (mode === 'dashboard') {
    return { dashboard: MAX_JOBS_PER_RUN, 'gsc-history': 0, indexing: 0 };
  }
  return { dashboard: 3, 'gsc-history': 2, indexing: 4 };
}

export function parseDispatchMode(value: string | null | undefined): DispatchMode {
  return value === 'dashboard' ? 'dashboard' : 'mixed';
}

function waitingSince(state?: QueueSourceState): number {
  if (!state?.oldestDueAt) return Infinity;
  return Math.max(Date.parse(state.oldestDueAt), state.lastStartedAt ? Date.parse(state.lastStartedAt) : 0);
}

export function pickNextProjectSyncJobType({
  remainingQuota,
  processedByType,
  exhaustedTypes,
  fits,
  sourceStates = {},
}: {
  remainingQuota: Record<ProjectSyncJobType, number>;
  processedByType: Record<ProjectSyncJobType, number>;
  exhaustedTypes: Set<ProjectSyncJobType>;
  fits: (type: ProjectSyncJobType) => boolean;
  sourceStates?: QueueSourceStates;
}): ProjectSyncJobType | undefined {
  return JOB_TYPE_ORDER
    .filter((type) => remainingQuota[type] > 0 && !exhaustedTypes.has(type) && fits(type))
    .sort((a, b) => {
      const processedDifference = processedByType[a] - processedByType[b];
      if (processedDifference !== 0) return processedDifference;
      // Persisted starts prevent every new invocation from favoring Dashboard.
      const aSince = waitingSince(sourceStates[a]);
      const bSince = waitingSince(sourceStates[b]);
      if (aSince !== bSince) return aSince < bSince ? -1 : 1;
      return JOB_TYPE_ORDER.indexOf(a) - JOB_TYPE_ORDER.indexOf(b);
    })[0];
}
