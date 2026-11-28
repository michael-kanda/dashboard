-- Gespeicherter DataMax-Chatverlauf pro Person und Projekt.
-- Der Code (src/lib/ai-chat/history-store.ts) lädt die letzten Nachrichten beim Öffnen des Chats,
-- „Chat leeren“ löscht sie, und Nachrichten älter als 90 Tage räumt er selbst auf.
-- Die öffentliche Demo speichert nichts.

CREATE TABLE IF NOT EXISTS datamax_chat_messages (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS datamax_chat_messages_conversation_idx
  ON datamax_chat_messages (user_id, project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS datamax_chat_messages_created_idx
  ON datamax_chat_messages (created_at);
