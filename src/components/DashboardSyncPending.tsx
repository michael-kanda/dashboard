'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLoadingOverlay from '@/components/dashboard/DashboardLoadingOverlay';

export default function DashboardSyncPending({ projectId, dateRange, backgroundOnly = false, fallbackRange }: {
  projectId: string; dateRange: string; backgroundOnly?: boolean; fallbackRange?: string | null;
}) {
  const router = useRouter();
  const [state, setState] = useState<'loading' | 'scheduled' | 'failed' | 'unavailable'>('loading');
  const [checkRevision, setCheckRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let polls = 0;
    let started = checkRevision > 0;
    let active = false;
    let stopped = false;
    setState('loading');
    const url = `/api/projects/${projectId}/dashboard-sync`;
    const stop = (nextState: typeof state) => { stopped = true; setState(nextState); };
    const check = async () => {
      if (stopped || active || controller.signal.aborted || document.hidden) return;
      active = true;
      try {
        const initial = !started;
        started = true;
        const response = await fetch(initial ? url : `${url}?dateRange=${dateRange}`, {
          method: initial ? 'POST' : 'GET',
          headers: initial ? { 'Content-Type': 'application/json' } : undefined,
          body: initial ? JSON.stringify({ dateRange }) : undefined,
          signal: controller.signal,
          cache: 'no-store',
        });
        if (controller.signal.aborted) return;
        if (!response.ok) { stop(response.status >= 500 ? 'failed' : 'unavailable'); return; }
        const data = await response.json();
        if (data.status === 'ready' || (initial && data.success && !data.pending)) {
          stopped = true;
          router.refresh();
          return;
        }
        if (data.status === 'failed') { stop('failed'); return; }
        if (data.status === 'scheduled' || ++polls >= 8) { stop('scheduled'); return; }
        timer = setTimeout(check, Math.min(10_000 * 2 ** (polls - 1), 60_000));
      } catch {
        if (!controller.signal.aborted) stop('unavailable');
      } finally { active = false; }
    };
    const onVisibility = () => {
      if (timer) clearTimeout(timer);
      if (!document.hidden) void check();
    };
    document.addEventListener('visibilitychange', onVisibility);
    void check();
    return () => {
      controller.abort();
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [checkRevision, dateRange, projectId, router]);
  return backgroundOnly ? null : (
    <DashboardLoadingOverlay
      state={state}
      fallbackHref={fallbackRange ? `/projekt/${projectId}?range=${encodeURIComponent(fallbackRange)}` : undefined}
      onCheck={() => setCheckRevision((current) => current + 1)}
    />
  );
}
