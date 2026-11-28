// src/app/api/ai/chat/history/route.ts
// Gespeicherter DataMax-Chatverlauf: GET lädt das letzte Gespräch, DELETE leert es.
// Rechte wie im Chat: Kunden nur das eigene Projekt, Admins nur berechtigte Projekte.
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { canAccessProject } from '@/lib/project-access';
import { resolveChatProjectId } from '@/lib/ai-chat/history';
import { clearChatHistory, loadChatHistory } from '@/lib/ai-chat/history-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Angemeldete Person und berechtigtes Projekt, sonst die passende Fehlerantwort. */
async function resolveConversation(req: NextRequest) {
  const session = await auth();
  const resolution = await resolveChatProjectId(
    session?.user,
    new URL(req.url).searchParams.get('projectId'),
    canAccessProject,
  );
  if (!resolution.ok) return NextResponse.json({ error: resolution.error }, { status: resolution.status });
  return { userId: session!.user.id as string, projectId: resolution.projectId };
}

export async function GET(req: NextRequest) {
  const conversation = await resolveConversation(req);
  if (conversation instanceof NextResponse) return conversation;
  const messages = await loadChatHistory(conversation.userId, conversation.projectId);
  return NextResponse.json({ messages }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function DELETE(req: NextRequest) {
  const conversation = await resolveConversation(req);
  if (conversation instanceof NextResponse) return conversation;
  const cleared = await clearChatHistory(conversation.userId, conversation.projectId);
  if (!cleared) return NextResponse.json({ error: 'Verlauf konnte nicht gelöscht werden' }, { status: 503 });
  return NextResponse.json({ ok: true });
}
