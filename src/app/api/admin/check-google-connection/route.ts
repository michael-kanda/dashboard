// src/app/api/admin/check-google-connection/route.ts
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { checkGa4Property, checkGscSite } from '@/lib/google/connection-check';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * POST: Prüft GSC-Property und GA4-Property live mit dem Dienstkonto (Nur für Admins).
 */
export async function POST(req: Request) {
  const session = await auth();
  const role = session?.user?.role;
  if (role !== 'ADMIN' && role !== 'SUPERADMIN') {
    return NextResponse.json({ message: 'Zugriff verweigert' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const gscSiteUrl = typeof body?.gscSiteUrl === 'string' ? body.gscSiteUrl.slice(0, 200).trim() : '';
  const ga4PropertyId = typeof body?.ga4PropertyId === 'string' ? body.ga4PropertyId.slice(0, 60).trim() : '';

  const [gsc, ga4] = await Promise.all([
    gscSiteUrl ? checkGscSite(gscSiteUrl) : Promise.resolve(null),
    ga4PropertyId ? checkGa4Property(ga4PropertyId) : Promise.resolve(null),
  ]);
  return NextResponse.json({ gsc, ga4 });
}
