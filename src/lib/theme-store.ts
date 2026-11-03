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

// Für das Layout: gecacht, beim Speichern über das Tag geleert. Das Intervall fängt einen Fehlstart ab.
export const getCachedTheme = unstable_cache(readTheme, ['app-theme'], {
  tags: [THEME_CACHE_TAG],
  revalidate: 300,
});

export async function saveTheme(theme: ThemeSettings, updatedBy: string): Promise<void> {
  await sql`
    INSERT INTO app_settings (key, value, updated_by, updated_at)
    VALUES ('theme', ${JSON.stringify(theme)}::jsonb, ${updatedBy}, NOW())
    ON CONFLICT (key) DO UPDATE
      SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = NOW()
  `;
}
