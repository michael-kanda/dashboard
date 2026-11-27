// src/components/marketing/DataMaxChatPreview.tsx
// Nachgebautes DataMax-Chatfenster für die Landingpage (Beispielgespräch mit Demo-Daten).
// Nur Darstellung: keine Eingabe, Farben über Design-Tokens, daher hell und dunkel passend.
import { ArrowClockwise, Robot, Send, X } from 'react-bootstrap-icons';

export default function DataMaxChatPreview() {
  return (
    <figure className="w-full">
      <div className="overflow-hidden rounded-[16px] border border-border bg-surface shadow-[0_24px_60px_-32px_rgba(0,0,0,0.35)]">
        {/* Kopf wie im Dashboard */}
        <div className="flex items-center gap-3 border-b border-border-subtle px-4 py-3">
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px] bg-accent-tint text-accent" aria-hidden="true">
            <Robot size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold leading-tight text-heading">DataMax</p>
            <p className="text-[12px] text-muted">SEO &amp; Analytics Assistent</p>
          </div>
          <span className="flex items-center gap-3 text-muted" aria-hidden="true">
            <ArrowClockwise size={14} />
            <X size={18} />
          </span>
        </div>

        {/* Gespräch */}
        <div className="flex flex-col gap-3 bg-surface-secondary px-4 py-5 text-[14px] leading-[1.5]">
          <p className="max-w-[85%] self-end rounded-[14px] rounded-br-[4px] bg-accent-solid px-3.5 py-2.5 text-white">
            Warum ist der Traffic diesen Monat gestiegen?
          </p>
          <div className="max-w-[92%] self-start rounded-[14px] rounded-bl-[4px] border border-border bg-surface px-3.5 py-3 text-body">
            <p>
              <span className="font-semibold text-heading">Vor allem wegen /scheidung.</span>{' '}
              Die Seite holt 132 Klicks aus Google (+38&nbsp;%), meist über „scheidungsanwalt wien
              erstberatung“ auf Position 2,9. Dazu kommen 39 Besuche aus ChatGPT.
            </p>
          </div>
          <p className="max-w-[80%] self-start rounded-[14px] rounded-bl-[4px] border border-border bg-surface px-3.5 py-2.5 text-body">
            Mein Tipp: Ergänzen Sie dort einen Abschnitt zu den Kosten.
          </p>
        </div>

        {/* Eingabezeile (nur Darstellung) */}
        <div className="flex items-center gap-2 border-t border-border-subtle bg-surface px-4 py-3" aria-hidden="true">
          <span className="flex-1 rounded-control border border-border bg-surface-secondary px-3 py-2 text-[14px] text-muted">
            Frag DataMax …
          </span>
          <span className="flex h-9 w-9 items-center justify-center rounded-control bg-accent-solid text-white">
            <Send size={15} />
          </span>
        </div>
      </div>
      <figcaption className="mt-3 text-[13px] leading-[1.5] text-muted">
        Beispielgespräch mit den Zahlen der Demo-Kanzlei.
      </figcaption>
    </figure>
  );
}
