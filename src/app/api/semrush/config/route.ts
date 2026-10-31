// src/app/api/semrush/config/route.ts (KORRIGIERT - Mit Kampagne 2 Support)
import { NextResponse, NextRequest } from 'next/server';
import { auth } from '@/lib/auth'; // KORRIGIERT: Import von auth
import { canAccessProject } from '@/lib/project-access';
import { sql } from '@vercel/postgres';

/**
 * GET /api/semrush/config
 * Lädt die Semrush-Konfiguration (Project ID, Tracking ID, Tracking ID 02) für einen User
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth(); // KORRIGIERT: auth() aufgerufen

    if (!session?.user?.email) {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    const { role, id } = session.user;
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    // Bestimme welcher User geladen werden soll
    let targetUserId: string;

    if (projectId) {
      // Admin greift auf anderes Projekt zu
      if (role !== 'ADMIN' && role !== 'SUPERADMIN') {
        return NextResponse.json({ message: 'Zugriff verweigert' }, { status: 403 });
      }

      if (role === 'ADMIN') {
        // Prüfe ob Admin Zugriff auf dieses Projekt hat
        const { rows: assignments } = await sql`
          SELECT 1 
          FROM project_assignments 
          WHERE user_id::text = ${id} 
          AND project_id::text = ${projectId}
        `;

        if (assignments.length === 0) {
          return NextResponse.json({ message: 'Zugriff verweigert' }, { status: 403 });
        }
      }

      targetUserId = projectId;
    } else {
      // User greift auf eigene Daten zu
      targetUserId = id;
    }

    // ✅ KORREKTUR: Lade auch semrush_tracking_id_02
    const { rows } = await sql`
      SELECT 
        semrush_project_id as "semrushProjectId",
        semrush_tracking_id as "semrushTrackingId",
        semrush_tracking_id_02 as "semrushTrackingId02",
        updated_at as "lastUpdated"
      FROM users 
      WHERE id::text = ${targetUserId}
    `;

    if (rows.length === 0) {
      return NextResponse.json({ message: 'Benutzer nicht gefunden' }, { status: 404 });
    }

    const user = rows[0];

    return NextResponse.json({
      semrushProjectId: user.semrushProjectId,
      semrushTrackingId: user.semrushTrackingId,
      semrushTrackingId02: user.semrushTrackingId02,
      lastUpdated: user.lastUpdated
    });

  } catch (error) {
    console.error('[/api/semrush/config] GET Error:', error);
    return NextResponse.json({ 
      message: 'Fehler beim Laden der Konfiguration',
      error: 'Interner Fehler'
    }, { status: 500 });
  }
}

/**
 * PUT /api/semrush/config
 * Aktualisiert die Semrush-Konfiguration (Project ID, Tracking ID, Tracking ID 02)
 * ✅ Mit intelligenter Cache-Invalidierung
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await auth(); // KORRIGIERT: auth() aufgerufen

    if (!session?.user?.email) {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    const { role, id } = session.user;
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    // Semrush-IDs bestimmen, welche Agentur-Daten ein Projekt sieht: nur Admins setzen sie.
    if (role !== 'ADMIN' && role !== 'SUPERADMIN') {
      return NextResponse.json({ message: 'Nur Admins dürfen Semrush-IDs ändern' }, { status: 403 });
    }
    if (projectId && !(await canAccessProject(session.user, projectId))) {
      return NextResponse.json({ message: 'Zugriff verweigert' }, { status: 403 });
    }
    const targetUserId = projectId || id;

    // ✅ KORREKTUR: Parse auch semrushTrackingId02
    const body = await request.json();
    const { semrushProjectId, semrushTrackingId, semrushTrackingId02 } = body;

    console.log('[/api/semrush/config] Updating config for user:', targetUserId);
    console.log('[/api/semrush/config] New values:', { 
      semrushProjectId, 
      semrushTrackingId, 
      semrushTrackingId02 
    });

    // ✅ NEU: Lade alte Werte VOR dem Update für intelligente Cache-Invalidierung
    const { rows: oldDataRows } = await sql`
      SELECT 
        semrush_project_id,
        semrush_tracking_id,
        semrush_tracking_id_02
      FROM users 
      WHERE id::text = ${targetUserId}
    `;

    const oldData = oldDataRows.length > 0 ? oldDataRows[0] : null;

    // ✅ KORREKTUR: Update auch semrush_tracking_id_02
    const { rows } = await sql`
      UPDATE users 
      SET 
        semrush_project_id = ${semrushProjectId || null},
        semrush_tracking_id = ${semrushTrackingId || null},
        semrush_tracking_id_02 = ${semrushTrackingId02 || null},
        updated_at = NOW()
      WHERE id::text = ${targetUserId}
      RETURNING 
        semrush_project_id as "semrushProjectId", 
        semrush_tracking_id as "semrushTrackingId",
        semrush_tracking_id_02 as "semrushTrackingId02",
        updated_at as "lastUpdated"
    `;

    if (rows.length === 0) {
      return NextResponse.json({ message: 'Benutzer nicht gefunden' }, { status: 404 });
    }

    const updatedUser = rows[0];

    // ✅ INTELLIGENTE CACHE-INVALIDIERUNG: Nur betroffene Kampagnen invalidieren
    try {
      const campaignsToInvalidate: string[] = [];

      if (oldData) {
        // Prüfe ob Kampagne 1 sich geändert hat
        const kampagne1Changed = 
          oldData.semrush_project_id !== semrushProjectId || 
          oldData.semrush_tracking_id !== semrushTrackingId;

        if (kampagne1Changed) {
          campaignsToInvalidate.push('kampagne_1');
          console.log('[/api/semrush/config] Kampagne 1 wurde geändert - Cache wird invalidiert');
        }

        // Prüfe ob Kampagne 2 sich geändert hat
        const kampagne2Changed = 
          oldData.semrush_tracking_id_02 !== semrushTrackingId02;

        if (kampagne2Changed) {
          campaignsToInvalidate.push('kampagne_2');
          console.log('[/api/semrush/config] Kampagne 2 wurde geändert - Cache wird invalidiert');
        }
      } else {
        // Keine alten Daten vorhanden - invalidiere sicherheitshalber beide
        campaignsToInvalidate.push('kampagne_1', 'kampagne_2');
        console.log('[/api/semrush/config] Keine alten Daten - beide Caches werden invalidiert');
      }

      // Invalidiere nur die betroffenen Kampagnen
      for (const campaign of campaignsToInvalidate) {
        await sql`
          DELETE FROM semrush_keywords_cache 
          WHERE user_id::text = ${targetUserId} AND campaign = ${campaign}
        `;
        
        console.log(`[/api/semrush/config] ✅ Cache für ${campaign} invalidiert`);
      }

      if (campaignsToInvalidate.length === 0) {
        console.log('[/api/semrush/config] ℹ️ Keine Änderungen - Cache bleibt erhalten');
      }

      // Invalidiere auch den allgemeinen Semrush-Daten-Cache
      await sql`
        DELETE FROM semrush_data_cache 
        WHERE user_id::text = ${targetUserId}
      `;
      console.log('[/api/semrush/config] ✅ Allgemeiner Semrush-Cache invalidiert');
      
    } catch (cacheError) {
      console.error('[/api/semrush/config] Fehler beim Invalidieren des Cache:', cacheError);
      // Nicht kritisch, weiter machen
    }

    console.log('[/api/semrush/config] ✅ Config gespeichert');

    return NextResponse.json({
      semrushProjectId: updatedUser.semrushProjectId,
      semrushTrackingId: updatedUser.semrushTrackingId,
      semrushTrackingId02: updatedUser.semrushTrackingId02,
      lastUpdated: updatedUser.lastUpdated
    });

  } catch (error) {
    console.error('[/api/semrush/config] PUT Error:', error);
    return NextResponse.json({ 
      message: 'Fehler beim Speichern der Konfiguration',
      error: 'Interner Fehler'
    }, { status: 500 });
  }
}
