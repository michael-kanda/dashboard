// app/layout.tsx
import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import MainLayout from '@/components/MainLayout';
import { Toaster } from 'sonner';
import * as Sentry from '@sentry/nextjs';
import "bootstrap-icons/font/bootstrap-icons.css";

// Poppins Font
const poppins = Poppins({ 
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"]
});

// Metadata mit Sentry Tracing
export function generateMetadata(): Metadata {
  return {
    title: 'Data Peak | SEO & Analytics Dashboard',
    description:
      'Data Peak ist das zentrale Dashboard zur Analyse Ihrer Web-Performance. Verbinden Sie Google Search Console, Analytics & Semrush für einheitliches KPI-Reporting.',
    icons: {
      icon: '/favicon.ico',
    },
    other: {
      ...Sentry.getTraceData()
    }
  };
}

// ─── Theme Init Script ───────────────────────────────────
// Läuft VOR React-Hydration um Flash of Wrong Theme zu verhindern.
// Liest localStorage und setzt/entfernt die 'dark' Klasse auf <html>
// BEVOR irgendein CSS oder React-Component rendert.
const themeInitScript = `
  (function() {
    try {
      var theme = localStorage.getItem('datapeak-theme');
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } catch(e) {}
  })();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" suppressHydrationWarning>
      <head>
        {/* Theme SOFORT setzen – vor allem anderen */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className={`${poppins.className} bg-gray-50`}>
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
