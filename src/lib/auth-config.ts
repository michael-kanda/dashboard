import type { NextAuthConfig } from 'next-auth';
import { isDemoProject } from '@/lib/demo-project';
import { loadSessionState } from '@/lib/session-state';

// Rolle, Rechte und Mandant werden spätestens nach diesem Intervall aus der Datenbank übernommen.
const SESSION_REFRESH_MS = 5 * 60 * 1000;

export const baseAuthConfig = {
  providers: [],
  session: {
    strategy: 'jwt',
    maxAge: 60 * 60,
  },
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        if (user.id) token.id = user.id;
        token.role = user.role as 'BENUTZER' | 'ADMIN' | 'SUPERADMIN';
        token.mandant_id = user.mandant_id;
        token.ansprache = user.ansprache;
        token.permissions = user.permissions;
        token.logo_url = user.logo_url;
        token.domain = user.domain;
        token.gsc_site_url = user.gsc_site_url;
        token.ga4_property_id = user.ga4_property_id;
        token.google_ads_sheet_id = user.google_ads_sheet_id;
        token.brand_keywords = user.brand_keywords;
        token.settings_show_prompt_tracking = user.settings_show_prompt_tracking;
        token.is_demo = isDemoProject(user);
        token.password_fingerprint = user.password_fingerprint;
        token.refreshed_at = Date.now();
        return token;
      }

      const refreshedAt = typeof token.refreshed_at === 'number' ? token.refreshed_at : 0;
      if (token.id && Date.now() - refreshedAt > SESSION_REFRESH_MS) {
        const current = await loadSessionState(token.id as string);
        if (current === null) return null;
        if (current) {
          // Sitzungen von vor dieser Prüfung übernehmen den aktuellen Fingerabdruck einmalig.
          if (token.password_fingerprint && token.password_fingerprint !== current.passwordFingerprint) {
            return null;
          }
          token.role = current.role;
          token.mandant_id = current.mandant_id;
          token.permissions = current.permissions;
          token.password_fingerprint = current.passwordFingerprint;
          token.refreshed_at = Date.now();
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as 'BENUTZER' | 'ADMIN' | 'SUPERADMIN';
        session.user.mandant_id = token.mandant_id as string | null | undefined;
        session.user.ansprache = token.ansprache as string | null | undefined;
        session.user.permissions = token.permissions as string[] | undefined;
        session.user.logo_url = token.logo_url as string | null | undefined;
        session.user.domain = token.domain as string | null | undefined;
        session.user.gsc_site_url = token.gsc_site_url as string | null | undefined;
        session.user.ga4_property_id = token.ga4_property_id as string | null | undefined;
        session.user.google_ads_sheet_id = token.google_ads_sheet_id as string | null | undefined;
        session.user.brand_keywords = token.brand_keywords as string[] | null | undefined;
        session.user.settings_show_prompt_tracking = token.settings_show_prompt_tracking as boolean | null | undefined;
        session.user.is_demo = token.is_demo as boolean | undefined;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
