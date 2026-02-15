// src/components/MainLayout.tsx
'use client';

import { usePathname } from 'next/navigation';
import ThemeProvider from '@/components/ThemeProvider';
import Sidebar from '@/components/layout/Sidebar';
import Footer from '@/components/layout/Footer';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Liste der Pfade, auf denen Sidebar/Footer ausgeblendet werden sollen
  // (1:1 aus dem Original übernommen)
  const noLayoutPaths = ['/login'];

  // Prüfen, ob der aktuelle Pfad in der Liste ist
  const showLayout = !noLayoutPaths.includes(pathname);

  // ─── Kein Layout (z.B. Login-Seite) ───
  if (!showLayout) {
    return (
      <ThemeProvider>
        <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-950">
          <main className="flex-grow">{children}</main>
        </div>
      </ThemeProvider>
    );
  }

  // ─── Layout mit Sidebar ───
  return (
    <ThemeProvider>
      <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950">
        {/* Desktop: Sidebar links (flex-shrink-0 damit Sidebar ihre Breite behält) */}
        {/* Mobile: Sidebar rendert sich selbst als horizontalen Header */}
        <Sidebar />

        {/* Rechte Seite: Content + Footer */}
        <div className="flex flex-col flex-1 min-w-0">
          <main className="flex-grow">{children}</main>
          <Footer />
        </div>
      </div>
    </ThemeProvider>
  );
}
