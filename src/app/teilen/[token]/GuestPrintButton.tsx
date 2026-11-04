'use client';

import { Printer } from 'react-bootstrap-icons';

export default function GuestPrintButton() {
  return (
    <button
      type="button"
      onClick={() => {
        // Druckbericht des Gastlinks mit dem aktuellen Zeitraum
        const range = new URLSearchParams(window.location.search).get('range');
        const params = new URLSearchParams({ print: '1', ...(range ? { range } : {}) });
        window.open(`${window.location.pathname}/bericht?${params.toString()}`, '_blank', 'noopener');
      }}
      className="ml-2 inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[13px] font-medium text-accent hover:bg-fill"
    >
      <Printer size={13} aria-hidden="true" />
      Drucken
    </button>
  );
}
