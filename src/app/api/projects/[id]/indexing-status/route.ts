import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  getProjectIndexingProgress,
  getProjectIndexingStatus,
  syncProjectIndexingStatus,
} from '@/lib/indexing-status';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 300;

async function authorize(projectId: string, write = false) {
  const session = await auth();
  if (!session?.user) return { error: 'Nicht autorisiert', status: 401 };
  const role = session.user.role;
  const isAdmin = role === 'ADMIN' || role === 'SUPERADMIN';
  if (write && !isAdmin) return { error: 'Nur Admins dürfen einen Abgleich starten.', status: 403 };
  if (!isAdmin && session.user.id !== projectId) {
    return { error: 'Zugriff verweigert', status: 403 };
  }
  return { session };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const permission = await authorize(id);
  if ('error' in permission) {
    return NextResponse.json({ message: permission.error }, { status: permission.status });
  }
  if (request.nextUrl.searchParams.get('progress') === '1') {
    try {
      return NextResponse.json(await getProjectIndexingProgress(id), {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      });
    } catch {
      return NextResponse.json({ message: 'Fortschritt noch nicht verfügbar' }, { status: 503 });
    }
  }
  return NextResponse.json(await getProjectIndexingStatus(id));
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const permission = await authorize(id, true);
  if ('error' in permission) {
    return NextResponse.json({ message: permission.error }, { status: permission.status });
  }

  try {
    const result = await syncProjectIndexingStatus(id, {
      force: true,
      maxInspections: 120,
      deadlineAt: Date.now() + 240_000,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Indexierungsabgleich fehlgeschlagen';
    return NextResponse.json({ message }, { status: 502 });
  }
}
