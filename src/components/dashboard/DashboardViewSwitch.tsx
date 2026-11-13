'use client';

import { SegmentedControl } from '@/components/ui/SegmentedControl';

export type DashboardViewMode = 'admin' | 'kunde';

const OPTIONS: { value: DashboardViewMode; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'kunde', label: 'Kunde' },
];

/**
 * Umschalter fuer Admins und Superadmins: zeigt das Dashboard wahlweise mit allen
 * Widgets (Admin) oder genau so, wie es der Kunde sieht (Kunde).
 */
export default function DashboardViewSwitch({
  value,
  onChange,
}: {
  value: DashboardViewMode;
  onChange: (value: DashboardViewMode) => void;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-2 print:hidden">
      <SegmentedControl label="Ansicht" options={OPTIONS} value={value} onChange={onChange} />
      <p className="text-[14px] text-muted" role="status">
        {value === 'kunde'
          ? 'Kundenansicht: nur die für den Kunden freigegebenen Widgets, ohne Admin-Funktionen.'
          : 'Admin-Ansicht: alle Widgets und Admin-Funktionen.'}
      </p>
    </div>
  );
}
