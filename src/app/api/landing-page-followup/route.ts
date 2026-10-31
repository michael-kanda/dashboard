// src/app/api/landing-page-followup/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { canAccessProject } from '@/lib/project-access';
import { sql } from '@vercel/postgres';
import { getLandingPageFollowUpPaths } from '@/lib/google-api';

export async function GET(request: NextRequest) {
  try {
    // Auth Check (NextAuth v5 Pattern)
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parameter
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const dateRange = searchParams.get('dateRange') || '30d';
    const landingPage = searchParams.get('landingPage');

    if (!landingPage) {
      return NextResponse.json({ error: 'landingPage Parameter fehlt' }, { status: 400 });
    }

    // User & Projekt laden
    let ga4PropertyId: string | null = null;
    let siteUrl: string | null = null;

    if (projectId && !(await canAccessProject(session.user, projectId))) {
      return NextResponse.json({ error: 'Zugriff verweigert' }, { status: 403 });
    }

    if (projectId) {
      // WICHTIG: Projekte sind technisch User-Einträge in der 'users'-Tabelle.
      // projectId ist also eine user.id
      const { rows: projectRows } = await sql`
        SELECT ga4_property_id, gsc_site_url, domain 
        FROM users 
        WHERE id = ${projectId}::uuid
      `;
      if (projectRows.length > 0) {
        ga4PropertyId = projectRows[0].ga4_property_id;
        siteUrl = projectRows[0].gsc_site_url || projectRows[0].domain;
      }
    } else {
      // User-basiert (Fallback auf den aktuell eingeloggten User)
      const { rows: userRows } = await sql`
        SELECT ga4_property_id, gsc_site_url, domain 
        FROM users 
        WHERE email = ${session.user.email}
      `;
      if (userRows.length > 0) {
        ga4PropertyId = userRows[0].ga4_property_id;
        siteUrl = userRows[0].gsc_site_url || userRows[0].domain;
      }
    }

    if (!ga4PropertyId) {
      console.warn(`[Landing Page Followup] No GA4 Property ID found. ProjectId: ${projectId}, User: ${session.user.email}`);
      return NextResponse.json({ 
        data: null, 
        error: 'Keine GA4 Property ID gefunden' 
      });
    }

    // Datumsberechnung
    const end = new Date();
    end.setDate(end.getDate() - 1); // Gestern (vollständiger Tag)
    
    const start = new Date(end);
    let days = 30;

    switch (dateRange) {
      case '7d': days = 7; break;
      case '30d': days = 30; break;
      case '3m': days = 90; break;
      case '6m': days = 180; break;
      case '12m': days = 365; break;
      case '18m': days = 548; break;
      case '24m': days = 730; break;
    }
    
    start.setDate(end.getDate() - days);

    const startDateStr = start.toISOString().split('T')[0];
    const endDateStr = end.toISOString().split('T')[0];

    console.log(`[Landing Page Followup] Loading data for ${ga4PropertyId}, page: ${landingPage}`);

    // Folgepfade von GA4 abrufen
    const followUpData = await getLandingPageFollowUpPaths(
      ga4PropertyId,
      landingPage,
      startDateStr,
      endDateStr,
      siteUrl || undefined
    );

    return NextResponse.json({ 
      success: true,
      data: followUpData,
      meta: {
        landingPage,
        dateRange,
        startDate: startDateStr,
        endDate: endDateStr
      }
    });

  } catch (error) {
    console.error('[Landing Page Followup API] Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
