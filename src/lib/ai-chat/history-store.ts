// src/lib/ai-chat/history-store.ts
// Gespeicherter DataMax-Chatverlauf pro Person und Projekt (Tabelle datamax_chat_messages,
// Migration 016). Fehlt die Tabelle oder ist die Datenbank nicht erreichbar, läuft der Chat
// ohne Speicherung weiter.
import { sql } from '@vercel/postgres';
import { logger } from '@/lib/logger';
import {
  HISTORY_LOAD_LIMIT,
  HISTORY_RETENTION_DAYS,
  HISTORY_STORE_MAX_CHARS,
  type ChatHistoryMessage,
} from './history';

export interface StoredChatMessage extends ChatHistoryMessage {
  id: string;
  createdAt: string;
}

/** Die letzten Nachrichten eines Gesprächs, älteste zuerst; nichts älter als die Frist. */
export async function loadChatHistory(userId: string, projectId: string): Promise<StoredChatMessage[]> {
  try {
    const { rows } = await sql<{ id: string; role: 'user' | 'assistant'; content: string; created_at: Date }>`
      SELECT id::text AS id, role, content, created_at
      FROM datamax_chat_messages
      WHERE user_id = ${userId}::uuid
        AND project_id = ${projectId}::uuid
        AND created_at > NOW() - make_interval(days => ${HISTORY_RETENTION_DAYS})
      ORDER BY created_at DESC, id DESC
      LIMIT ${HISTORY_LOAD_LIMIT}
    `;
    return rows.reverse().map((row) => ({
      id: row.id,
      role: row.role,
      content: row.content,
      createdAt: new Date(row.created_at).toISOString(),
    }));
  } catch (error) {
    logger.warn('[DataMax-Verlauf] Laden fehlgeschlagen', error);
    return [];
  }
}

/** Speichert eine Nachricht und räumt dabei alte Nachrichten auf. */
export async function saveChatMessage(
  userId: string,
  projectId: string,
  message: ChatHistoryMessage,
): Promise<void> {
  const content = message.content.trim().slice(0, HISTORY_STORE_MAX_CHARS);
  if (!content) return;
  try {
    await sql`
      INSERT INTO datamax_chat_messages (user_id, project_id, role, content)
      VALUES (${userId}::uuid, ${projectId}::uuid, ${message.role}, ${content})
    `;
    if (message.role === 'user') await purgeExpiredChatMessages(userId);
  } catch (error) {
    logger.warn('[DataMax-Verlauf] Speichern fehlgeschlagen', error);
  }
}

/** Löscht Nachrichten nach Ablauf der Frist: immer die eigenen, gelegentlich alle. */
async function purgeExpiredChatMessages(userId: string): Promise<void> {
  try {
    if (Math.random() < 0.05) {
      await sql`
        DELETE FROM datamax_chat_messages
        WHERE created_at < NOW() - make_interval(days => ${HISTORY_RETENTION_DAYS})
      `;
    } else {
      await sql`
        DELETE FROM datamax_chat_messages
        WHERE user_id = ${userId}::uuid
          AND created_at < NOW() - make_interval(days => ${HISTORY_RETENTION_DAYS})
      `;
    }
  } catch (error) {
    logger.warn('[DataMax-Verlauf] Aufräumen fehlgeschlagen', error);
  }
}

/** „Chat leeren“: löscht das Gespräch dieser Person in diesem Projekt. */
export async function clearChatHistory(userId: string, projectId: string): Promise<boolean> {
  try {
    await sql`
      DELETE FROM datamax_chat_messages
      WHERE user_id = ${userId}::uuid AND project_id = ${projectId}::uuid
    `;
    return true;
  } catch (error) {
    logger.warn('[DataMax-Verlauf] Löschen fehlgeschlagen', error);
    return false;
  }
}
