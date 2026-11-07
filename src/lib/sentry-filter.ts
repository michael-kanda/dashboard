// Fehler aus Nicht-Browser-Umgebungen (z. B. Bots auf Deno-Basis) erkennen: ihre Stacktraces
// enthalten Runtime-Frames wie ext:core/01_core.js, die es in echten Browsern nicht gibt.
type StackFrame = { filename?: string };
type SentryLikeEvent = { exception?: { values?: { stacktrace?: { frames?: StackFrame[] } }[] } };

export function isNonBrowserRuntimeEvent(event: SentryLikeEvent): boolean {
  return (event.exception?.values ?? []).some((value) =>
    (value.stacktrace?.frames ?? []).some((frame) => frame.filename?.startsWith('ext:')),
  );
}
