// Laden und Speichern der Design-Einstellungen (Tabelle app_settings, Migration 008).
import { sql } from '@vercel/postgres';
import { unstable_cache } from 'next/cache';
import { DEFAULT_THEME, themeSchema, type ThemeSettings } from './theme';

export const THEME_CACHE_TAG = 'app-theme';

export async function readTheme(): Promise<ThemeSettings> {
  try {
    const { rows } = await sql`SELECT value FROM app_settings WHERE key = 'theme'`;
    const parsed = themeSchema.safeParse(rows[0]?.value ?? {});
    return parsed.success ? parsed.data : DEFAULT_THEME;
  } catch (error) {
    // Tabelle fehlt (Migration 008 noch nicht gelaufen) oder Datenbank nicht erreichbar: Standarddesign.
    console.error('[Theme] Laden fehlgeschlagen:', error);
    return DEFAULT_THEME;
  }
}

async function readThemeOrThrow(): Promise<ThemeSettings> {
  const { rows } = await sql`SELECT value FROM app_settings WHERE key = 'theme'`;
  const parsed = themeSchema.safeParse(rows[0]?.value ?? {});
  return parsed.success ? parsed.data : DEFAULT_THEME;
}

// Ohne Zeitablauf: Das Layout läuft bei jedem Seitenaufruf, auch bei Monitoring-
// Pings. Ein Intervall würde die Datenbank regelmäßig wecken und den Neon-
// Ruhezustand verhindern. Geleert wird nur beim Speichern über das Tag.
const cachedTheme = unstable_cache(readThemeOrThrow, ['app-theme'], {
  tags: [THEME_CACHE_TAG],
  revalidate: false,
});

// Fehler werden nicht gecacht (unstable_cache speichert nur erfolgreiche Ergebnisse):
// Beim nächsten Aufruf wird erneut gelesen, bis dahin gilt das Standarddesign.
export async function getCachedTheme(): Promise<ThemeSettings> {
  try {
    return await cachedTheme();
  } catch (error) {
    console.error('[Theme] Laden fehlgeschlagen, Standarddesign aktiv:', error);
    return DEFAULT_THEME;
  }
}

export async function saveTheme(theme: ThemeSettings, updatedBy: string): Promise<void> {
  await sql`
    INSERT INTO app_settings (key, value, updated_by, updated_at)
    VALUES ('theme', ${JSON.stringify(theme)}::jsonb, ${updatedBy}, NOW())
    ON CONFLICT (key) DO UPDATE
      SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = NOW()
  `;
}
