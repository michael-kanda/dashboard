// src/app/api/users/[id]/landingpages/route.ts

import { NextResponse, NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { canAccessProject } from '@/lib/project-access';
import { sql } from '@vercel/postgres';
import { Landingpage } from '@/types';
import * as XLSX from '@e965/xlsx';
import Papa from 'papaparse';
import { getGoogleSheetData } from '@/lib/google-api';

interface RouteParams {
  params: Promise<{ id: string }>;
}

function extractSheetId(url: string): string | null {
  const regex = /\/d\/([a-zA-Z0-9-_]+)/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

// Robuste Hilfsfunktion zum Finden von Werten in CSV/Excel Zeilen
// Ignoriert Groß-/Kleinschreibung und verschiedene Schreibweisen
function getRowValue(row: any, possibleKeys: string[]): string | null {
  if (!row || typeof row !== 'object') return null;
  
  const rowKeys = Object.keys(row);
  
  for (const targetKey of possibleKeys) {
    const normalizedTarget = targetKey.toLowerCase().trim();

    const foundKey = rowKeys.find(k => {
      // Entferne BOM, Anführungszeichen, Trimmen
      const normalizedKey = k.replace(/^\uFEFF/, '').replace(/^"|"$/g, '').trim().toLowerCase();
      return normalizedKey === normalizedTarget;
    });

    if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null) {
      const val = String(row[foundKey]).trim();
      // Leere Strings als null zurückgeben
      if (val === '') return null;
      // Entferne umschließende Anführungszeichen vom Wert
      return val.replace(/^"|"$/g, '');
    }
  }
  return null;
}

// Hilfsfunktion zum sicheren Parsen von Zahlen
// Gibt null zurück, wenn der Wert leer oder keine gültige Zahl ist
function parseOptionalInt(value: string | null): number | null {
  if (!value) return null;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? null : parsed;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id: userId } = await params;
    const session = await auth();
    
    if (!session?.user || !(await canAccessProject(session.user, userId))) {
      return NextResponse.json({ message: 'Nicht autorisiert.' }, { status: 401 });
    }

    const { rows: landingpages } = await sql<Landingpage>`
      SELECT *
      FROM landingpages
      WHERE user_id::text = ${userId}
      ORDER BY id DESC
    `;

    return NextResponse.json(landingpages);
  } catch (error) {
    console.error('Fehler in /api/users/[id]/landingpages GET:', error);
    return NextResponse.json({ message: 'Interner Serverfehler.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: userId } = await params;
    const session = await auth();

    if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN')) {
      return NextResponse.json({ message: 'Nicht autorisiert. Nur Admins dürfen Landingpages importieren.' }, { status: 403 });
    }
    if (!(await canAccessProject(session.user, userId))) {
      return NextResponse.json({ message: 'Zugriff auf dieses Projekt verweigert.' }, { status: 403 });
    }

    let rawData: any[] = [];
    const contentType = request.headers.get('content-type') || '';

    // --- GOOGLE SHEET ---
    if (contentType.includes('application/json')) {
      const body = await request.json();
      const { sheetUrl } = body;
      if (!sheetUrl) return NextResponse.json({ message: 'Keine URL.' }, { status: 400 });
      
      const sheetId = extractSheetId(sheetUrl);
      if (!sheetId) return NextResponse.json({ message: 'Ungültige URL.' }, { status: 400 });

      try {
        rawData = await getGoogleSheetData(sheetId);
      } catch (err) {
        console.error('Google-Sheet-Import Fehler:', err);
        return NextResponse.json({ 
          message: 'Zugriff auf Google Sheet fehlgeschlagen.',
          error: 'Interner Fehler'
        }, { status: 403 });
      }
    } 
    // --- DATEI UPLOAD ---
    else {
      const formData = await request.formData();
      const file = formData.get('file') as File;

      if (!file) return NextResponse.json({ message: 'Keine Datei.' }, { status: 400 });

      const fileName = file.name.toLowerCase();

      if (fileName.endsWith('.csv')) {
        const text = await file.text();
        const parseResult = Papa.parse(text, {
          header: true,
          skipEmptyLines: true,
          dynamicTyping: false, // Wir parsen Zahlen manuell für mehr Kontrolle
          transformHeader: (h) => h.trim().replace(/^"|"$/g, '') 
        });
        
        if (parseResult.errors.length > 0) console.error('CSV Fehler:', parseResult.errors);
        rawData = parseResult.data;
      } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(Buffer.from(arrayBuffer), { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        // raw: false sorgt dafür, dass wir Strings bekommen, die wir selbst parsen
        rawData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { raw: false });
      } else {
        return NextResponse.json({ message: 'Ungültiges Format.' }, { status: 400 });
      }
    }

    if (!rawData || rawData.length === 0) {
      return NextResponse.json({ message: 'Keine Daten gefunden.' }, { status: 400 });
    }

    let importedCount = 0;

    // Transaktion für Performance und Sicherheit
    const client = await sql.connect();
    
    try {
      await client.query('BEGIN');

      for (const row of rawData) {
        // 1. URL (PFLICHTFELD)
        // Wir prüfen diverse Schreibweisen
        const url = getRowValue(row, ['url', 'landingpage-url', 'link', 'landingpage_url', 'landingpage']);
        
        // WICHTIG: Ohne URL überspringen wir die Zeile, da wir sie nicht zuordnen können
        if (!url) continue;

        // 2. Optionale Felder auslesen
        const hauptKeyword = getRowValue(row, ['haupt_keyword', 'haupt-keyword', 'keyword', 'main keyword', 'hauptkeyword']);
        const weitereKeywords = getRowValue(row, ['weitere_keywords', 'weitere keywords', 'keywords', 'secondary keywords']);
        
        // 3. Zahlenwerte sicher parsen (Optional -> null)
        const suchvolumen = parseOptionalInt(getRowValue(row, ['suchvolumen', 'volumen', 'volume', 'search volume']));
        const position = parseOptionalInt(getRowValue(row, ['aktuelle_position', 'aktuelle pos.', 'position', 'rank', 'ranking']));

        // 4. Status (Optional -> Default 'Offen')
        const statusImport = getRowValue(row, ['status', 'state']);
        const validStatus = ['Offen', 'In Prüfung', 'Gesperrt', 'Freigegeben'].includes(statusImport || '') 
          ? statusImport 
          : 'Offen'; // Fallback auf 'Offen' wenn leer oder ungültig

        // 5. Datenbank Update (UPSERT)
        // Wenn die URL für diesen User schon existiert, aktualisieren wir die Infos (ausgenommen Status, falls gewünscht)
        // Wenn wir wollen, dass der Excel-Status den DB-Status IMMER überschreibt, nutzen wir validStatus.
        // Wenn der DB-Status beibehalten werden soll, falls im Excel nichts steht, müsste man die Logik anpassen.
        // Hier: Wir überschreiben den Status nur, wenn im Excel explizit ein gültiger Status stand, sonst bleibt der alte (durch COALESCE Logik im SQL unten schwerer, daher nehmen wir hier vereinfacht den Import-Wert oder 'Offen' für Neue).
        
        await client.query(`
          INSERT INTO landingpages (
            user_id, url, haupt_keyword, weitere_keywords, 
            suchvolumen, aktuelle_position, status, created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
          ON CONFLICT (url, user_id) 
          DO UPDATE SET
            haupt_keyword = COALESCE(EXCLUDED.haupt_keyword, landingpages.haupt_keyword),
            weitere_keywords = COALESCE(EXCLUDED.weitere_keywords, landingpages.weitere_keywords),
            suchvolumen = COALESCE(EXCLUDED.suchvolumen, landingpages.suchvolumen),
            aktuelle_position = COALESCE(EXCLUDED.aktuelle_position, landingpages.aktuelle_position),
            updated_at = NOW()
            -- Status Update nur wenn explizit gewünscht, hier lassen wir den Status beim Re-Import meist unberührt 
            -- oder aktualisieren ihn nur, wenn sich die Daten ändern. 
            -- Um Status-Resets zu vermeiden, kommentieren wir status im Update aus, 
            -- oder wir setzen ihn nur, wenn er in der Excel explizit anders ist.
            -- Für dieses Beispiel aktualisieren wir den Status NICHT bei bestehenden Einträgen, 
            -- damit ein erneuter Import nicht alles auf 'Offen' zurücksetzt.
        `, [
          userId, 
          url, 
          hauptKeyword, 
          weitereKeywords, 
          suchvolumen, 
          position, 
          validStatus // Nur relevant für INSERT (neue Einträge)
        ]);
        
        importedCount++;
      }

      await client.query('COMMIT');
    } catch (dbError) {
      await client.query('ROLLBACK');
      throw dbError;
    } finally {
      client.release();
    }

    return NextResponse.json({ 
      message: `${importedCount} Landingpages erfolgreich verarbeitet.` 
    });

  } catch (error) {
    console.error('Import Fehler:', error);
    return NextResponse.json({ 
      message: 'Fehler beim Import.',
      error: 'Interner Fehler'
    }, { status: 500 });
  }
}
