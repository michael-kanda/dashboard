import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { auth } from '@/lib/auth';

type PositionPayload = {
  id?: unknown;
  mapX?: unknown;
  mapY?: unknown;
};

function normalizePercent(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.min(100, Math.round(parsed * 10) / 10));
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (session?.user?.role !== 'SUPERADMIN') {
    return NextResponse.json({ message: 'Nur Superadmins dürfen Karten-Pins bearbeiten.' }, { status: 403 });
  }

  const { id: projectId } = await context.params;
  const body = await request.json().catch(() => null);
  const positions = Array.isArray(body?.positions) ? body.positions as PositionPayload[] : [];

  if (positions.length === 0) {
    return NextResponse.json({ message: 'Keine Positionen übergeben.' }, { status: 400 });
  }

  const normalizedPositions = new Map<string, { mapX: number; mapY: number }>();
  positions.forEach((position) => {
    const id = typeof position.id === 'string' ? position.id.trim() : '';
    const mapX = normalizePercent(position.mapX);
    const mapY = normalizePercent(position.mapY);
    if (id && mapX !== null && mapY !== null) {
      normalizedPositions.set(id, { mapX, mapY });
    }
  });

  if (normalizedPositions.size === 0) {
    return NextResponse.json({ message: 'Keine gültigen Positionen übergeben.' }, { status: 400 });
  }

  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS project_locations JSONB DEFAULT '[]'::jsonb`;

  const { rows } = await sql`
    SELECT COALESCE(project_locations, '[]'::jsonb) as project_locations
    FROM users
    WHERE id = ${projectId}::uuid
  `;

  if (rows.length === 0) {
    return NextResponse.json({ message: 'Projekt nicht gefunden.' }, { status: 404 });
  }

  const currentLocations = Array.isArray(rows[0].project_locations) ? rows[0].project_locations : [];
  const updatedLocations = currentLocations.map((location: any, index: number) => {
    const id = typeof location?.id === 'string' && location.id.trim()
      ? location.id.trim()
      : `location-${index + 1}`;
    const position = normalizedPositions.get(id);
    return position ? { ...location, id, ...position } : { ...location, id };
  });

  await sql`
    UPDATE users
    SET project_locations = ${JSON.stringify(updatedLocations)}::jsonb
    WHERE id = ${projectId}::uuid
  `;

  try {
    await sql`DELETE FROM google_data_cache WHERE user_id = ${projectId}::uuid`;
  } catch (cacheError) {
    console.warn(`[Local SEO Pins] Cache konnte nicht invalidiert werden:`, cacheError);
  }

  return NextResponse.json({ success: true, project_locations: updatedLocations });
}
