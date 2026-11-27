import { type ClassValue, clsx } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"
import { ConvertingPageData } from "@/lib/dashboard-shared"

// Eigene Schriftstufen (text-11 … text-29, globals.css) als Schriftgröße bekannt machen.
// Sonst hält tailwind-merge sie für eine Textfarbe und streicht sie neben text-muted & Co.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ['10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '22', '23', '25', '28', '29'],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Fasst Landingpages zusammen:
 * 1. Entfernt URL-Parameter (wie fbclid)
 * 2. Entfernt "(not set)" Einträge
 * 3. Wandelt "/" in "Startseite" um
 * 4. Addiert Werte für gleiche Pfade
 */
export function aggregateLandingPages(pages: ConvertingPageData[]): ConvertingPageData[] {
  const pageMap = new Map<string, ConvertingPageData>();

  pages.forEach((page) => {
    // 1. Alles ab dem Fragezeichen abschneiden
    let cleanPath = page.path.split('?')[0];

    // 2. Herausfiltern von "(not set)" und leeren Pfaden
    if (!cleanPath || cleanPath === '(not set)' || cleanPath.trim() === '') {
      return; 
    }

    // 3. ✅ NEU: "/" in "Startseite" umbenennen für bessere Lesbarkeit
    if (cleanPath === '/') {
      cleanPath = 'Startseite';
    }

    if (pageMap.has(cleanPath)) {
      // 4. Wenn der saubere Pfad schon existiert: Werte zusammenführen
      const existing = pageMap.get(cleanPath)!;
      
      const totalSessions = (existing.sessions || 0) + (page.sessions || 0);
      const totalConversions = existing.conversions + page.conversions;
      const totalNewUsers = (existing.newUsers || 0) + (page.newUsers || 0);

      // Conversion Rate neu berechnen
      const newConversionRate = totalSessions > 0 
        ? (totalConversions / totalSessions) * 100 
        : 0;
        
      // Engagement Rate gewichtet berechnen
      let newEngagementRate = 0;
      if (totalSessions > 0) {
        const weightExisting = existing.sessions || 0;
        const weightPage = page.sessions || 0;
        const rateExisting = existing.engagementRate || 0;
        const ratePage = page.engagementRate || 0;
        
        newEngagementRate = ((rateExisting * weightExisting) + (ratePage * weightPage)) / totalSessions;
      } else {
        newEngagementRate = ((existing.engagementRate || 0) + (page.engagementRate || 0)) / 2;
      }

      pageMap.set(cleanPath, {
        ...existing,
        sessions: totalSessions,
        conversions: totalConversions,
        newUsers: totalNewUsers,
        conversionRate: newConversionRate,
        engagementRate: parseFloat(newEngagementRate.toFixed(2))
      });

    } else {
      // 5. Neuer Eintrag
      pageMap.set(cleanPath, {
        ...page,
        path: cleanPath
      });
    }
  });

  return Array.from(pageMap.values())
    .sort((a, b) => b.conversions - a.conversions);
}
