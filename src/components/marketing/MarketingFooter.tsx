// src/components/marketing/MarketingFooter.tsx
// Zentrierter Footer: Logo, Links, Darstellung, Copyright mit Impressum und Datenschutz.
import { headers } from 'next/headers';
import { FooterLine } from '@/components/layout/Footer';
import ThemeSwitch from '@/components/ThemeSwitch';
import { HANDBOOK_FILENAME, HANDBOOK_PATH } from '@/lib/handbook';
import { appOriginFor } from '@/lib/site-hosts';
import DataPeakLogo from './DataPeakLogo';
import { MARKETING_NAV } from './nav';

const linkClass = 'dp-underline text-14 text-body hover:text-heading focus-visible:outline-none';

export default async function MarketingFooter() {
  const appOrigin = appOriginFor((await headers()).get('host'));

  return (
    <footer className="border-t border-border-subtle">
      <div className="mx-auto flex max-w-[1120px] flex-col items-center gap-6 px-4 py-12 text-center sm:px-6">
        <DataPeakLogo className="h-10 w-auto md:h-12" />
        <nav aria-label="Footer" className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          {MARKETING_NAV.map((item) => (
            <a key={item.id} href={`/#${item.id}`} className={linkClass}>{item.label}</a>
          ))}
          <a href={`${appOrigin}/demo-anwalt`} target="_blank" rel="noopener" className={linkClass}>Demo</a>
          <a href={HANDBOOK_PATH} download={HANDBOOK_FILENAME} className={linkClass}>Handbuch</a>
        </nav>
        <ThemeSwitch />
        <FooterLine className="text-center" />
      </div>
    </footer>
  );
}
