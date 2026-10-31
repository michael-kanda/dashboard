// src/app/api/landingpages/[id]/status/route.ts
// KORRIGIERT: Mit E-Mail Debounce-Logik

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { sql } from '@vercel/postgres';
import * as Brevo from '@getbrevo/brevo'; 

const apiInstance = new Brevo.TransactionalEmailsApi();

apiInstance.setApiKey(
  Brevo.TransactionalEmailsApiApiKeys.apiKey,
  process.env.BREVO_API_KEY || ''
);

const systemEmail = process.env.BREVO_SYSTEM_EMAIL || 'status@datapeak.at';

// +++ NEU: Cooldown-Periode in Minuten +++
const NOTIFICATION_COOLDOWN_MINUTES = 30;

type StatusType = 'Offen' | 'In Prüfung' | 'Gesperrt' | 'Freigegeben';

// (Hilfsfunktion createNotification bleibt unverändert)
async function createNotification(
  userId: string,
  message: string,
  type: 'info' | 'success' | 'warning',
  landingpageId: number
) {
  try {
    await sql`
      INSERT INTO notifications (user_id, message, type, related_landingpage_id)
      VALUES (${userId}, ${message}, ${type}, ${landingpageId});
    `;
    console.log('✅ Benachrichtigung erstellt für User:', userId);
  } catch (error) {
    console.error('❌ Fehler beim Erstellen der Benachrichtigung:', error);
  }
}

// *** PUT-Funktion zum Aktualisieren des Status ***
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: landingpageId } = await params;
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    const body = await request.json();
    const { status: newStatus } = body as { status: StatusType };

    console.log('[Status Update] User:', session.user.email, 'Role:', session.user.role);
    console.log('[Status Update] Landingpage ID:', landingpageId);
    console.log('[Status Update] Neuer Status:', newStatus);

    const validStatuses: StatusType[] = ['Offen', 'In Prüfung', 'Gesperrt', 'Freigegeben'];
    if (!validStatuses.includes(newStatus)) {
      return NextResponse.json({ message: 'Ungültiger Status' }, { status: 400 });
    }

    // Lade die Landingpage mit User-Info (inkl. last_admin_notification_sent)
    const { rows: landingpages } = await sql`
      SELECT
        lp.*,
        u.id as user_id,
        u.email as user_email,
        u.domain as user_domain,
        u.last_admin_notification_sent -- +++ NEU: Zeitstempel laden +++
      FROM landingpages lp
      INNER JOIN users u ON lp.user_id = u.id
      WHERE lp.id = ${landingpageId};
    `;

    if (landingpages.length === 0) {
      return NextResponse.json({ message: 'Landingpage nicht gefunden' }, { status: 404 });
    }

    const landingpage = landingpages[0];
    const oldStatus = landingpage.status;
    const customerUserId = landingpage.user_id; // ID des Kunden, dem die LP gehört

    console.log('[Status Update] Alter Status:', oldStatus);
    console.log('[Status Update] Landingpage gehört zu:', landingpage.user_email);

    // Berechtigungsprüfung (bleibt gleich)
    const isAdmin = session.user.role === 'ADMIN' || session.user.role === 'SUPERADMIN';
    const isOwner = session.user.id === customerUserId;
    const currentUser = session.user;

    if (session.user.role === 'BENUTZER') {
      if (!isOwner) {
        return NextResponse.json({ message: 'Sie dürfen nur Ihre eigenen Landingpages bearbeiten' }, { status: 403 });
      }
      if (newStatus !== 'Freigegeben' && newStatus !== 'Gesperrt') {
        return NextResponse.json({ message: 'Sie dürfen nur zwischen "Freigegeben" und "Gesperrt" wechseln' }, { status: 403 });
      }
    }

    if (isAdmin) {
      if (session.user.role === 'ADMIN') {
        const { rows: accessCheck } = await sql`
          SELECT 1
          FROM project_assignments
          WHERE user_id::text = ${session.user.id}
          AND project_id::text = ${customerUserId};
        `;
        if (accessCheck.length === 0) {
          return NextResponse.json({ message: 'Sie haben keinen Zugriff auf dieses Projekt' }, { status: 403 });
        }
      }
    }

    // Status-Update durchführen
    await sql`
      UPDATE landingpages
      SET 
        status = ${newStatus},
        updated_at = NOW() -- ✅ NEU
      WHERE id = ${landingpageId};
    `;
    console.log('✅ Status erfolgreich aktualisiert');

    // === Log-Eintrag erstellen (bleibt gleich) ===
    try {
      let actionPerformer = '';
      if (isAdmin) {
        actionPerformer = `${currentUser.role} (${currentUser.email})`;
      } else if (isOwner) {
        actionPerformer = `Kunde (${currentUser.email})`;
      } else {
        actionPerformer = `System (${currentUser.email})`;
      }
      const actionDescription = `Status von "${oldStatus}" auf "${newStatus}" geändert durch ${actionPerformer}`;
      await sql`
        INSERT INTO landingpage_logs (landingpage_id, user_id, user_email, action)
        VALUES (${landingpageId}, ${currentUser.id}::uuid, ${currentUser.email}, ${actionDescription});
      `;
      console.log('✅ Log-Eintrag erstellt für Landingpage:', landingpageId);
    } catch (logError) {
      console.error('❌ Fehler beim Erstellen des Log-Eintrags:', logError);
    }

    // === Benachrichtigungen erstellen (Logik angepasst) ===
    const pageUrl = new URL(landingpage.url).pathname;

    // 1. Benachrichtigung an den Kunden (wenn Admin ändert - bleibt gleich)
    if (isAdmin && oldStatus !== newStatus) {
      let customerMessage = '';
      if (newStatus === 'In Prüfung') customerMessage = `Ihre Landingpage "${pageUrl}" wartet auf Ihre Freigabe.`;
      else if (newStatus === 'Offen') customerMessage = `Ihre Landingpage "${pageUrl}" wurde auf "Offen" gesetzt.`;
      else if (newStatus === 'Freigegeben') customerMessage = `Ihre Landingpage "${pageUrl}" wurde vom Admin freigegeben.`;
      else if (newStatus === 'Gesperrt') customerMessage = `Ihre Landingpage "${pageUrl}" wurde vom Admin gesperrt.`;

      if (customerMessage) {
        await createNotification(
          customerUserId,
          customerMessage,
          newStatus === 'Freigegeben' ? 'success' : newStatus === 'Gesperrt' ? 'warning' : 'info',
          parseInt(landingpageId)
        );
      }
    }

    // 2. Benachrichtigung an Admins (wenn Kunde ändert - *** MIT DEBOUNCE ***)
    if (isOwner && !isAdmin && oldStatus !== newStatus) {
      
      // +++ START: Debounce-Prüfung +++
      const lastSentTime = landingpage.last_admin_notification_sent ? new Date(landingpage.last_admin_notification_sent).getTime() : 0;
      const now = new Date().getTime();
      const timeSinceLastEmail = (now - lastSentTime) / (1000 * 60); // in Minuten

      let shouldSendEmail = true;
      if (timeSinceLastEmail < NOTIFICATION_COOLDOWN_MINUTES) {
        shouldSendEmail = false;
        console.log(`[Debounce] E-Mail für Kunde ${customerUserId} zurückgehalten. Letzter Versand vor ${timeSinceLastEmail.toFixed(1)} Min.`);
      } else {
        console.log(`[Debounce] E-Mail für Kunde ${customerUserId} wird gesendet. (Letzter Versand: ${lastSentTime === 0 ? 'Nie' : timeSinceLastEmail.toFixed(1) + ' Min. her'})`);
      }
      // +++ ENDE: Debounce-Prüfung +++

      // Finde alle Admins (bleibt gleich)
      const { rows: admins } = await sql`
        SELECT DISTINCT u.id, u.email
        FROM users u
        INNER JOIN project_assignments pa ON u.id = pa.user_id
        WHERE pa.project_id::text = ${customerUserId}
        AND u.role = 'ADMIN';
      `;
      const { rows: superadmins } = await sql`
        SELECT id, email FROM users WHERE role = 'SUPERADMIN';
      `;
      const allAdmins = [...admins, ...superadmins];
      
      const customerDomain = landingpage.user_domain || landingpage.user_email;

      // +++ KORREKTUR: Generische Nachrichten (nicht mehr Seitenspezifisch) +++
      const adminMessage = `Kunde "${customerDomain}" hat mit der Freigabe von Landingpages begonnen (z.B. "${pageUrl}" auf "${newStatus}").`;
      const emailSubject = `Neue Status-Updates von ${customerDomain} gibt Landingpages frei`;
      const emailTextContent = `Hallo,\n\nDer Kunde "${customerDomain}" hat soeben mit der Freigabe von Landingpages begonnen (z.B. wurde die Seite "${pageUrl}" auf "${newStatus}" gesetzt).\n\nDies ist eine Sammel-Benachrichtigung. Weitere Aktionen dieses Kunden innerhalb der nächsten 30 Minuten werden keine neue E-Mail auslösen.\n\nAlle Details zu den einzelnen Änderungen finden Sie im Redaktionsplan oder in der Benachrichtigungs-Glocke im Dashboard.\n\nGesendet von,\nDeinem Data Peak Dashboard`;

      for (const admin of allAdmins) {
        // Interne Benachrichtigung wird IMMER erstellt (wichtig!)
        await createNotification(
          admin.id,
          adminMessage, // Generische Nachricht
          newStatus === 'Freigegeben' ? 'success' : 'warning',
          parseInt(landingpageId)
        );

        // *** E-Mail-Versand (nur wenn Cooldown abgelaufen ist) ***
        if (shouldSendEmail) {
          const sendSmtpEmail = new Brevo.SendSmtpEmail();
          sendSmtpEmail.sender = { email: systemEmail, name: 'Projekt-Updates' }; 
          sendSmtpEmail.to = [{ email: admin.email }]; 
          sendSmtpEmail.subject = emailSubject; // Generischer Betreff
          sendSmtpEmail.textContent = emailTextContent; // Generischer Inhalt

          try {
            await apiInstance.sendTransacEmail(sendSmtpEmail);
            console.log(`✅ E-Mail gesendet an Admin: ${admin.email} (für Kunde ${customerUserId})`);
          } catch (emailError) {
            console.error(`❌ Fehler beim Senden der E-Mail an ${admin.email}:`, emailError);
          }
        }
      } // Ende der Admin-Schleife

      // +++ NEU: Zeitstempel in DB aktualisieren, NACHDEM die Schleife lief +++
      if (shouldSendEmail && allAdmins.length > 0) {
        await sql`
          UPDATE users
          SET last_admin_notification_sent = NOW()
          WHERE id::text = ${customerUserId};
        `;
        console.log(`[Debounce] Zeitstempel für Kunde ${customerUserId} aktualisiert.`);
      }
    }

    // Erfolgs-Response (bleibt gleich)
    return NextResponse.json({
      message: 'Status erfolgreich aktualisiert',
      oldStatus,
      newStatus,
      landingpage: {
        id: landingpage.id,
        url: landingpage.url,
        status: newStatus
      }
    });

  } catch (error) {
    console.error('❌ Fehler beim Status-Update:', error);
    return NextResponse.json(
      {
        message: 'Fehler beim Aktualisieren des Status',
        error: 'Unbekannter Fehler'
      },
      { status: 500 }
    );
  }
}
