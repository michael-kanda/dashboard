// src/lib/ai-chat/history.ts
// Gesprächsgedächtnis des DataMax-Chats: prüft den mitgeschickten Verlauf, kürzt ihn auf ein
// festes Maß und entscheidet, für welches Projekt eine Anfrage gilt.
// Ohne Datenbank und ohne Pfad-Aliase, damit die Tests die Datei direkt laden können.

export interface ChatHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** Höchstens so viele frühere Nachrichten gehen mit an die KI. */
export const HISTORY_MAX_MESSAGES = 10;
/** Obergrenze für den gesamten Verlauf in Zeichen (grob 3.000 Tokens). */
export const HISTORY_MAX_CHARS = 12_000;
/** Lange Antworten werden für das Gedächtnis auf diese Länge gekürzt. */
export const HISTORY_MESSAGE_MAX_CHARS = 3_000;
/** So viele Nachrichten lädt der Chat beim Öffnen. */
export const HISTORY_LOAD_LIMIT = 50;
/** Nach dieser Frist löscht DataPeak gespeicherte Nachrichten. */
export const HISTORY_RETENTION_DAYS = 90;
/** Obergrenze einer gespeicherten Nachricht in Zeichen. */
export const HISTORY_STORE_MAX_CHARS = 20_000;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Liest einen mitgeschickten Verlauf; alles, was nicht passt, fällt weg. */
export function parseHistory(raw: unknown): ChatHistoryMessage[] {
  if (!Array.isArray(raw)) return [];
  const messages: ChatHistoryMessage[] = [];
  // Nur das Ende ist relevant; sehr lange Listen werden gar nicht erst ganz gelesen.
  for (const item of raw.slice(-HISTORY_LOAD_LIMIT)) {
    if (!item || typeof item !== 'object') continue;
    const { role, content } = item as { role?: unknown; content?: unknown };
    if ((role !== 'user' && role !== 'assistant') || typeof content !== 'string') continue;
    const text = content.trim();
    if (text) messages.push({ role, content: text });
  }
  return messages;
}

function clip(text: string, maxChars: number): string {
  return text.length <= maxChars ? text : `${text.slice(0, maxChars - 1).trimEnd()}…`;
}

interface TrimOptions {
  maxMessages?: number;
  maxChars?: number;
  maxMessageChars?: number;
}

/**
 * Kürzt den Verlauf für die KI: neueste Nachrichten zuerst, höchstens maxMessages und maxChars.
 * Unbeantwortete Fragen fallen weg, aufeinanderfolgende Antworten werden zusammengelegt,
 * und der Verlauf beginnt immer mit einer Frage.
 */
export function trimHistory(messages: ChatHistoryMessage[], options: TrimOptions = {}): ChatHistoryMessage[] {
  const maxMessages = options.maxMessages ?? HISTORY_MAX_MESSAGES;
  const maxChars = options.maxChars ?? HISTORY_MAX_CHARS;
  const maxMessageChars = options.maxMessageChars ?? HISTORY_MESSAGE_MAX_CHARS;
  if (maxMessages <= 0 || maxChars <= 0) return [];

  const merged: ChatHistoryMessage[] = [];
  for (const message of messages) {
    const last = merged[merged.length - 1];
    if (!last || last.role !== message.role) merged.push({ ...message });
    // Zwei Fragen hintereinander: die frühere blieb unbeantwortet und zählt nicht.
    else if (message.role === 'user') last.content = message.content;
    else last.content = `${last.content}\n\n${message.content}`;
  }
  // Eine Frage ohne Antwort am Ende würde sich mit der neuen Frage vermischen.
  while (merged.length > 0 && merged[merged.length - 1].role === 'user') merged.pop();

  const kept: ChatHistoryMessage[] = [];
  let total = 0;
  for (let i = merged.length - 1; i >= 0 && kept.length < maxMessages; i--) {
    const content = clip(merged[i].content, maxMessageChars);
    if (total + content.length > maxChars) break;
    kept.unshift({ role: merged[i].role, content });
    total += content.length;
  }
  while (kept.length > 0 && kept[0].role !== 'user') kept.shift();
  return kept;
}

/** Nachrichten für die KI: gekürzter Verlauf plus die aktuelle Frage. */
export function buildChatMessages(history: unknown, message: string, options?: TrimOptions): ChatHistoryMessage[] {
  return [...trimHistory(parseHistory(history), options), { role: 'user', content: message }];
}

type AccessUser = { id?: string | null; role?: string | null };
type AccessCheck = (user: AccessUser, projectId: string) => Promise<boolean>;

export type ChatProjectResolution =
  | { ok: true; projectId: string }
  | { ok: false; status: 400 | 401 | 403; error: string };

/**
 * Für welches Projekt gilt die Anfrage? Ohne Angabe das eigene, sonst nur mit Berechtigung
 * (canAccessProject: Kunden ausschließlich das eigene, Admins nur zugewiesene Projekte).
 */
export async function resolveChatProjectId(
  user: AccessUser | null | undefined,
  requestedProjectId: unknown,
  canAccess: AccessCheck,
): Promise<ChatProjectResolution> {
  if (!user?.id) return { ok: false, status: 401, error: 'Nicht autorisiert' };
  const requested = typeof requestedProjectId === 'string' ? requestedProjectId.trim() : '';
  const projectId = requested || user.id;
  if (!UUID_PATTERN.test(projectId)) return { ok: false, status: 400, error: 'Ungültige Projekt-ID' };
  if (projectId !== user.id && !(await canAccess(user, projectId))) {
    return { ok: false, status: 403, error: 'Zugriff verweigert' };
  }
  return { ok: true, projectId };
}
