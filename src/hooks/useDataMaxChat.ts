// src/hooks/useDataMaxChat.ts
'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { HISTORY_MAX_MESSAGES, type ChatHistoryMessage } from '@/lib/ai-chat/history';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  /** Fehler- und Limit-Hinweise gehören nicht ins Gesprächsgedächtnis. */
  excludeFromContext?: boolean;
}

/** Tageslimit aus der API; limit null = unbegrenzt. */
export interface DataMaxUsage {
  limit: number | null;
  remaining: number | null;
}

function usageFromHeaders(headers: Headers): DataMaxUsage | null {
  const limit = headers.get('X-DataMax-Limit');
  const remaining = headers.get('X-DataMax-Remaining');
  if (limit === null || remaining === null) return null;
  return { limit: Number(limit), remaining: Number(remaining) };
}

interface UseDataMaxChatOptions {
  projectId?: string;
  dateRange?: string;
  /** Vorperiode oder Vorjahr; bestimmt, womit DataMax Veränderungen vergleicht. */
  comparisonMode?: 'vorperiode' | 'vorjahr';
  /** API-Pfad; die öffentliche Demo nutzt /api/ai/demo-chat. */
  endpoint?: string;
  /** Gespeicherter Verlauf (laden und leeren); ohne Angabe bleibt das Gedächtnis in der Sitzung. */
  historyEndpoint?: string | null;
  onError?: (error: string) => void;
}

/**
 * Prüft, ob ein Error ein Stream-Abbruch ist (Browser-Disconnect, Timeout, etc.).
 * Diese Errors werden NICHT als echte Fehler behandelt – sie sind erwartbar
 * (z.B. wenn User wegnavigiert oder die Vercel-Function ein Timeout hat).
 */
/** Verlauf für die KI: fertige Nachrichten ohne Hinweise; gekürzt wird zusätzlich auf dem Server. */
function historyForRequest(messages: ChatMessage[]): ChatHistoryMessage[] {
  return messages
    .filter((msg) => !msg.isStreaming && !msg.excludeFromContext && msg.content.trim())
    .slice(-HISTORY_MAX_MESSAGES * 2)
    .map(({ role, content }) => ({ role, content }));
}

function isStreamDisconnectError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message?.toLowerCase() || '';
  return (
    error.name === 'AbortError' ||
    msg.includes('error in input stream') ||
    msg.includes('network error') ||
    msg.includes('failed to fetch') ||
    msg.includes('the user aborted') ||
    msg.includes('aborted')
  );
}

export function useDataMaxChat(options: UseDataMaxChatOptions = {}) {
  const { projectId, dateRange = '30d', comparisonMode = 'vorperiode', endpoint = '/api/ai/chat', historyEndpoint = null, onError } = options;
  // Kundenansicht der Admins (?ansicht=kunde): Antworten wie fuer den Kunden anfordern.
  const customerView = useSearchParams().get('ansicht') === 'kunde';

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const [usage, setUsage] = useState<DataMaxUsage | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  const historyKeyRef = useRef<string | null>(null);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // ----------------------------------------------------------------------
  // Cleanup beim Unmount: Laufende Streams abbrechen, damit der Browser
  // nicht "TypeError: Error in input stream" wirft, wenn die Component
  // verschwindet während noch ein Stream läuft.
  // ----------------------------------------------------------------------
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []);

  // Suggested Questions laden
  const loadSuggestedQuestions = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (projectId) params.set('projectId', projectId);
      params.set('dateRange', dateRange);

      const response = await fetch(`${endpoint}?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setSuggestedQuestions(data.questions || []);
        if (data.usage) setUsage(data.usage);
      }
    } catch (error) {
      console.warn('Konnte Suggested Questions nicht laden:', error);
    }
  }, [projectId, dateRange, endpoint]);

  // Gespeicherten Verlauf laden (einmal pro Projekt), solange noch nichts geschrieben wurde.
  const loadHistory = useCallback(async () => {
    if (!historyEndpoint) return;
    const key = projectId ?? '';
    if (historyKeyRef.current === key) return;
    historyKeyRef.current = key;
    setHistoryLoading(true);
    try {
      const params = new URLSearchParams();
      if (projectId) params.set('projectId', projectId);
      const response = await fetch(`${historyEndpoint}?${params.toString()}`, { cache: 'no-store' });
      if (!response.ok) return;
      const data: { messages?: Array<{ id: string; role: 'user' | 'assistant'; content: string; createdAt: string }> } =
        await response.json();
      const stored = (data.messages ?? []).map((msg) => ({
        id: `stored-${msg.id}`,
        role: msg.role,
        content: msg.content,
        timestamp: new Date(msg.createdAt),
      }));
      if (stored.length > 0) setMessages((prev) => (prev.length === 0 ? stored : prev));
    } catch (error) {
      console.warn('Konnte den DataMax-Verlauf nicht laden:', error);
      historyKeyRef.current = null;
    } finally {
      setHistoryLoading(false);
    }
  }, [historyEndpoint, projectId]);

  // Nachricht senden
  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isLoading) return;

      // Abbrechen falls noch ein Request läuft
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();
      const currentController = abortControllerRef.current;

      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: content.trim(),
        timestamp: new Date(),
      };

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        isStreaming: true,
      };

      const history = historyForRequest(messagesRef.current);
      setMessages((prev) => [...prev, userMessage, assistantMessage]);
      setIsLoading(true);

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: content.trim(),
            history,
            projectId,
            dateRange,
            vergleich: comparisonMode,
            customerView,
          }),
          signal: currentController.signal,
        });

        const headerUsage = usageFromHeaders(response.headers);
        if (headerUsage) setUsage(headerUsage);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          if (errorData.limitReached) {
            setUsage({ limit: errorData.limit ?? null, remaining: 0 });
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessage.id
                  ? { ...msg, content: errorData.error, isStreaming: false, excludeFromContext: true }
                  : msg
              )
            );
            return;
          }
          throw new Error(errorData.error || `Fehler: ${response.status}`);
        }

        // Suggested Questions aus Header extrahieren (Base64 encoded)
        const suggestedHeader = response.headers.get('X-Suggested-Questions');
        if (suggestedHeader) {
          try {
            // Base64 aus UTF-8-Bytes: atob liefert Bytes, TextDecoder macht daraus wieder Umlaute
            const bytes = Uint8Array.from(atob(suggestedHeader), (c) => c.charCodeAt(0));
            setSuggestedQuestions(JSON.parse(new TextDecoder().decode(bytes)));
          } catch {
            console.warn('Konnte Suggested Questions nicht decodieren');
          }
        }

        // -------------------------------------------------------------
        // Stream lesen – mit dediziertem try/catch und cleanup, damit
        // Stream-Abbrüche (Disconnect, Timeout, Backend-Error mid-stream)
        // sauber abgefangen werden und nicht als unhandled errors
        // beim Browser landen.
        // -------------------------------------------------------------
        const reader = response.body?.getReader();
        if (!reader) throw new Error('Kein Response-Stream');

        const decoder = new TextDecoder();
        let fullContent = '';
        let streamWasInterrupted = false;

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            fullContent += chunk;

            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessage.id
                  ? { ...msg, content: fullContent }
                  : msg
              )
            );
          }
        } catch (streamError) {
          // User-Abort → komplett still behandeln
          if ((streamError as Error).name === 'AbortError') {
            return;
          }

          // Stream-Disconnect (Vercel-Timeout, Browser-Disconnect, etc.)
          // → wenn schon Content da ist, behalten wir die Teil-Antwort.
          // → wenn KEIN Content da ist, werfen wir's an den outer catch.
          if (isStreamDisconnectError(streamError)) {
            if (!fullContent) {
              throw streamError;
            }
            streamWasInterrupted = true;
            console.warn(
              '[DataMax] Stream-Verbindung unterbrochen, zeige Teilantwort'
            );
          } else {
            // Echter, unerwarteter Fehler → outer catch
            throw streamError;
          }
        } finally {
          // Reader-Lock IMMER freigeben, damit kein Memory-Leak entsteht
          try {
            reader.releaseLock();
          } catch {
            /* noop */
          }
        }

        // Streaming-Flag entfernen (egal ob full oder partial)
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessage.id
              ? {
                  ...msg,
                  content: streamWasInterrupted
                    ? `${fullContent}\n\n_⚠️ Verbindung wurde unterbrochen – Antwort möglicherweise unvollständig._`
                    : fullContent,
                  isStreaming: false,
                }
              : msg
          )
        );
      } catch (error) {
        // User-Abbruch (z.B. Page-Unmount) → still
        if ((error as Error).name === 'AbortError') {
          return;
        }

        // Stream-Disconnect → freundliche Meldung, KEIN onError-Callback
        // (sonst spamt das Sentry, obwohl's nur ein Verbindungsabbruch ist)
        if (isStreamDisconnectError(error)) {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessage.id
                ? {
                    ...msg,
                    content:
                      msg.content ||
                      '⚠️ Verbindung unterbrochen. Bitte erneut versuchen.',
                    isStreaming: false,
                    excludeFromContext: !msg.content,
                  }
                : msg
            )
          );
          return;
        }

        // Echter Fehler → Meldung anzeigen + onError triggern
        const errorMessage =
          error instanceof Error ? error.message : 'Unbekannter Fehler';

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessage.id
              ? {
                  ...msg,
                  content: `❌ ${errorMessage}`,
                  isStreaming: false,
                  excludeFromContext: true,
                }
              : msg
          )
        );

        onError?.(errorMessage);
      } finally {
        setIsLoading(false);
        // Nur null setzen, wenn der aktuelle Controller noch aktiv ist
        // (sonst überschreiben wir evtl. einen NEUEN Controller eines
        // parallelen sendMessage-Aufrufs)
        if (abortControllerRef.current === currentController) {
          abortControllerRef.current = null;
        }
      }
    },
    [projectId, dateRange, comparisonMode, customerView, isLoading, onError, endpoint]
  );

  // Chat leeren: lokal sofort, der gespeicherte Verlauf wird auf dem Server gelöscht.
  const clearChat = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setMessages([]);
    setIsLoading(false);
    if (!historyEndpoint) return;
    try {
      const params = new URLSearchParams();
      if (projectId) params.set('projectId', projectId);
      const response = await fetch(`${historyEndpoint}?${params.toString()}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(`Fehler: ${response.status}`);
    } catch (error) {
      console.warn('Konnte den DataMax-Verlauf nicht löschen:', error);
      onError?.('Der gespeicherte Verlauf konnte nicht gelöscht werden.');
    }
  }, [historyEndpoint, projectId, onError]);

  // Letzte Nachricht abbrechen
  const cancelRequest = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
    }
  }, []);

  return {
    messages,
    isLoading,
    suggestedQuestions,
    usage,
    historyLoading,
    sendMessage,
    clearChat,
    cancelRequest,
    loadSuggestedQuestions,
    loadHistory,
  };
}
