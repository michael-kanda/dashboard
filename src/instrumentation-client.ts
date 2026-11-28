// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { isNonBrowserRuntimeEvent } from "@/lib/sentry-filter";

// Zod prüft sonst per Function("") (eval), ob es Validierungen kompilieren darf. Das verstößt gegen
// die Content Security Policy (kein unsafe-eval, src/lib/csp.ts); ohne JIT validiert Zod genauso.
z.config({ jitless: true });

Sentry.init({
  dsn: "https://47443b3ff6edf164f0a58f55f12bd41e@o4510442605051905.ingest.de.sentry.io/4510442606755920",

  // Sitzungsaufzeichnung nur, wenn ein Fehler auftritt. Texte, Eingaben, Bilder und Videos
  // werden dabei verdeckt, damit keine Kundendaten oder Kennzahlen bei Sentry landen.
  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      maskAllInputs: true,
      blockAllMedia: true,
    }),
  ],

  // Jeder zehnte Seitenaufruf reicht, um langsame Stellen zu finden.
  tracesSampleRate: 0.1,
  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Keine Aufzeichnung ohne Fehler, bei Fehlern immer (verdeckt, siehe oben).
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,

  // Datensparsam: keine IP-Adressen, Cookies oder Benutzerdaten an Sentry (Datenschutzerklärung).
  sendDefaultPii: false,

  // Bots, die die Seite in Deno o. Ä. ausführen, erzeugen Fehler ohne echte Nutzer (z. B. fehlender
  // Response-Stream beim Prefetch). Diese Meldungen nicht an Sentry senden.
  beforeSend(event) {
    return isNonBrowserRuntimeEvent(event) ? null : event;
  },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
