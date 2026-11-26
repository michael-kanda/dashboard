// src/components/marketing/DataPeakLogo.tsx
// Wortmarke in hell und dunkel; die passende Variante blendet CSS ein.
/* eslint-disable @next/next/no-img-element */

export default function DataPeakLogo({ className = '' }: { className?: string }) {
  return (
    <>
      <img src="/logo-data-peak.webp" alt="DataPeak" width={645} height={165} className={`${className} dark:hidden`} />
      <img src="/logo-data-peak-dark.webp" alt="DataPeak" width={645} height={165} className={`${className} hidden dark:block`} />
    </>
  );
}
