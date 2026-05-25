// src/lib/database.ts

import { sql } from '@vercel/postgres';
import { User } from '@/types'; 

/**
 * Erstellt alle notwendigen Datenbanktabellen, falls diese noch nicht existieren.
 * Diese Funktion ist idempotent (kann mehrfach ausgeführt werden, ohne Schaden anzurichten).
 */
export async function createTables() {
  try {
    
    // 1. Users-Tabelle (Primärtabelle)
    // Enthält Login-Daten, Rollen und API-Konfigurationen pro User/Mandant
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL CHECK (role IN ('SUPERADMIN', 'ADMIN', 'BENUTZER')),
        
        mandant_id VARCHAR(255) NULL, 
        ansprache VARCHAR(255) NULL,
        permissions TEXT[] DEFAULT '{}', 

        domain VARCHAR(255),
        gsc_site_url VARCHAR(255),
        ga4_property_id VARCHAR(255),
        semrush_project_id VARCHAR(255),
        semrush_tracking_id VARCHAR(255),       -- KORREKTUR: Für Kampagne 1
        semrush_tracking_id_02 VARCHAR(255),    -- KORREKTUR: Für Kampagne 2
        google_ads_sheet_id VARCHAR(255),
        favicon_url TEXT NULL,
        brand_keywords TEXT[] DEFAULT NULL,
        settings_show_prompt_tracking BOOLEAN DEFAULT FALSE,
        
        "createdByAdminId" UUID REFERENCES users(id),
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
    console.log('Tabelle "users" erfolgreich geprüft/erstellt.');

    await sql`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS ansprache VARCHAR(255),
      ADD COLUMN IF NOT EXISTS google_ads_sheet_id VARCHAR(255),
      ADD COLUMN IF NOT EXISTS brand_keywords TEXT[] DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS settings_show_prompt_tracking BOOLEAN DEFAULT FALSE;
    `;
    console.log('Prompt-Tracking-Spalten in "users" erfolgreich geprüft/erstellt.');

    // 2. Landingpages-Tabelle
    // Speichert die zu überwachenden URLs und deren aktuelle GSC-Daten
    await sql`
      CREATE TABLE IF NOT EXISTS landingpages (
        id SERIAL PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        url TEXT NOT NULL,
        haupt_keyword TEXT,
        weitere_keywords TEXT,
        status VARCHAR(50) DEFAULT 'Offen',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        
        -- GSC-Daten-Spalten
        gsc_klicks INTEGER,
        gsc_klicks_change INTEGER,
        gsc_impressionen INTEGER,
        gsc_impressionen_change INTEGER,
        gsc_position DECIMAL(5, 2),
        gsc_position_change DECIMAL(5, 2),
        gsc_last_updated TIMESTAMP WITH TIME ZONE,
        gsc_last_range VARCHAR(10),

        UNIQUE(url, user_id)
      );
    `;
    console.log('Tabelle "landingpages" erfolgreich geprüft/erstellt.');

    // 3. Landingpage Logs-Tabelle
    // Protokolliert Änderungen an Landingpages (Audit Trail)
     await sql`
        CREATE TABLE IF NOT EXISTS landingpage_logs (
          id SERIAL PRIMARY KEY,
          landingpage_id INTEGER NOT NULL REFERENCES landingpages(id) ON DELETE CASCADE,
          user_id UUID REFERENCES users(id) ON DELETE SET NULL,
          user_email VARCHAR(255),
          action TEXT NOT NULL,
          timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
     `;
     console.log('Tabelle "landingpage_logs" erfolgreich geprüft/erstellt.');

    // 4. Notifications-Tabelle
    // Systembenachrichtigungen für Benutzer
    await sql`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        message TEXT NOT NULL,
        type VARCHAR(20) DEFAULT 'info',
        read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        related_landingpage_id INTEGER REFERENCES landingpages(id) ON DELETE SET NULL
      );
    `;
    console.log('Tabelle "notifications" erfolgreich geprüft/erstellt.');

    // 5. Project Assignments-Tabelle (Admin -> Kunde)
    // Regelt die Zuweisung von Kunden-Accounts zu Admin-Accounts
    await sql`
      CREATE TABLE IF NOT EXISTS project_assignments (
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,     -- Der Admin (user_id)
        project_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,  -- Der Kunde (project_id)
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, project_id)
      );
    `;
     console.log('Tabelle "project_assignments" erfolgreich geprüft/erstellt.');

    // 6. Semrush Cache-Tabelle
    // Zwischenspeicher für Semrush Keyword-Daten zur API-Schonung
    await sql`
      CREATE TABLE IF NOT EXISTS semrush_keywords_cache (
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        campaign VARCHAR(50) NOT NULL,
        keywords_data JSONB NOT NULL,
        last_fetched TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, campaign)
      );
    `;
    console.log('Tabelle "semrush_keywords_cache" erfolgreich geprüft/erstellt.');

    // 7. Google Data Cache-Tabelle
    // Zwischenspeicher für aggregierte Google Search Console Daten
    await sql`
      CREATE TABLE IF NOT EXISTS google_data_cache (
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        date_range VARCHAR(10) NOT NULL,
        data JSONB NOT NULL,
        last_fetched TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, date_range)
      );
    `;
    console.log('Tabelle "google_data_cache" erfolgreich geprüft/erstellt.');

    await sql`
      CREATE TABLE IF NOT EXISTS prompt_cluster_history (
        id SERIAL PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        date_range VARCHAR(20) NOT NULL,
        queries_hash VARCHAR(64) NOT NULL,
        result JSONB NOT NULL,
        query_count INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
    console.log('Tabelle "prompt_cluster_history" erfolgreich geprüft/erstellt.');

    // 8. Mandanten/Label Logo-Tabelle
    // Speichert Custom Branding Logos für White-Labeling
    await sql`
      CREATE TABLE IF NOT EXISTS mandanten_logos (
        mandant_id VARCHAR(255) PRIMARY KEY,
        logo_url TEXT NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
    console.log('Tabelle "mandanten_logos" erfolgreich geprüft/erstellt.');

    // 9. NEU: System Settings Tabelle
    // Speichert globale Einstellungen wie den Wartungsmodus
    await sql`
      CREATE TABLE IF NOT EXISTS system_settings (
        key VARCHAR(50) PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
    console.log('Tabelle "system_settings" erfolgreich geprüft/erstellt.');

    // --- Performance Indizes ---
    await sql`CREATE INDEX IF NOT EXISTS idx_landingpages_user_id ON landingpages(user_id);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_google_data_cache_user_id ON google_data_cache(user_id);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_prompt_cluster_history_user_created ON prompt_cluster_history(user_id, created_at DESC);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_prompt_cluster_history_hash ON prompt_cluster_history(user_id, queries_hash, created_at DESC);`;

    console.log('Alle Indizes geprüft/erstellt.');

  } catch (error: unknown) {
    console.error('Fehler beim Erstellen der Tabellen:', error);
    throw new Error('Tabellen konnten nicht erstellt werden.');
  }
}

/**
 * Ruft einen Benutzer anhand der E-Mail-Adresse ab.
 * @param email Die E-Mail-Adresse des Benutzers
 * @returns Das User-Objekt oder undefined
 */
export async function getUserByEmail(email: string) {
  try {
    const { rows } = await sql`SELECT * FROM users WHERE email=${email}`;
    return rows[0] as User;
  } catch (error: unknown) {
    console.error('Fehler beim Abrufen des Benutzers:', error);
    // Wir werfen hier keinen Error, damit Auth-Logik 'null' handhaben kann, 
    // oder du kannst throw new Error(...) beibehalten, wenn gewünscht.
    throw new Error('Benutzer konnte nicht gefunden werden.');
  }
}
