// src/app/api/landingpages/[id]/route.ts
import { NextResponse, NextRequest } from 'next/server';
import { sql } from '@vercel/postgres';
import { auth } from '@/lib/auth';
import { canAccessLandingpage } from '@/lib/project-access';
import * as Brevo from '@getbrevo/brevo'; // ✅ Brevo direkt importiert

// --- Brevo Konfiguration (Wie in deiner Status-Route) ---
const apiInstance = new Brevo.TransactionalEmailsApi();
apiInstance.setApiKey(
  Brevo.TransactionalEmailsApiApiKeys.apiKey,
  process.env.BREVO_API_KEY || ''
);
const systemEmail = process.env.BREVO_SYSTEM_EMAIL || 'status@datapeak.at'; // Fallback wie in Status-Route

// Superadmins, zugewiesene Admins und der Projektinhaber dürfen auf die Landingpage zugreifen.
async function hasAccess(landingpageId: string, session: any) {
  return canAccessLandingpage(session?.user, landingpageId);
}

// GET - Landingpage Details abrufen
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const session = await auth();

  if (!(await hasAccess(id, session))) {
    return NextResponse.json({ message: 'Zugriff verweigert' }, { status: 403 });
  }

  try {
    const { rows } = await sql`
      SELECT 
        lp.*,
        u.domain,
        u.email as user_email
      FROM landingpages lp
      LEFT JOIN users u ON lp.user_id = u.id
      WHERE lp.id = ${id}
    `;

    if (rows.length === 0) {
      return NextResponse.json({ message: 'Landingpage nicht gefunden' }, { status: 404 });
    }

    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error('[API LANDINGPAGES GET /id]', error);
    return NextResponse.json({ message: 'Serverfehler' }, { status: 500 });
  }
}

// PUT - Landingpage aktualisieren (Mit Brevo E-Mail Versand)
export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const session = await auth();

  if (!(await hasAccess(id, session))) {
    return NextResponse.json({ message: 'Zugriff verweigert' }, { status: 403 });
  }

  const body = await req.json();
  const { url, haupt_keyword, weitere_keywords, suchvolumen, aktuelle_position, status, comment } = body;

  try {
    // 1. Alten Zustand holen (Prüfung auf Kommentar-Änderung)
    const { rows: currentRows } = await sql`
      SELECT lp.comment, lp.user_id, lp.url, u.domain 
      FROM landingpages lp
      LEFT JOIN users u ON lp.user_id = u.id
      WHERE lp.id = ${id}
    `;
    
    if (currentRows.length === 0) return NextResponse.json({ message: 'LP nicht gefunden' }, { status: 404 });
    
    const currentLP = currentRows[0];
    const oldComment = currentLP.comment || '';
    const newComment = comment || '';
    const lpOwnerId = currentLP.user_id;
    const lpUrl = currentLP.url;
    const customerDomain = currentLP.domain || 'Kunde';

    // 2. Update durchführen
    if (session?.user?.role === 'BENUTZER') {
       if (comment !== undefined) {
         await sql`UPDATE landingpages SET comment = ${comment}, updated_at = NOW() WHERE id = ${id}`;
       }
    } else {
       await sql`
        UPDATE landingpages
        SET 
          url = COALESCE(${url}, url),
          haupt_keyword = COALESCE(${haupt_keyword}, haupt_keyword),
          weitere_keywords = COALESCE(${weitere_keywords}, weitere_keywords),
          suchvolumen = COALESCE(${suchvolumen}, suchvolumen),
          aktuelle_position = COALESCE(${aktuelle_position}, aktuelle_position),
          status = COALESCE(${status}, status),
          comment = COALESCE(${comment}, comment),
          updated_at = NOW()
        WHERE id = ${id}
      `;
    }

    // 3. E-Mail Benachrichtigung via Brevo Senden
    // Nur wenn sich der Kommentar geändert hat UND nicht leer ist
    if (comment !== undefined && newComment !== oldComment && newComment.trim() !== '') {
      
      const actorRole = session?.user?.role;
      const actorEmail = session?.user?.email;

      // Fall A: Admin schreibt -> Kunde bekommt Info
      if (actorRole === 'ADMIN' || actorRole === 'SUPERADMIN') {
        const { rows: customerRows } = await sql`SELECT email FROM users WHERE id = ${lpOwnerId}`;
        if (customerRows.length > 0) {
          const customerEmail = customerRows[0].email;
          
          const sendSmtpEmail = new Brevo.SendSmtpEmail();
          sendSmtpEmail.sender = { email: systemEmail, name: 'Dashboard Info' };
          sendSmtpEmail.to = [{ email: customerEmail }];
          sendSmtpEmail.subject = `Neue Anmerkung zu: ${lpUrl}`;
          sendSmtpEmail.textContent = `Hallo,\n\nEs gibt eine neue Anmerkung zu Ihrer Landingpage "${lpUrl}".\n\nAnmerkung:\n"${newComment}"\n\nBitte prüfen Sie dies im Dashboard.`;

          try {
            await apiInstance.sendTransacEmail(sendSmtpEmail);
            console.log(`✅ Brevo-Mail gesendet an Kunde: ${customerEmail}`);
          } catch (err) {
            console.error('❌ Fehler beim Brevo-Versand an Kunde:', err);
          }
        }
      } 
      // Fall B: Kunde schreibt -> Admin(s) bekommen Info
      else if (actorRole === 'BENUTZER') {
        // Hole zugewiesene Admins
        const { rows: adminRows } = await sql`
          SELECT u.email 
          FROM users u
          INNER JOIN project_assignments pa ON u.id = pa.user_id
          WHERE pa.project_id = ${lpOwnerId}
        `;
        
        let recipients = adminRows.map(r => r.email);
        
        // Fallback: Wenn kein Admin zugewiesen, an Ersteller senden
        if (recipients.length === 0) {
           const { rows: creatorRows } = await sql`
             SELECT u.email FROM users u 
             JOIN users customer ON customer."createdByAdminId" = u.id 
             WHERE customer.id = ${lpOwnerId}
           `;
           if(creatorRows.length > 0) recipients.push(creatorRows[0].email);
        }

        // An alle Empfänger senden
        for (const adminEmail of recipients) {
          const sendSmtpEmail = new Brevo.SendSmtpEmail();
          sendSmtpEmail.sender = { email: systemEmail, name: 'Dashboard Info' };
          sendSmtpEmail.to = [{ email: adminEmail }];
          sendSmtpEmail.subject = `Kunden-Anmerkung: ${lpUrl}`;
          sendSmtpEmail.textContent = `Hallo,\n\nDer Kunde (${customerDomain}) hat eine Anmerkung zur Landingpage "${lpUrl}" verfasst.\n\nAnmerkung:\n"${newComment}"\n\nBitte im Redaktionsplan prüfen.`;

          try {
            await apiInstance.sendTransacEmail(sendSmtpEmail);
            console.log(`✅ Brevo-Mail gesendet an Admin: ${adminEmail}`);
          } catch (err) {
            console.error(`❌ Fehler beim Brevo-Versand an Admin (${adminEmail}):`, err);
          }
        }
      }
    }

    const { rows } = await sql`SELECT * FROM landingpages WHERE id = ${id}`;

    return NextResponse.json({ 
      message: 'Landingpage erfolgreich aktualisiert', 
      landingpage: rows[0] 
    });
  } catch (error) {
    console.error('[API LANDINGPAGES PUT /id]', error);
    return NextResponse.json({ message: 'Serverfehler' }, { status: 500 });
  }
}

// DELETE - Unverändert
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN')) {
      return NextResponse.json({ message: 'Zugriff verweigert' }, { status: 403 });
    }
    const { id } = await context.params;
    if (!(await hasAccess(id, session))) {
      return NextResponse.json({ message: 'Zugriff verweigert' }, { status: 403 });
    }
    await sql`DELETE FROM landingpages WHERE id = ${id}`;
    return NextResponse.json({ message: 'Landingpage erfolgreich gelöscht' });
  } catch (error) {
    console.error('[DELETE Landingpage] Fehler:', error);
    return NextResponse.json({ message: 'Fehler beim Löschen' }, { status: 500 });
  }
}
