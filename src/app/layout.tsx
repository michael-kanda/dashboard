// src/app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { headers } from 'next/headers';
import MainLayout from '@/components/MainLayout';
import MarketingShell from '@/components/marketing/MarketingShell';
import { SITE_HEADER } from '@/lib/site-hosts';
import { Toaster } from 'sonner';
import * as Sentry from '@sentry/nextjs';
import { themeToCss } from '@/lib/theme';
import { getCachedTheme } from '@/lib/theme-store';

// Auf dem Mac greift SF Pro aus dem Systemstapel, sonst Inter.
const inter = Inter({
  subsets: ["latin"],
  // Variable Schrift, damit auch Zwischengewichte wie 450 sauber dargestellt werden.
  display: "swap",
  variable: "--font-inter",
});

// Metadata mit Sentry Tracing
export async function generateMetadata(): Promise<Metadata> {
  // Das Dashboard soll nicht in Suchmaschinen erscheinen, nur die Landingpage.
  const isMarketing = (await headers()).get(SITE_HEADER) === 'marketing';
  return {
    robots: isMarketing ? { index: true, follow: true } : { index: false, follow: false },
    title: 'Data Peak | SEO & Analytics Dashboard',
    description:
      'Data Peak ist das zentrale Dashboard zur Analyse Ihrer Web-Performance.',
    icons: {
      icon: '/favicon.ico',
    },
    other: {
      ...Sentry.getTraceData()
    }
  };
}

const themeInitScript = `
  (function() {
    try {
      // 'light' oder 'dark' fest gewählt, sonst wie das Gerät (ThemeProvider.tsx)
      var theme = localStorage.getItem('datapeak-theme');
      var dark = theme === 'dark' || (theme !== 'light' && !!window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
      document.documentElement.classList.toggle('dark', dark);
      // Animationen der Landingpage (globals.css: .dp-countup, .dp-draw) nur ohne „Bewegung reduzieren“
      if (window.matchMedia && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        document.documentElement.classList.add('dp-anim');
      }
      var scale = Number(localStorage.getItem('datapeak-font-scale'));
      if ([0.9, 1.1, 1.2, 1.35].indexOf(scale) !== -1) {
        document.documentElement.style.setProperty('--dp-content-zoom', String(scale));
      }
    } catch(e) {}
  })();
`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Vom Superadmin gewählte Farben, Rahmen und Schatten; leer, solange nichts geändert wurde.
  const themeCss = themeToCss(await getCachedTheme());
  // Die Middleware markiert Aufrufe der Landingpage (www.datapeak.at); dort gibt es keine Sidebar.
  const requestHeaders = await headers();
  const isMarketing = requestHeaders.get(SITE_HEADER) === 'marketing';
  // Nonce aus dem Proxy (src/lib/csp.ts), damit das Inline-Skript die Content Security Policy erfüllt.
  const nonce = requestHeaders.get('x-nonce') ?? undefined;

  return (
    <html lang="de" className={inter.variable} suppressHydrationWarning>
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        {themeCss && <style id="app-theme" dangerouslySetInnerHTML={{ __html: themeCss }} />}
      </head>
      <body className="bg-page">
        <Toaster position="top-right" richColors closeButton />
        {/* Die Landingpage braucht keine Sitzung; ohne SessionProvider fragt sie /api/auth/session nicht ab. */}
        {isMarketing ? (
          <MarketingShell>{children}</MarketingShell>
        ) : (
          <Providers>
            <MainLayout>
              {children}
            </MainLayout>
          </Providers>
        )}
      </body>
    </html>
  );
}
