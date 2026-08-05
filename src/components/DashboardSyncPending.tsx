'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';

export default function DashboardSyncPending({
  domain,
  dateRange,
}: {
  domain?: string | null;
  dateRange: string;
}) {
  const router = useRouter();
  const [checks, setChecks] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setChecks((current) => current + 1);
      router.refresh();
    }, 15_000);
    return () => window.clearInterval(interval);
  }, [router]);

  return (
    <div className="min-h-screen dashboard-gradient px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-3xl">
        <div className="dashboard-widget-surface rounded-lg p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-300">
              <RefreshCw className="h-5 w-5 animate-spin" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-heading">Daten werden vorbereitet</h1>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                Der Zeitraum {dateRange} für {domain || 'dieses Projekt'} wurde zur Synchronisierung eingereiht.
                Das Dashboard aktualisiert sich automatisch, sobald der Snapshot bereitsteht.
              </p>
              <p className="mt-3 text-xs text-muted">Statusprüfungen: {checks}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
