'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLoadingOverlay from '@/components/dashboard/DashboardLoadingOverlay';

const RANGE_LABELS: Record<string, string> = {
  '7d': 'die letzten 7 Tage',
  '30d': 'die letzten 30 Tage',
  '3m': 'die letzten 3 Monate',
  '6m': 'die letzten 6 Monate',
  '12m': 'die letzten 12 Monate',
  '18m': 'die letzten 18 Monate',
  '24m': 'die letzten 24 Monate',
};

export default function DashboardSyncPending({
  domain,
  dateRange,
}: {
  domain?: string | null;
  dateRange: string;
}) {
  const router = useRouter();

  useEffect(() => {
    const interval = window.setInterval(() => {
      router.refresh();
    }, 15_000);
    return () => window.clearInterval(interval);
  }, [router]);

  const rangeLabel = RANGE_LABELS[dateRange] ?? `den Zeitraum ${dateRange}`;
  return (
    <DashboardLoadingOverlay
      title="Dashboard wird aktualisiert"
      description={`Die Daten für ${rangeLabel}${domain ? ` von ${domain}` : ''} werden im Hintergrund synchronisiert. Das Dashboard öffnet sich automatisch.`}
    />
  );
}
