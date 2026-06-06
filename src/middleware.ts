// src/middleware.ts
import NextAuth from 'next-auth';
import { authConfig } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

const { auth } = NextAuth(authConfig);

export default auth(async (req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const userId = req.auth?.user?.id;
  const userRole = req.auth?.user?.role;

  // 1. Ausnahmen definieren (Pfade, die immer erreichbar sein müssen)
  const isApiRoute = nextUrl.pathname.startsWith('/api');
  const isLoginRoute = nextUrl.pathname.startsWith('/login');
  const isMaintenancePage = nextUrl.pathname === '/maintenance';
  const isPublicDemoRoute = nextUrl.pathname.startsWith('/demo-anwalt');
  const isStaticAsset = nextUrl.pathname.match(/\.(.*)$/);

  // Wenn es eine API, Login oder statische Datei ist -> Durchlassen
  if (isApiRoute || isLoginRoute || isPublicDemoRoute || isStaticAsset) {
    return;
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
