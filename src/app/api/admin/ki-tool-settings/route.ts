// src/app/api/admin/ki-tool-settings/route.ts
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { sql } from '@vercel/postgres';

export const dynamic = 'force-dynamic';

// GET - KI-Tool-Status für alle User abrufen (für Admin-Panel)
// oder für den aktuellen User (für Header-Check)
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const checkSelf = searchParams.get('checkSelf') === 'true';
    
    // Wenn nur der eigene Status geprüft werden soll (für Header)
    if (checkSelf) {
      const session = await auth();
      if (!session?.user?.id) {
        return NextResponse.json({ kiToolEnabled: true }); // Default: enabled
      }
      
      const { rows } = await sql`
        SELECT ki_tool_enabled FROM users WHERE id = ${session.user.id}::uuid
      `;
      
      // Default ist true wenn nicht gesetzt
      const isEnabled = rows[0]?.ki_tool_enabled !== false;
      
      return NextResponse.json({ kiToolEnabled: isEnabled });
    }
    
    // Admin-Abfrage: Alle User mit deaktiviertem KI-Tool
    const session = await auth();
    if (session?.user?.role !== 'SUPERADMIN') {
      return NextResponse.json({ message: 'Nur Superadmins' }, { status: 403 });
    }

    // Liste aller User mit KI-Tool Status
    const { rows } = await sql`
      SELECT id::text as id, email, role, domain, ki_tool_enabled
      FROM users
      ORDER BY role ASC, email ASC
    `;
    
    const disabledCount = rows.filter(u => u.ki_tool_enabled === false).length;
    
    return NextResponse.json({ 
      users: rows,
      disabledCount,
      totalCount: rows.length
    });
    
  } catch (error) {
    console.error('KI-Tool Settings GET error:', error);
    return NextResponse.json({ kiToolEnabled: true, users: [], disabledCount: 0 });
  }
}

// POST - KI-Tool für einzelne User aktivieren/deaktivieren
export async function POST(req: Request) {
  try {
    const session = await auth();
    
    // Nur SUPERADMIN darf KI-Tool verwalten
    if (session?.user?.role !== 'SUPERADMIN') {
      return NextResponse.json({ message: 'Nur Superadmins können das KI-Tool verwalten' }, { status: 403 });
    }

    const body = await req.json();
    const { userId, isEnabled, bulkDisable, bulkEnable } = body;

    // NEU: Bulk-Aktionen (alle außer SUPERADMIN)
    if (bulkDisable || bulkEnable) {
      const newState = bulkEnable === true;
      await sql`
        UPDATE users 
        SET ki_tool_enabled = ${newState}
        WHERE role != 'SUPERADMIN'
      `;
      console.log(`[KI-Tool] Bulk ${newState ? 'aktiviert' : 'deaktiviert'} für alle Non-Superadmins`);
      return NextResponse.json({ success: true, bulk: true, isEnabled: newState });
    }

    if (!userId) {
      return NextResponse.json({ message: 'userId ist erforderlich' }, { status: 400 });
    }

    // Prüfen ob der Ziel-User existiert
    const { rows: targetUser } = await sql`
      SELECT id, role, email FROM users WHERE id = ${userId}::uuid
    `;

    if (targetUser.length === 0) {
      return NextResponse.json({ message: 'Benutzer nicht gefunden' }, { status: 404 });
    }

    // SUPERADMIN kann nicht deaktiviert werden
    if (targetUser[0].role === 'SUPERADMIN') {
      return NextResponse.json({ 
        message: 'Das KI-Tool kann für Superadmins nicht deaktiviert werden' 
      }, { status: 403 });
    }

    // KI-Tool Status setzen
    await sql`
      UPDATE users 
      SET ki_tool_enabled = ${isEnabled === true}
      WHERE id = ${userId}::uuid
    `;

    console.log(`[KI-Tool] ${isEnabled ? 'Aktiviert' : 'Deaktiviert'} für User: ${targetUser[0].email}`);

    return NextResponse.json({ 
      success: true, 
      userId,
      isEnabled: isEnabled === true 
    });

  } catch (error: any) {
    console.error('KI-Tool Settings POST error:', error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

// PUT - Bulk-Update für mehrere User
export async function PUT(req: Request) {
  try {
    const session = await auth();
    
    if (session?.user?.role !== 'SUPERADMIN') {
      return NextResponse.json({ message: 'Nur Superadmins' }, { status: 403 });
    }

    const body = await req.json();
    const { userIds, isEnabled } = body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json({ message: 'userIds Array erforderlich' }, { status: 400 });
    }

    // Alle außer SUPERADMINs updaten
    const client = await sql.connect();
    
    try {
      await client.query('BEGIN');
      
      for (const userId of userIds) {
        await client.query(`
          UPDATE users 
          SET ki_tool_enabled = $1
          WHERE id = $2::uuid AND role != 'SUPERADMIN'
        `, [isEnabled === true, userId]);
      }
      
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    return NextResponse.json({ 
      success: true, 
      updatedCount: userIds.length,
      isEnabled: isEnabled === true 
    });

  } catch (error: any) {
    console.error('KI-Tool Settings PUT error:', error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
