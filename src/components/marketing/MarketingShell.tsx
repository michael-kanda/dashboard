// src/components/marketing/MarketingShell.tsx
// Rahmen für www.datapeak.at: Kopfzeile, Inhalt, Fußzeile. Ohne Sidebar und ohne Login.
import { headers } from 'next/headers';
import { Analytics } from '@vercel/analytics/next';
import ThemeProvider from '@/components/ThemeProvider';
import { appOriginFor } from '@/lib/site-hosts';
import MarketingHeader from './MarketingHeader';
import MarketingFooter from './MarketingFooter';

export default function MarketingShell({ children }: { children: React.ReactNode }) {
  const appOrigin = appOriginFor(headers().get('host'));

  return (
    <ThemeProvider>
      <div className="dp-marketing flex min-h-screen flex-col bg-page">
        <MarketingHeader appOrigin={appOrigin} />
        <main className="flex-grow">{children}</main>
        <MarketingFooter />
      </div>
      {/* Vercel Web Analytics nur auf der Landingpage, ohne Cookies. */}
      <Analytics />
    </ThemeProvider>
  );
}
