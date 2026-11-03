'use client';

import { Printer } from 'react-bootstrap-icons';

export default function GuestPrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="ml-2 inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[13px] font-medium text-accent hover:bg-fill"
    >
      <Printer size={13} aria-hidden="true" />
      Drucken
    </button>
  );
}
