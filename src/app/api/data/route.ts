import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { sql } from '@vercel/postgres';
// ✅ WICHTIG: UserSchema für Validierung, User Typ ist hier nicht zwingend nötig
import { UserSchema } from '@/lib/schemas'; 
import { getOrFetchGoogleData } from '@/lib/google-data-loader';

export async function GET(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    const { role, id } = session.user;
    const { searchParams } = new URL(request.url);
    const dateRange = searchParams.get('dateRange') || '30d';
    const projectId = searchParams.get('projectId'); 

    console.log('[/api/data] GET Request');
    console.log('[/api/data] User:', session.user.email, 'Role:', role, 'ID:', id);
    console.log('[/api/data] DateRange:', dateRange, 'ProjectId:', projectId || 'none');

    // ========================================
    // 1. ADMIN/SUPERADMIN mit projectId (Einzelnes Dashboard ansehen)
    // ========================================
    if ((role === 'ADMIN' || role === 'SUPERADMIN') && projectId) {
      console.log('[/api/data] Admin/Superadmin lädt Dashboard für Projekt:', projectId);

      const { rows } = await sql`
        SELECT *
        FROM users
        WHERE id::text = ${projectId}
        AND role = 'BENUTZER'
      `;
      
      if (rows.length === 0) return NextResponse.json({ message: 'Projekt nicht gefunden' }, { status: 404 });

      // Berechtigungsprüfung für normale Admins
      if (role === 'ADMIN') {
        const { rows: assignments } = await sql`
          SELECT 1 FROM project_assignments
          WHERE user_id::text = ${id} AND project_id::text = ${projectId}
        `;
        if (assignments.length === 0) return NextResponse.json({ message: 'Zugriff verweigert.' }, { status: 403 });
      }

      // ✅ ZOD VALIDIERUNG (Repariert permissions: null -> [])
      const parseResult = UserSchema.safeParse(rows[0]);
      
      if (!parseResult.success) {
        console.error("User Data Invalid:", parseResult.error);
        return NextResponse.json({ message: 'Projektdaten fehlerhaft' }, { status: 500 });
      }
      
      const project = parseResult.data;

      // Caching-Loader aufrufen
      const dashboardData = await getOrFetchGoogleData(project, dateRange);

      if (!dashboardData) {
        return NextResponse.json({
          pending: true,
          message: 'Der angeforderte Zeitraum wurde zur Synchronisierung eingereiht.'
        }, { status: 202 });
      }
      return NextResponse.json(dashboardData);
    }

    // ========================================
    // 2. SUPERADMIN ohne projectId (Liste aller Projekte)
    // ========================================
    if (role === 'SUPERADMIN' && !projectId) {
      console.log('[/api/data] Lade Projektliste für SUPERADMIN');
      // ❌ Hier stand vorher sql<User>. Wir entfernen <User>, da wir nur eine Teilliste laden.
      const { rows: projects } = await sql`
        SELECT id::text AS id, email, domain
        FROM users WHERE role = 'BENUTZER' ORDER BY email ASC;
      `;
      return NextResponse.json({ role, projects });
    }

    // ========================================
    // 3. ADMIN ohne projectId (Liste zugewiesener Projekte)
    // ========================================
    if (role === 'ADMIN' && !projectId) {
      console.log('[/api/data] Lade zugewiesene Projekte für ADMIN:', id);
      // ❌ Auch hier entfernen wir <User>
      const { rows: projects } = await sql`
        SELECT u.id::text AS id, u.email, u.domain
        FROM users u
        INNER JOIN project_assignments pa ON u.id = pa.project_id
        WHERE pa.user_id::text = ${id} AND u.role = 'BENUTZER'
        ORDER BY u.email ASC;
      `;
      return NextResponse.json({ role, projects });
    }

    // ========================================
    // 4. BENUTZER (Eigenes Dashboard)
    // ========================================
    if (role === 'BENUTZER') {
      console.log('[/api/data] Lade Dashboard für BENUTZER');
      
      const { rows } = await sql`
        SELECT *
        FROM users WHERE id::text = ${id}
      `;
      
      if (rows.length === 0) return NextResponse.json({ message: 'Benutzer nicht gefunden.' }, { status: 404 });

      // ✅ ZOD VALIDIERUNG
      const parseResult = UserSchema.safeParse(rows[0]);
      
      if (!parseResult.success) {
        console.error("User Data Invalid:", parseResult.error);
        return NextResponse.json({ message: 'Benutzerdaten fehlerhaft' }, { status: 500 });
      }
      
      const user = parseResult.data;

      const dashboardData = await getOrFetchGoogleData(user, dateRange);

      if (!dashboardData) {
        return NextResponse.json({
          pending: true,
          message: 'Der angeforderte Zeitraum wurde zur Synchronisierung eingereiht.'
        }, { status: 202 });
      }
      return NextResponse.json(dashboardData);
    }

    return NextResponse.json({ message: 'Unbekannte Benutzerrolle.' }, { status: 403 });

  } catch (error) {
    console.error('[/api/data] Schwerwiegender Fehler im Handler:', error);
    const errorMessage = error instanceof Error ? error.message : 'Interner Serverfehler.';
    return NextResponse.json({
      message: `Fehler beim Abrufen der Dashboard-Daten: ${errorMessage}`,
    }, { status: 500 });
  }
}
