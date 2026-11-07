// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import { isNonBrowserRuntimeEvent } from "@/lib/sentry-filter";

Sentry.init({
  dsn: "https://47443b3ff6edf164f0a58f55f12bd41e@o4510442605051905.ingest.de.sentry.io/4510442606755920",

  // Add optional integrations for additional features
  integrations: [
    Sentry.replayIntegration(),
  ],

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 1,
  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Define how likely Replay events are sampled.
  // This sets the sample rate to be 10%. You may want this to be 100% while
  // in development and sample at a lower rate in production
  replaysSessionSampleRate: 0.1,

  // Define how likely Replay events are sampled when an error occurs.
  replaysOnErrorSampleRate: 1.0,

  // Enable sending user PII (Personally Identifiable Information)
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
  sendDefaultPii: true,

  // Bots, die die Seite in Deno o. Ä. ausführen, erzeugen Fehler ohne echte Nutzer (z. B. fehlender
  // Response-Stream beim Prefetch). Diese Meldungen nicht an Sentry senden.
  beforeSend(event) {
    return isNonBrowserRuntimeEvent(event) ? null : event;
  },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;