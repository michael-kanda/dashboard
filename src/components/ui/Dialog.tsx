'use client';

import { useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'react-bootstrap-icons';
import { IconButton } from './Button';
import { useFocusTrap } from './useFocusTrap';

// Dialog oder Sheet von rechts: Fokus bleibt im Dialog, Escape schließt.
// Rendert direkt in <body>, damit kein sticky/transformierter Vorfahr (z. B. die Sidebar) ihn verdeckt.
export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  variant = 'dialog',
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  variant?: 'dialog' | 'sheet';
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(open, panelRef, onClose);

  if (!open || typeof document === 'undefined') return null;

  const isSheet = variant === 'sheet';
  return createPortal(
    <div className="fixed inset-0 z-[100]">
      <div className="absolute inset-0 bg-[rgba(0,0,0,0.3)]" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        className={`absolute flex flex-col bg-surface shadow-dialog
          ${isSheet
            ? 'inset-y-0 right-0 w-full max-w-[560px] border-l border-border'
            : 'left-1/2 top-1/2 max-h-[90vh] w-[calc(100%-32px)] max-w-[480px] -translate-x-1/2 -translate-y-1/2 rounded-container border border-border'}`}
      >
        <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-3.5">
          <h2 className="text-18 font-semibold tracking-[-0.015em] text-heading">{title}</h2>
          <IconButton label="Schließen" onClick={onClose}>
            <X size={20} aria-hidden="true" />
          </IconButton>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-border px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
