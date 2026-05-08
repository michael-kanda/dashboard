// src/lib/auth.ts
import NextAuth from 'next-auth'; // Standard-Import
import CredentialsProvider from 'next-auth/providers/credentials';
import { sql } from '@vercel/postgres';
import bcrypt from 'bcryptjs';
import { unstable_noStore as noStore } from 'next/cache';
import type { NextAuthConfig } from 'next-auth'; // Wichtig: NextAuthConfig importieren

// Die Konfiguration wird jetzt als reines Objekt definiert
export const authConfig = {
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
          // 1. Benutzerdaten holen
          const { rows } = await sql`
            SELECT
              id, email, password, role, mandant_id, permissions,
              gsc_site_url
            FROM users
            WHERE email = ${normalizedEmail}
          `;
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
          console.log('[Authorize] Versuche, Login-Ereignis zu protokollieren...');
          await sql`
            INSERT INTO login_logs (user_id, user_email, user_role)
            VALUES (${user.id}, ${user.email}, ${user.role});
          `;
          console.log('[Authorize] Login-Ereignis erfolgreich protokolliert.');
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

        // 3. Auth-Objekt zurückgeben
        // ✅ id explizit als String – verhindert TS-Probleme im jwt-Callback
        return {
          id: String(user.id),
          email: user.email,
          role: user.role,
          mandant_id: user.mandant_id,
          permissions: user.permissions || [],
          logo_url: logo_url,
          gsc_site_url: user.gsc_site_url || null,
        };
      }
    })
  ],
  session: {
    strategy: 'jwt',
    maxAge: 60 * 60, // 60 Minuten
  },
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: '/login',
  },
  callbacks: {
    // 4. JWT mit Benutzerdaten anreichern
    async jwt({ token, user }) {
      if (user) {
        // ✅ Defensiver Check – user.id ist im NextAuth-Type optional (string | undefined)
        if (user.id) token.id = user.id;
        token.role = user.role as 'BENUTZER' | 'ADMIN' | 'SUPERADMIN';
        token.mandant_id = user.mandant_id;
        token.permissions = user.permissions;
        token.logo_url = user.logo_url;
        token.gsc_site_url = user.gsc_site_url;
        token.is_demo = user.email?.includes('demo');
      }
      return token;
    },

    // 5. Session mit den Daten aus dem JWT anreichern
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as 'BENUTZER' | 'ADMIN' | 'SUPERADMIN';
        session.user.mandant_id = token.mandant_id as string | null | undefined;
        session.user.permissions = token.permissions as string[] | undefined;
        session.user.logo_url = token.logo_url as string | null | undefined;
        session.user.gsc_site_url = token.gsc_site_url as string | null | undefined;
        session.user.is_demo = token.is_demo as boolean | undefined;
      }
      return session;
    },
  },
} satisfies NextAuthConfig; // 'satisfies' stellt Typsicherheit her

// Hiermit exportieren wir die Handler und die auth-Funktion
export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
