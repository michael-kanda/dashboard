'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLoadingOverlay from '@/components/dashboard/DashboardLoadingOverlay';

export default function DashboardSyncPending({
  projectId,
  dateRange,
}: {
  projectId: string;
  dateRange: string;
}) {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    let retryTimer: number | undefined;
    let errorRetryMs = 8_000;

    const synchronize = async () => {
      try {
        const response = await fetch(`/api/projects/${projectId}/dashboard-sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dateRange }),
        });
        if (cancelled) return;
        if (response.status === 202) {
          retryTimer = window.setTimeout(synchronize, 4_000);
          return;
        }
        if (response.ok) {
          router.refresh();
          return;
        }
        retryTimer = window.setTimeout(synchronize, errorRetryMs);
        errorRetryMs = Math.min(errorRetryMs * 2, 60_000);
      } catch {
        if (!cancelled) {
          retryTimer = window.setTimeout(synchronize, errorRetryMs);
          errorRetryMs = Math.min(errorRetryMs * 2, 60_000);
        }
      }
    };

    void synchronize();
    return () => {
      cancelled = true;
      if (retryTimer) window.clearTimeout(retryTimer);
    };
  }, [dateRange, projectId, router]);

  return <DashboardLoadingOverlay />;
}
