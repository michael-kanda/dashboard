// src/components/marketing/MarketingFooter.tsx
import { FooterLine } from '@/components/layout/Footer';
import DataPeakLogo from './DataPeakLogo';

export default function MarketingFooter() {
  return (
    <footer className="border-t border-border-subtle">
      <div className="mx-auto flex max-w-[1120px] flex-col gap-4 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="self-start sm:self-auto">
          <DataPeakLogo className="h-7 w-auto" />
        </div>
        <FooterLine />
      </div>
    </footer>
  );
}
