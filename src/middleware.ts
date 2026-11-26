// src/middleware.ts
import NextAuth from 'next-auth';
import { baseAuthConfig } from '@/lib/auth-config';
import { NextResponse, type NextRequest } from 'next/server';
import { sql } from '@vercel/postgres';
import { TWO_FACTOR_SETUP_PATH } from '@/lib/two-factor/policy';
import {
  APP_HOST,
  LANDING_PATH,
  MARKETING_ORIGIN,
  MARKETING_PAGES,
  SITE_HEADER,
  appOriginFor,
  isMarketingHost,
  normalizeHost,
} from '@/lib/site-hosts';

const { auth } = NextAuth(baseAuthConfig);

/** Leitet den Request weiter und markiert ihn für das Layout als Landingpage. */
function marketingResponse(req: NextRequest, rewriteTo?: string) {
  const headers = new Headers(req.headers);
  headers.set(SITE_HEADER, 'marketing');
  return rewriteTo
    ? NextResponse.rewrite(new URL(rewriteTo, req.url), { request: { headers } })
    : NextResponse.next({ request: { headers } });
}

/**
 * www.datapeak.at zeigt die Landingpage, Impressum und Datenschutz.
 * Alle anderen Pfade (alte Lesezeichen, Gastlinks, Login) führen ins Dashboard.
 */
function handleSiteRouting(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const host = req.headers.get('host');

  if (isMarketingHost(host)) {
    if (pathname === '/') return marketingResponse(req, LANDING_PATH);
    if (pathname === LANDING_PATH) return NextResponse.redirect(new URL('/', req.url), 308);
    if (MARKETING_PAGES.has(pathname)) return marketingResponse(req);
    return NextResponse.redirect(new URL(`${pathname}${search}`, appOriginFor(host)), 308);
  }

  if (pathname === LANDING_PATH) {
    // Im Dashboard gibt es die Landingpage nicht; lokal und in Previews bleibt sie zum Prüfen erreichbar.
    if (normalizeHost(host) === APP_HOST) return NextResponse.redirect(`${MARKETING_ORIGIN}/`, 308);
    return marketingResponse(req);
  }
  return null;
}

export default auth(async (req) => {
  const { nextUrl } = req;
  const isStaticFile = /\.[^/]+$/.test(nextUrl.pathname);
  if (!isStaticFile) {
    const siteResponse = handleSiteRouting(req);
    if (siteResponse) return siteResponse;
  }

  const isLoggedIn = !!req.auth;
  const userId = req.auth?.user?.id;
  const userRole = req.auth?.user?.role;

  // 1. Ausnahmen definieren (Pfade, die immer erreichbar sein müssen)
  const isApiRoute = nextUrl.pathname.startsWith('/api');
  const isLoginRoute = nextUrl.pathname.startsWith('/login');
  const isMaintenancePage = nextUrl.pathname === '/maintenance';
  const isPublicDemoRoute = nextUrl.pathname.startsWith('/demo-anwalt');
  const isShareRoute = nextUrl.pathname.startsWith('/teilen/');
  const isStaticAsset = nextUrl.pathname.match(/\.(.*)$/);

  // Wenn es eine API, Login oder statische Datei ist -> Durchlassen
  if (isApiRoute || isLoginRoute || isPublicDemoRoute || isShareRoute || isStaticAsset) {
    return;
  }

  // Admins und Superadmins ohne aktive Zwei-Faktor-Anmeldung richten sie zuerst ein.
  if (isLoggedIn && req.auth?.user?.two_factor_setup_required && nextUrl.pathname !== TWO_FACTOR_SETUP_PATH) {
    return NextResponse.redirect(new URL(TWO_FACTOR_SETUP_PATH, nextUrl));
  }

  // 2. Per-User Wartungsmodus prüfen (nur für eingeloggte User)
  let userInMaintenance = false;
  
  if (isLoggedIn && userId) {
    try {
      const { rows } = await sql`
        SELECT maintenance_mode FROM users WHERE id = ${userId}::uuid
      `;
      userInMaintenance = rows[0]?.maintenance_mode === true;
    } catch (e) {
      console.error('Middleware DB Error:', e);
      // Im Fehlerfall lassen wir den Zugriff zu
    }
  }

  // 3. Logik anwenden
  if (userInMaintenance) {
    // SUPERADMIN ist immer ausgenommen
    if (userRole === 'SUPERADMIN') {
      const res = NextResponse.next();
      res.headers.set('x-maintenance-mode', 'active-but-bypassed');
      return res;
    }

    // User ist im Wartungsmodus -> Redirect zur Wartungsseite
    if (!isMaintenancePage) {
      return NextResponse.redirect(new URL('/maintenance', nextUrl));
    }
    
    // User ist bereits auf Wartungsseite -> Header mit Maintenance-Flag setzen
    const res = NextResponse.next();
    res.headers.set('x-user-maintenance', 'true');
    return res;
  } else {
    // User ist NICHT im Wartungsmodus
    // Falls er noch auf /maintenance ist -> Zurück zum Start
    if (isMaintenancePage && isLoggedIn) {
      return NextResponse.redirect(new URL('/', nextUrl));
    }
  }

  // Standard NextAuth Verhalten
  return;
});

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
