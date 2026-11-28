// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://47443b3ff6edf164f0a58f55f12bd41e@o4510442605051905.ingest.de.sentry.io/4510442606755920",

  // Jede zehnte Anfrage reicht, um langsame Stellen zu finden.
  tracesSampleRate: 0.1,

  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Datensparsam: keine IP-Adressen, Cookies oder Benutzerdaten an Sentry (Datenschutzerklärung).
  sendDefaultPii: false,
});
