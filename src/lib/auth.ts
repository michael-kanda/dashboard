// src/lib/auth.ts
import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { sql } from '@vercel/postgres';
import bcrypt from 'bcryptjs';
import { unstable_noStore as noStore } from 'next/cache';
import { baseAuthConfig } from '@/lib/auth-config';

export const authConfig = {
  ...baseAuthConfig,
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        noStore();

        if (!credentials?.email || !credentials.password) {
          throw new Error('E-Mail oder Passwort fehlt');
        }

        const normalizedEmail = (credentials.email as string).toLowerCase().trim();
        console.log('[Authorize] Suche Benutzer:', normalizedEmail);

        let user;
        try {
          // 1. Benutzerdaten holen — mit Fallback, falls Prompt-Tracking-Spalten
          // in einer bestehenden DB noch nicht migriert wurden.
          let rows;
          try {
            const result = await sql`
              SELECT
                id, email, password, role, mandant_id, ansprache, permissions, domain,
                gsc_site_url, ga4_property_id, google_ads_sheet_id,
                brand_keywords, settings_show_prompt_tracking, is_demo
              FROM users
              WHERE email = ${normalizedEmail}
            `;
            rows = result.rows;
          } catch (dbError) {
            const message = dbError instanceof Error ? dbError.message : String(dbError);
            if (!message.includes('brand_keywords') && !message.includes('settings_show_prompt_tracking') && !message.includes('ansprache') && !message.includes('is_demo')) {
              throw dbError;
            }

            console.warn('[Authorize] Optionale User-Spalten fehlen noch, nutze Login-Fallback.');
            const fallback = await sql`
              SELECT
                id, email, password, role, mandant_id,
                NULL::varchar as ansprache,
                permissions, domain,
                gsc_site_url, ga4_property_id,
                NULL::varchar as google_ads_sheet_id,
                NULL::text[] as brand_keywords,
                FALSE as settings_show_prompt_tracking,
                FALSE as is_demo
              FROM users
              WHERE email = ${normalizedEmail}
            `;
            rows = fallback.rows;
          }
          user = rows[0];

          if (!user) {
            console.log('[Authorize] Benutzer nicht gefunden:', normalizedEmail);
            throw new Error('Diese E-Mail-Adresse ist nicht registriert');
          }

          console.log('[Authorize] Benutzer gefunden:', user.email);

          if (!user.password) {
            console.error('[Authorize] KRITISCHER FEHLER: Benutzer hat kein Passwort-Hash in der DB!');
            throw new Error('Serverkonfigurationsfehler');
          }

          // 2. Passwort vergleichen
          const passwordsMatch = await bcrypt.compare(credentials.password as string, user.password);

          if (!passwordsMatch) {
            console.log('[Authorize] Passwort-Vergleich fehlgeschlagen für:', normalizedEmail);
            throw new Error('Das Passwort ist nicht korrekt');
          }

          console.log('[Authorize] Login erfolgreich für:', user.email);

        } catch (authError) {
          if (authError instanceof Error) {
            console.warn(`[Authorize] Authentifizierungsfehler: ${authError.message}`);
            throw authError;
          }
          console.error("[Authorize] Unerwarteter Authentifizierungsfehler:", authError);
          throw new Error('Authentifizierungsfehler');
        }

        // Login-Ereignis protokollieren
        try {
          await sql`
            INSERT INTO login_logs (user_id, user_email, user_role)
            VALUES (${user.id}, ${user.email}, ${user.role});
          `;
        } catch (logError) {
          console.error('[Authorize] FEHLER beim Protokollieren des Logins (nicht-fatal):', logError);
        }

        // Logo-URL-Abruf
        let logo_url: string | null = null;
        if (user.mandant_id) {
          try {
            const { rows: logoRows } = await sql`
              SELECT logo_url FROM mandanten_logos WHERE mandant_id = ${user.mandant_id}
            `;
            if (logoRows.length > 0) {
              logo_url = logoRows[0].logo_url;
            }
          } catch (logoError) {
            console.error('[Authorize] Fehler beim Abrufen des Logos (nicht-fatal):', logoError);
          }
        }

        // 3. Auth-Objekt zurückgeben — alle App-relevanten Felder mitgeben
        return {
          id: String(user.id),
          email: user.email,
          role: user.role,
          mandant_id: user.mandant_id,
          ansprache: user.ansprache || null,
          permissions: user.permissions || [],
          logo_url: logo_url,
          domain: user.domain || null,
          gsc_site_url: user.gsc_site_url || null,
          ga4_property_id: user.ga4_property_id || null,
          google_ads_sheet_id: user.google_ads_sheet_id || null,
          brand_keywords: user.brand_keywords || null,
          settings_show_prompt_tracking: user.settings_show_prompt_tracking ?? false,
        };
      }
    })
  ],
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
