// src/proxy.ts (bis Next 15: middleware.ts)
import NextAuth from 'next-auth';
import { baseAuthConfig } from '@/lib/auth-config';
import { NextRequest, NextResponse, type NextFetchEvent } from 'next/server';
import { sql } from '@vercel/postgres';
import { TWO_FACTOR_SETUP_PATH } from '@/lib/two-factor/policy';
import { buildCsp, createNonce, CSP_HEADER } from '@/lib/csp';
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

/**
 * Lässt die Anfrage durch und reicht die Request-Header weiter (inkl. Nonce und CSP für das
 * Rendering). Ohne diese Weitergabe sähe Next.js die Nonce nicht.
 */
function forward(req: NextRequest) {
  return NextResponse.next({ request: { headers: new Headers(req.headers) } });
}

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

// Wartungsmodus pro Benutzer: nicht bei jedem Seitenaufruf aus der Datenbank lesen, sondern
// höchstens alle 30 Sekunden je Benutzer und Instanz. Ein Umschalten im Admin-Bereich greift
// dadurch spätestens nach 30 Sekunden.
const MAINTENANCE_CACHE_MS = 30_000;
const MAINTENANCE_CACHE_MAX = 1_000;
const maintenanceCache = new Map<string, { value: boolean; expiresAt: number }>();

async function isUserInMaintenance(userId: string, now = Date.now()): Promise<boolean> {
  const cached = maintenanceCache.get(userId);
  if (cached && cached.expiresAt > now) return cached.value;
  try {
    const { rows } = await sql`
      SELECT maintenance_mode FROM users WHERE id = ${userId}::uuid
    `;
    const value = rows[0]?.maintenance_mode === true;
    if (maintenanceCache.size >= MAINTENANCE_CACHE_MAX) maintenanceCache.clear();
    maintenanceCache.set(userId, { value, expiresAt: now + MAINTENANCE_CACHE_MS });
    return value;
  } catch (e) {
    console.error('Middleware DB Error:', e);
    // Im Fehlerfall lassen wir den Zugriff zu (nicht zwischenspeichern, beim nächsten Aufruf erneut prüfen)
    return false;
  }
}

const authMiddleware = auth(async (req) => {
  const { nextUrl } = req;
  const isStaticFile = /\.[^/]+$/.test(nextUrl.pathname);
  if (!isStaticFile) {
    const siteResponse = handleSiteRouting(req);
    if (siteResponse) return siteResponse;
  }

  // Nur eine Sitzung mit Benutzer-ID gilt als angemeldet (nicht schon ein befülltes req.auth).
  const isLoggedIn = Boolean(req.auth?.user?.id);
  const userId = req.auth?.user?.id;
  const userRole = req.auth?.user?.role;

  // 1. Ausnahmen definieren (Pfade, die immer erreichbar sein müssen)
  const isApiRoute = nextUrl.pathname.startsWith('/api');
  // Auch /login/passwort-vergessen und /login/neues-passwort: ohne Anmeldung erreichbar.
  const isLoginRoute = nextUrl.pathname.startsWith('/login');
  const isMaintenancePage = nextUrl.pathname === '/maintenance';
  const isPublicDemoRoute = nextUrl.pathname.startsWith('/demo-anwalt');
  const isShareRoute = nextUrl.pathname.startsWith('/teilen/');
  const isStaticAsset = nextUrl.pathname.match(/\.(.*)$/);

  // Wenn es eine API, Login oder statische Datei ist -> Durchlassen
  if (isApiRoute || isLoginRoute || isPublicDemoRoute || isShareRoute || isStaticAsset) {
    return forward(req);
  }

  // Admins und Superadmins ohne aktive Zwei-Faktor-Anmeldung richten sie zuerst ein.
  if (isLoggedIn && req.auth?.user?.two_factor_setup_required && nextUrl.pathname !== TWO_FACTOR_SETUP_PATH) {
    return NextResponse.redirect(new URL(TWO_FACTOR_SETUP_PATH, nextUrl));
  }

  // 2. Per-User Wartungsmodus prüfen (nur für eingeloggte User)
  let userInMaintenance = false;
  
  // Superadmins sind ohnehin ausgenommen, für sie entfällt die Abfrage.
  if (isLoggedIn && userId && userRole !== 'SUPERADMIN') {
    userInMaintenance = await isUserInMaintenance(userId);
  }

  // 3. Logik anwenden
  if (userInMaintenance) {
    // SUPERADMIN ist immer ausgenommen
    if (userRole === 'SUPERADMIN') {
      const res = forward(req);
      res.headers.set('x-maintenance-mode', 'active-but-bypassed');
      return res;
    }

    // User ist im Wartungsmodus -> Redirect zur Wartungsseite
    if (!isMaintenancePage) {
      return NextResponse.redirect(new URL('/maintenance', nextUrl));
    }
    
    // User ist bereits auf Wartungsseite -> Header mit Maintenance-Flag setzen
    const res = forward(req);
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
  return forward(req);
});

// Die Landingpage (www.datapeak.at) läuft ohne next-auth: so setzt sie keine Anmelde-Cookies
// (csrf-token, callback-url), die dort niemand braucht. Alle anderen Hosts gehen durch auth().
export default async function proxy(req: NextRequest, event: NextFetchEvent) {
  if (/\.[^/]+$/.test(req.nextUrl.pathname)) {
    // Statische Dateien (Bilder, PDF, robots.txt …): keine Nonce nötig
    return isMarketingHost(req.headers.get('host')) ? NextResponse.next() : authMiddleware(req, event as never);
  }

  // Pro Anfrage eine neue Nonce. Next.js liest sie aus dem Request-Header Content-Security-Policy
  // und setzt sie an seine Skripte; der Browser bekommt die Policy über den Response-Header.
  const nonce = createNonce();
  const csp = buildCsp(nonce, { isDev: process.env.NODE_ENV === 'development' });
  const headers = new Headers(req.headers);
  headers.set('x-nonce', nonce);
  headers.set('Content-Security-Policy', csp);
  const request = new NextRequest(req, { headers });

  const response = isMarketingHost(req.headers.get('host'))
    ? handleSiteRouting(request) ?? forward(request)
    : await authMiddleware(request, event as never);
  response?.headers.set(CSP_HEADER, csp);
  return response;
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
