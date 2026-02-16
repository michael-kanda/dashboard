// src/components/MainLayout.tsx
'use client';

import { usePathname } from 'next/navigation';
import ThemeProvider from '@/components/ThemeProvider';
import Sidebar from '@/components/layout/Sidebar';
import Footer from '@/components/layout/Footer';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const noLayoutPaths = ['/login'];
  const showLayout = !noLayoutPaths.includes(pathname);

  // ─── Kein Layout (z.B. Login-Seite) ───
  if (!showLayout) {
    return (
      <ThemeProvider>
        <div className="flex flex-col min-h-screen bg-gray-50">
          <main className="flex-grow">{children}</main>
        </div>
      </ThemeProvider>
    );
  }

  // ─── Layout mit Sidebar ───
  // WICHTIG: Keine dark: Klassen hier!
  // Das globale CSS (dark-mode-globals.css) überschreibt bg-gray-50 automatisch
  // wenn html.dark gesetzt ist.
  return (
    <ThemeProvider>
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <main className="flex-grow">{children}</main>
          <Footer />
        </div>
      </div>
    </ThemeProvider>
  );
}
