'use client';

import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Für Dialoge und Lightboxen: Fokus bleibt im Panel, Escape schließt,
// beim Schließen springt der Fokus zurück zum auslösenden Element.
// onKeyDown bekommt alle übrigen Tasten (z. B. Pfeiltasten zum Blättern).
export function useFocusTrap(
  open: boolean,
  panelRef: RefObject<HTMLElement | null>,
  onClose: () => void,
  onKeyDown?: (event: KeyboardEvent) => void,
) {
  // Aktuelle Callbacks ohne den Effekt neu zu starten (sonst springt der Fokus bei jedem Rendern).
  const onCloseRef = useRef(onClose);
  const onKeyDownRef = useRef(onKeyDown);
  onCloseRef.current = onClose;
  onKeyDownRef.current = onKeyDown;

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    panel?.querySelector<HTMLElement>(FOCUSABLE)?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !panel) {
        onKeyDownRef.current?.(event);
        return;
      }
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, [open, panelRef]);
}
