// src/app/api/projects/[id]/route.ts

import { NextResponse, NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { sql } from '@vercel/postgres';
// Wir brauchen den User Typ für TypeScript Casts
import { User } from '@/lib/schemas'; 
import { getOrFetchGoogleData } from '@/lib/google-data-loader';

// Gleiche Begründung wie auf der Projekt-Seite: Diese Route führt denselben
// Daten-Loader aus; beim Cold-Load darf ein einzelner GA4-Report bis zu 55 s
// brauchen, plus waitUntil-Hintergrund-Refreshes.
export const maxDuration = 120;

interface UserRow {
  id: string;
  email: string;
  role: 'BENUTZER' | 'ADMIN' | 'SUPERADMIN';
  domain: string | null;
  gsc_site_url: string | null;
  ga4_property_id: string | null;
  semrush_project_id: string | null;
  semrush_tracking_id: string | null;
  semrush_tracking_id_02: string | null;
  google_ads_sheet_id: string | null;
  brand_keywords: string[] | null;
  google_genai_manual_data: any | null;
  project_locations: any[] | null;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    const { role, id: userId } = session.user;
    const resolvedParams = await context.params;
    const projectId = resolvedParams.id;

    const { searchParams } = new URL(request.url);
    const dateRange = searchParams.get('dateRange') || '30d';

    console.log('[/api/projects/[id]] GET Request');
    
    // ========== BERECHTIGUNGSPRÜFUNG ==========
    let hasAccess = false;
    
    if (role === 'SUPERADMIN') {
      hasAccess = true;
    } else if (role === 'ADMIN') {
      const { rows: accessCheck } = await sql`
        SELECT 1 FROM project_assignments
        WHERE user_id::text = ${userId} AND project_id::text = ${projectId}
        LIMIT 1;
      `;
      hasAccess = accessCheck.length > 0;
    } else if (role === 'BENUTZER') {
      hasAccess = userId === projectId;
    }

    if (!hasAccess) {
      return NextResponse.json({ message: 'Keine Berechtigung.' }, { status: 403 });
    }

    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS google_genai_manual_data JSONB NULL`;

    // ========== PROJEKT-DATEN LADEN ==========
    // WICHTIG: brand_keywords und project_locations MÜSSEN mitgeladen werden.
    // Diese Route und die Server-Seite (projekt/[id]/page.tsx) schreiben in
    // DENSELBEN google_data_cache-Key. Fehlen die Felder hier, produziert
    // dieser Lauf Daten OHNE localSeo und mit Auto-Detected-Brand-Keywords,
    // überschreibt damit den Cache der Seite — und "Lokale Sichtbarkeit"
    // verschwindet für die gesamte Cache-TTL aus dem Dashboard.
    const { rows } = await sql<UserRow>`
      SELECT
        id::text as id, email, role, domain,
        gsc_site_url, ga4_property_id,
        semrush_project_id, semrush_tracking_id, semrush_tracking_id_02,
        google_ads_sheet_id,
        brand_keywords,
        google_genai_manual_data,
        COALESCE(project_locations, '[]'::jsonb) as project_locations
      FROM users
      WHERE id::text = ${projectId}
    `;

    if (rows.length === 0) {
      return NextResponse.json({ message: 'Projekt nicht gefunden.' }, { status: 404 });
    }

    const project = rows[0];

    // ========== GOOGLE-DATEN LADEN ==========
    try {
      // Wir bauen ein Objekt, das dem 'User'-Schema entspricht
      // Wichtig: null-Werte aus der DB zu undefined konvertieren, da Zod/TS das oft lieber mag
      const projectData: Partial<User> & { project_locations?: any[]; brand_keywords?: string[] | null } = {
        id: project.id, // ID ist Pflicht und hier vorhanden
        email: project.email,
        role: project.role,
        domain: project.domain || undefined,
        gsc_site_url: project.gsc_site_url || undefined,
        ga4_property_id: project.ga4_property_id || undefined,
        semrush_project_id: project.semrush_project_id || undefined,
        semrush_tracking_id: project.semrush_tracking_id || undefined,
        semrush_tracking_id_02: project.semrush_tracking_id_02 || undefined,
        google_ads_sheet_id: project.google_ads_sheet_id || undefined,
        // Konfigurierte Brand-Keywords durchreichen — sonst startet der Loader
        // die Auto-Detection und überschreibt die konfigurierten Keywords in
        // der DB (getBrandKeywordsForUser schreibt erkannte Keywords zurück).
        brand_keywords: project.brand_keywords ?? undefined,
        google_genai_manual_data: project.google_genai_manual_data ?? undefined,
        // Standorte für "Lokale Sichtbarkeit" durchreichen — sonst fehlt
        // localSeo im erzeugten (und gecachten!) Dashboard-Datensatz.
        project_locations: project.project_locations ?? [],
      };
      
      // TypeScript beschwert sich, weil getOrFetchGoogleData(Partial<User>) aufgerufen wird,
      // aber intern User.id braucht. Wir erzwingen den Cast, da wir wissen, dass ID da ist.
      const dashboardData = await getOrFetchGoogleData(projectData as any, dateRange);

      if (!dashboardData) {
        return NextResponse.json({
          message: 'Keine Google-Daten (GSC/GA4 nicht konfiguriert).',
          kpis: {}, charts: {}, topQueries: [], aiTraffic: undefined
        }, { status: 200 });
      }

      return NextResponse.json(dashboardData);

    } catch (googleError) {
      console.error('[/api/projects/[id]] ❌ Fehler:', googleError);
      return NextResponse.json({
        message: 'Fehler beim Laden der Daten',
        error: String(googleError)
      }, { status: 200 });
    }

  } catch (error) {
    console.error('[/api/projects/[id]] Serverfehler:', error);
    return NextResponse.json({ message: 'Serverfehler' }, { status: 500 });
  }
}
