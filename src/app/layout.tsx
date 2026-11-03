// src/app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import MainLayout from '@/components/MainLayout';
import { Toaster } from 'sonner';
import * as Sentry from '@sentry/nextjs';
import { themeToCss } from '@/lib/theme';
import { getCachedTheme } from '@/lib/theme-store';
import "bootstrap-icons/font/bootstrap-icons.css";

// Auf dem Mac greift SF Pro aus dem Systemstapel, sonst Inter.
const inter = Inter({
  subsets: ["latin"],
  // Variable Schrift, damit auch Zwischengewichte wie 450 sauber dargestellt werden.
  display: "swap",
  variable: "--font-inter",
});

// Metadata mit Sentry Tracing
export function generateMetadata(): Metadata {
  return {
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
      var theme = localStorage.getItem('datapeak-theme');
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
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

  return (
    <html lang="de" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        {themeCss && <style id="app-theme" dangerouslySetInnerHTML={{ __html: themeCss }} />}
      </head>
      <body className="bg-page">
        <Providers>
          <Toaster position="top-right" richColors closeButton />
          <MainLayout>
            {children}
          </MainLayout>
        </Providers>
      </body>
    </html>
  );
}
