// src/app/api/admin/logos/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth'; // KORRIGIERT: Import von auth
import { sql } from '@vercel/postgres';

/**
 * GET: Lädt alle aktuellen Mandanten-Logos (Nur für Superadmin)
 */
export async function GET(_request: NextRequest) {
  const session = await auth(); // KORRIGIERT: auth() aufgerufen
  if (session?.user?.role !== 'SUPERADMIN') {
    return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 403 });
  }

  try {
    const { rows } = await sql`
      SELECT mandant_id, logo_url, updated_at 
      FROM mandanten_logos
      ORDER BY mandant_id ASC
    `;
    return NextResponse.json(rows);
  } catch (error) {
    return NextResponse.json({ 
      message: 'Fehler beim Laden der Logos', 
      error: error instanceof Error ? error.message : 'DB Fehler'
    }, { status: 500 });
  }
}

/**
 * POST: Speichert oder aktualisiert ein Mandanten-Logo (Nur für Superadmin)
 */
export async function POST(request: NextRequest) {
  const session = await auth(); // KORRIGIERT: auth() aufgerufen
  if (session?.user?.role !== 'SUPERADMIN') {
    return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 403 });
  }

  try {
    const { mandant_id, logo_url } = await request.json();

    if (!mandant_id || !logo_url) {
      return NextResponse.json({ message: 'mandant_id und logo_url sind erforderlich' }, { status: 400 });
    }
    
    // URL-Validierung (einfach)
    if (!logo_url.startsWith('http://') && !logo_url.startsWith('https://')) {
       return NextResponse.json({ message: 'Logo-URL muss mit http:// oder https:// beginnen' }, { status: 400 });
    }

    const { rows } = await sql`
      INSERT INTO mandanten_logos (mandant_id, logo_url, updated_at)
      VALUES (${mandant_id}, ${logo_url}, NOW())
      ON CONFLICT (mandant_id)
      DO UPDATE SET
        logo_url = EXCLUDED.logo_url,
        updated_at = NOW()
      RETURNING *;
    `;

    return NextResponse.json({ 
      message: 'Logo erfolgreich gespeichert', 
      data: rows[0] 
    }, { status: 200 });

  } catch (error) {
    return NextResponse.json({ 
      message: 'Fehler beim Speichern des Logos', 
      error: error instanceof Error ? error.message : 'DB Fehler'
    }, { status: 500 });
  }
}

/**
 * DELETE: Löscht ein Mandanten-Logo (Nur für Superadmin)
 */
export async function DELETE(request: NextRequest) {
  const session = await auth(); // KORRIGIERT: auth() aufgerufen
  if (session?.user?.role !== 'SUPERADMIN') {
    return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 403 });
  }

  try {
    const { mandant_id } = await request.json();

    if (!mandant_id) {
      return NextResponse.json({ message: 'mandant_id ist erforderlich' }, { status: 400 });
    }

    const { rowCount } = await sql`
      DELETE FROM mandanten_logos WHERE mandant_id = ${mandant_id};
    `;
    
    if (rowCount === 0) {
       return NextResponse.json({ message: 'Logo nicht gefunden' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Logo erfolgreich gelöscht' }, { status: 200 });

  } catch (error) {
    return NextResponse.json({ 
      message: 'Fehler beim Löschen des Logos', 
      error: error instanceof Error ? error.message : 'DB Fehler'
    }, { status: 500 });
  }
}
