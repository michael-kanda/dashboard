// src/app/api/admin/theme/route.ts
import { NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { auth } from '@/lib/auth';
import { themeSchema } from '@/lib/theme';
import { saveTheme, THEME_CACHE_TAG } from '@/lib/theme-store';

export const dynamic = 'force-dynamic';

/**
 * PUT: Speichert Farben, Rahmen, Schatten und Eckenradius für alle Nutzer (Nur für Superadmin)
 */
export async function PUT(req: Request) {
  const session = await auth();
  if (session?.user?.role !== 'SUPERADMIN') {
    return NextResponse.json({ message: 'Nur Superadmins können das Design ändern' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: 'Ungültige Anfrage' }, { status: 400 });
  }

  const parsed = themeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: 'Ungültige Werte: Farben bitte als #RRGGBB angeben' }, { status: 400 });
  }

  try {
    await saveTheme(parsed.data, session.user.email ?? 'superadmin');
  } catch (error) {
    if ((error as { code?: string } | null)?.code === '42P01') {
      return NextResponse.json(
        { message: 'Tabelle app_settings fehlt. Bitte zuerst Migration 008 ausführen.' },
        { status: 500 },
      );
    }
    console.error('[Theme] Speichern fehlgeschlagen:', error);
    return NextResponse.json({ message: 'Design konnte nicht gespeichert werden' }, { status: 500 });
  }

  revalidateTag(THEME_CACHE_TAG);
  revalidatePath('/', 'layout');
  return NextResponse.json({ theme: parsed.data });
}
