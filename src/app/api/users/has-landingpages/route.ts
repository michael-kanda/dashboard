// src/app/api/users/has-landingpages/route.ts
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { sql } from '@vercel/postgres';

export const dynamic = 'force-dynamic';

// GET - Prüft ob der aktuelle User Landingpages hat
export async function GET() {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ hasLandingpages: false });
    }

    const userId = session.user.id;

    // Zähle Landingpages für diesen User
    const { rows } = await sql`
      SELECT COUNT(*)::int as count
      FROM landingpages
      WHERE user_id::text = ${userId}
    `;

    const count = rows[0]?.count || 0;

    return NextResponse.json({ 
      hasLandingpages: count > 0,
      count 
    });

  } catch (error) {
    console.error('Has-Landingpages Check error:', error);
    // Im Fehlerfall lieber anzeigen (false positive besser als false negative)
    return NextResponse.json({ hasLandingpages: true, count: 0 });
  }
}
